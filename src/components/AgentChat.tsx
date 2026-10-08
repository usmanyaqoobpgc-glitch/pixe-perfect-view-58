import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { MessageSquare, FileText, Send, Loader2, Copy, Download, Settings2, Plus, Trash2 } from 'lucide-react';
import {
  listChatThreads, createChatThread, deleteChatThread, getChatMessages, sendChatMessage,
} from '@/lib/agent-chat.functions';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };
type Thread = { id: string; title: string; updated_at: string };

export function AgentChat({ businessId }: { businessId: string }) {
  const listFn = useServerFn(listChatThreads);
  const createFn = useServerFn(createChatThread);
  const deleteFn = useServerFn(deleteChatThread);
  const messagesFn = useServerFn(getChatMessages);
  const sendFn = useServerFn(sendChatMessage);
  const navigate = useNavigate();
  const { thread: threadId } = useSearch({ from: '/agents' });

  const [threads, setThreads] = useState<Thread[]>([]);
  const [mode, setMode] = useState<'chat' | 'document'>('chat');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const goThread = (id: string | undefined) =>
    navigate({ to: '/agents', search: id ? { thread: id } : {}, replace: false });

  async function refreshThreads() {
    try { setThreads(await listFn({ data: { businessId } })); } catch { /* shown on action */ }
  }

  useEffect(() => { refreshThreads(); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setMessages([]); setError(null);
    if (!threadId) return;
    setLoading(true);
    messagesFn({ data: { threadId } })
      .then((rows) => { if (!cancelled) setMessages(rows as Msg[]); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load messages.'); })
      .finally(() => { if (!cancelled) { setLoading(false); inputRef.current?.focus(); } });
    return () => { cancelled = true; };
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  async function newThread() {
    try {
      const t = await createFn({ data: { businessId } });
      await refreshThreads();
      goThread(t.id);
      return t.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a conversation.');
      return null;
    }
  }

  async function removeThread(id: string) {
    if (!confirm('Delete this conversation?')) return;
    try {
      await deleteFn({ data: { threadId: id } });
      await refreshThreads();
      if (id === threadId) goThread(undefined);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.'); }
  }

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true); setError(null);
    const tid = threadId ?? (await newThread());
    if (!tid) { setBusy(false); return; }
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    try {
      const res = await sendFn({ data: { threadId: tid, mode, content: text } });
      setMessages((m) => [...m, { id: `tmp-a-${Date.now()}`, role: 'assistant', content: res.reply }]);
      refreshThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The agent could not answer.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function download(content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'agent-document.md'; a.click();
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

      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        <aside className="border-r border-slate-200 dark:border-slate-700 pr-3 md:max-h-[560px] overflow-y-auto">
          <button onClick={() => newThread()} className="btn-secondary text-sm w-full flex items-center justify-center gap-1 mb-3">
            <Plus className="w-4 h-4" /> New conversation
          </button>
          {threads.length === 0 && <p className="text-xs text-slate-400">No conversations yet.</p>}
          <ul className="space-y-1">
            {threads.map((t) => (
              <li key={t.id} className={`group flex items-center rounded-md text-sm ${t.id === threadId ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <button onClick={() => goThread(t.id)} className="flex-1 text-left px-2 py-1.5 truncate text-slate-700 dark:text-slate-200">{t.title}</button>
                <button onClick={() => removeThread(t.id)} aria-label="Delete conversation" className="px-2 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0">
          <div className="space-y-3 max-h-[480px] min-h-[160px] overflow-y-auto mb-4 pr-1">
            {loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
            {!loading && messages.length === 0 && !busy && (
              <p className="text-sm text-slate-400">Ask a question about your business, or switch to “Write document” to get a finished document.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={m.role === 'user'
                  ? 'max-w-[80%] rounded-lg bg-primary-600 text-white px-3 py-2 text-sm whitespace-pre-wrap'
                  : 'px-1 py-1'}>
                  {m.role === 'user' ? m.content : (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                      <div className="flex gap-3 mt-2">
                        <button onClick={() => navigator.clipboard.writeText(m.content)} className="text-xs text-slate-500 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                        <button onClick={() => download(m.content)} className="text-xs text-slate-500 flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'document' ? 'Writing…' : 'Thinking…'}</div>}
            <div ref={endRef} />
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              autoFocus
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
      </div>
    </div>
  );
}
