/**
 * Shared server-only AI provider abstraction.
 *
 * Resolution order per call:
 *  1. GEMINI_API_KEY (direct Google Gemini call, free tier) — preferred when configured.
 *  2. LOVABLE_API_KEY (Lovable AI gateway) — used only if Gemini is not configured.
 *  3. Caller falls back to a template/mock result if neither key is present.
 *
 * Keys are read from process.env inside this module and never returned to the client.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3.8-flash";

export type ChatMessage = { role: "system" | "user"; content: string };
export type AiProviderName = "gemini" | "lovable_ai" | "mock";

export function isAiConfigured(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"]);
}

export function activeProviderName(): AiProviderName {
  if (process.env["GEMINI_API_KEY"]) return "gemini";
  if (process.env["LOVABLE_API_KEY"]) return "lovable_ai";
  return "mock";
}

/** Accumulates the assistant message content from an SSE chat-completions stream. */
async function readStreamedContent(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("AI provider returned an empty response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index: number;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
        };
        content += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  return content;
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  // Gemini has no separate "system" role in generateContent — fold system messages
  // into a systemInstruction and send the rest as a single user turn.
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ai-provider] Gemini status ${response.status}: ${detail.slice(0, 300)}`);
    throw new Error(`Gemini returned status ${response.status}`);
  }

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function callLovableGateway(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      messages,
      response_format: { type: "json_object" },
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ai-provider] Lovable gateway status ${response.status}: ${detail.slice(0, 300)}`);
    throw new Error(`AI gateway returned status ${response.status}`);
  }

  return readStreamedContent(response);
}

/**
 * Calls the configured AI provider and returns parsed JSON.
 * Prefers GEMINI_API_KEY; falls back to the Lovable gateway if Gemini is not configured.
 * Throws if neither is configured or the response cannot be parsed as JSON.
 */
export async function chatJSON<T>(messages: ChatMessage[]): Promise<{ data: T; provider: AiProviderName }> {
  const provider = activeProviderName();
  if (provider === "mock") throw new Error("AI provider is not configured");

  const content = provider === "gemini" ? await callGemini(messages) : await callLovableGateway(messages);

  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI returned an unreadable response.");
  try {
    return { data: JSON.parse(match[0]) as T, provider };
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }
}
