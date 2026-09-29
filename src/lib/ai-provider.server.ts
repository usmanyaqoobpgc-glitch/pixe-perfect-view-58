/**
 * Shared server-only AI provider abstraction.
 *
 * Resolution order per call:
 *  1. LOVABLE_API_KEY (Lovable AI gateway, paid, no free-tier quota) — preferred.
 *  2. GEMINI_API_KEY (direct Google Gemini call) — used only if the gateway is not configured.
 *  3. Caller falls back to a template/mock result if neither key is present.
 *
 * Keys are read from process.env inside this module and never returned to the client.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

const LOVABLE_RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";
const LOVABLE_MODEL = "openai/gpt-6-astra";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiProviderName = "gemini" | "lovable_ai" | "mock";

export function isAiConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] || process.env["GEMINI_API_KEY"]);
}

export function activeProviderName(): AiProviderName {
  if (process.env["LOVABLE_API_KEY"]) return "lovable_ai";
  if (process.env["GEMINI_API_KEY"]) return "gemini";
  return "mock";
}

/** Accumulates output text from a Responses API SSE stream. */
async function readResponsesStream(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("AI provider returned an empty response body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finalText = "";

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
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data) as { type?: string; delta?: string; text?: string; response?: { error?: { message?: string } } };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") content += evt.delta;
        else if (evt.type === "response.output_text.done" && typeof evt.text === "string") finalText += evt.text;
        else if (evt.type === "response.failed" || evt.type === "error") {
          throw new Error(evt.response?.error?.message ?? "AI provider failed");
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "" && !(e instanceof SyntaxError)) throw e;
      }
    }
  }
  return content || finalText;
}

async function callGemini(messages: ChatMessage[], json: boolean): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      contents,
      generationConfig: json ? { responseMimeType: "application/json" } : undefined,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ai-provider] Gemini status ${response.status}: ${detail.slice(0, 300)}`);
    throw new Error(`Gemini returned status ${response.status}`);
  }
  const out = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function callLovableGateway(messages: ChatMessage[], json: boolean): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const instructions = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(LOVABLE_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      instructions: instructions || undefined,
      input,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      ...(json ? { text: { format: { type: "json_object" } } } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ai-provider] Lovable gateway status ${response.status}: ${detail.slice(0, 300)}`);
    throw new Error(`AI gateway returned status ${response.status}`);
  }
  const text = await readResponsesStream(response);
  if (!text) throw new Error("The AI returned an empty response");
  return text;
}

async function call(messages: ChatMessage[], json: boolean): Promise<{ text: string; provider: AiProviderName }> {
  const provider = activeProviderName();
  if (provider === "mock") throw new Error("AI provider is not configured");
  const text = provider === "lovable_ai" ? await callLovableGateway(messages, json) : await callGemini(messages, json);
  return { text, provider };
}

/** Free-form text (markdown) answer. */
export async function chatText(messages: ChatMessage[]): Promise<{ text: string; provider: AiProviderName }> {
  return call(messages, false);
}

/** Calls the configured AI provider and returns parsed JSON. */
export async function chatJSON<T>(messages: ChatMessage[]): Promise<{ data: T; provider: AiProviderName }> {
  const { text, provider } = await call(messages, true);
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI returned an unreadable response.");
  try {
    return { data: JSON.parse(match[0]) as T, provider };
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }
}
