import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { Check, Bot } from 'lucide-react';

const VOICES = ['professional', 'friendly', 'bold', 'luxury', 'playful', 'authoritative', 'warm'];
const STYLES = ['clear', 'persuasive', 'storytelling', 'data-driven', 'conversational', 'formal'];

type Row = { id: string; business_id: string; voice: string; writing_style: string; response_length: 'short' | 'medium' | 'long'; brand_notes: string };

export function AgentSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [row, setRow] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('businesses').select('id, name').order('created_at').then(({ data }) => {
      setBusinesses(data ?? []);
      if (data?.[0]) setBusinessId(data[0].id);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!businessId || !user) return;
    setRow(null);
    (async () => {
      let { data } = await supabase.from('business_agents').select('id, business_id, voice, writing_style, response_length, brand_notes').eq('business_id', businessId).maybeSingle();
      if (!data) {
        const name = businesses.find((b) => b.id === businessId)?.name ?? 'Business';
        const ins = await supabase.from('business_agents').insert({ business_id: businessId, user_id: user.id, name: `${name} Agent` }).select('id, business_id, voice, writing_style, response_length, brand_notes').single();
        data = ins.data;
      }
      setRow(data as Row | null);
    })();
  }, [businessId, user, businesses]);

  async function save() {
    if (!row) return;
    setSaving(true); setError(null); setSaved(false);
    const { error } = await supabase.from('business_agents').update({
      voice: row.voice.slice(0, 60), writing_style: row.writing_style.slice(0, 60),
      response_length: row.response_length, brand_notes: row.brand_notes.slice(0, 1000),
    }).eq('id', row.id);
    setSaving(false);
    if (error) setError('Could not save settings. Please try again.');
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  if (loading) return <LoadingState />;
  if (businesses.length === 0) return <EmptyState icon={Bot} title="No business yet" description="Create a business first to set your agent's brand voice." />;

  return (
    <div>
      <PageHeader
        title="Agent Settings"
        description="Set the voice, writing style and length your agent uses for every answer, document and task"
        action={businesses.length > 1 ? (
          <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="input max-w-xs">
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : undefined}
      />
      {!row ? <LoadingState /> : (
        <div className="card p-6 space-y-5 max-w-2xl">
          <div>
            <label className="label">Brand voice</label>
            <select className="input" value={row.voice} onChange={(e) => setRow({ ...row, voice: e.target.value })}>
              {[...new Set([...VOICES, row.voice])].map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Writing style</label>
            <select className="input" value={row.writing_style} onChange={(e) => setRow({ ...row, writing_style: e.target.value })}>
              {[...new Set([...STYLES, row.writing_style])].map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Response length</label>
            <div className="flex gap-2">
              {(['short', 'medium', 'long'] as const).map((l) => (
                <button key={l} onClick={() => setRow({ ...row, response_length: l })} className={row.response_length === l ? 'btn-primary' : 'btn-secondary'}>
                  {l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Brand guidelines (optional)</label>
            <textarea className="input min-h-[100px]" maxLength={1000} placeholder="e.g. Always mention free delivery in Pakistan. Avoid slang. Use 'we' not 'I'."
              value={row.brand_notes} onChange={(e) => setRow({ ...row, brand_notes: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">{row.brand_notes.length}/1000</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save settings'}</button>
            {saved && <span className="text-sm text-accent-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
