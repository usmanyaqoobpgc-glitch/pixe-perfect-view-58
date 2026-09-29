import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import ReactMarkdown from 'react-markdown';
import { Link } from '@tanstack/react-router';
import { MessageSquare, FileText, Send, Loader2, Copy, Download, Settings2 } from 'lucide-react';
import { chatWithAgent } from '@/lib/agent.functions';

type Msg = { role: 'user' | 'assistant'; content: string };

export function AgentChat({ businessId }: { businessId: string }) {
  const send = useServerFn(chatWithAgent);
  const [mode, setMode] = useState<'chat' | 'document'>('chat');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = input.trim();
    if (!text || busy || !businessId) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await send({ data: { businessId, mode, messages: next } });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The agent could not answer.');
    } finally {
      setBusy(false);
    }
  }

  function download(content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-document.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mr-auto">Ask your agent</h3>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
          <button onClick={() => setMode('chat')} className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'chat' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            <MessageSquare className="w-4 h-4" /> Ask
          </button>
          <button onClick={() => setMode('document')} className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'document' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            <FileText className="w-4 h-4" /> Write document
          </button>
        </div>
        <Link to="/agent-settings" className="btn-secondary text-sm flex items-center gap-1"><Settings2 className="w-4 h-4" /> Brand voice</Link>
      </div>

      {messages.length > 0 && (
        <div className="space-y-3 max-h-[480px] overflow-y-auto mb-4 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={m.role === 'user'
                ? 'max-w-[80%] rounded-lg bg-primary-600 text-white px-3 py-2 text-sm whitespace-pre-wrap'
                : 'rounded-lg bg-slate-50 dark:bg-slate-800/60 px-4 py-3'}>
                {m.role === 'user' ? m.content : (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => navigator.clipboard.writeText(m.content)} className="text-xs text-slate-500 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                      <button onClick={() => download(m.content)} className="text-xs text-slate-500 flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'document' ? 'Writing…' : 'Thinking…'}</div>}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-2">
        <textarea
          className="input flex-1 min-h-[60px]"
          placeholder={mode === 'document' ? 'Describe the document, e.g. "A one-page wholesale price sheet for boutiques"' : 'Ask anything about your business…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button onClick={submit} disabled={busy || !input.trim()} className="btn-primary self-end flex items-center gap-1">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
        </button>
      </div>
    </div>
  );
}
