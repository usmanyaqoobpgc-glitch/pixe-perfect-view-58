import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { EmptyState, LoadingState, PageHeader, ConfirmDialog } from '@/components/ui';
import { Link } from '@tanstack/react-router';
import { Globe, Sparkles, Save, Eye, Rocket, Plus, Trash2 } from 'lucide-react';
import type { Business, WebsiteDraft, WebsiteContent } from '@/lib/types';

const DEFAULT_CONTENT: WebsiteContent = {
  heroTitle: 'Your Business Name',
  heroSubtitle: 'A clear, compelling description of what you do and who it helps.',
  heroCta: 'Get Started',
  brandName: 'Your Brand',
  benefits: [{ title: 'Benefit One', description: 'Describe the key benefit.' }],
  features: [{ title: 'Feature One', description: 'Describe what you offer.' }],
  pricing: [{ name: 'Starter', price: '$29', features: ['Core features', 'Email support'] }],
  testimonials: [{ name: 'Customer Name', quote: 'Great product!' }],
  faq: [{ question: 'Common question?', answer: 'Clear answer.' }],
  contactEmail: 'contact@example.com',
  primaryColor: '#2563eb',
};

export function WebsiteBuilderPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [draft, setDraft] = useState<WebsiteDraft | null>(null);
  const [content, setContent] = useState<WebsiteContent>(DEFAULT_CONTENT);
  const [showPreview, setShowPreview] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setBusinesses(data as Business[] ?? []);
      if (data && data.length > 0) setSelectedBiz(data[0].id);
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedBiz) return;
    supabase.from('website_drafts').select('*').eq('business_id', selectedBiz).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      setDraft(data as WebsiteDraft | null);
      if (data) setContent((data as WebsiteDraft).content);
      else setContent(DEFAULT_CONTENT);
    });
  }, [selectedBiz]);

  const handleSave = async () => {
    setSaving(true);
    if (draft) {
      await supabase.from('website_drafts').update({ content: content as unknown as Record<string, unknown>, version: draft.version + 1 }).eq('id', draft.id);
    } else {
      const { data } = await supabase.from('website_drafts').insert({ business_id: selectedBiz, content: content as unknown as Record<string, unknown> }).select().single();
      setDraft(data as WebsiteDraft);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishConfirm(false);
    await supabase.from('website_drafts').update({ is_published: true, published_url: `https://preview.example.com/${selectedBiz}` }).eq('id', draft?.id ?? '');
    if (draft) setDraft({ ...draft, is_published: true, published_url: `https://preview.example.com/${selectedBiz}` });
  };

  if (loading) return <LoadingState />;
  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader title="Website Builder" description="Generate a professional landing page" />
        <EmptyState icon={Globe} title="No website to build yet" description="Create a business first to start building your landing page." action={<Link to="/planner" className="btn-primary"><Sparkles className="w-4 h-4" /> Create Business</Link>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Website Builder" description="Generate and edit your landing page" action={
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className="btn-secondary"><Eye className="w-4 h-4" /> {showPreview ? 'Edit' : 'Preview'}</button>
          <button onClick={handleSave} disabled={saving} className="btn-secondary"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Draft'}</button>
          <button onClick={() => setPublishConfirm(true)} disabled={!draft} className="btn-primary"><Rocket className="w-4 h-4" /> Publish</button>
        </div>
      }
      />

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {businesses.map((b) => (
          <button key={b.id} onClick={() => setSelectedBiz(b.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedBiz === b.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'}`}>{b.name}</button>
        ))}
      </div>

      {draft?.is_published && (
        <div className="mb-4 p-3 rounded-lg bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400 text-sm flex items-center gap-2">
          <Rocket className="w-4 h-4" /> Published at <span className="font-mono">{draft.published_url}</span>
        </div>
      )}

      {showPreview ? (
        <WebsitePreview content={content} />
      ) : (
        <WebsiteEditor content={content} setContent={setContent} />
      )}

      <ConfirmDialog open={publishConfirm} title="Publish Website" message="This will make your landing page publicly accessible. Are you sure you want to publish?" confirmLabel="Publish" onConfirm={handlePublish} onCancel={() => setPublishConfirm(false)} />
    </div>
  );
}

function WebsiteEditor({ content, setContent }: { content: WebsiteContent; setContent: (c: WebsiteContent) => void }) {
  const update = (key: keyof WebsiteContent, value: string) => setContent({ ...content, [key]: value });

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Hero Section</h3>
        <div className="space-y-3">
          <div><label className="label">Brand Name</label><input className="input" value={content.brandName ?? ''} onChange={(e) => update('brandName', e.target.value)} /></div>
          <div><label className="label">Hero Title</label><input className="input" value={content.heroTitle ?? ''} onChange={(e) => update('heroTitle', e.target.value)} /></div>
          <div><label className="label">Hero Subtitle</label><textarea className="input" value={content.heroSubtitle ?? ''} onChange={(e) => update('heroSubtitle', e.target.value)} /></div>
          <div><label className="label">CTA Button Text</label><input className="input" value={content.heroCta ?? ''} onChange={(e) => update('heroCta', e.target.value)} /></div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Benefits</h3>
        <div className="space-y-3">
          {(content.benefits ?? []).map((b, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="Title" value={b.title} onChange={(e) => { const arr = [...(content.benefits ?? [])]; arr[i] = { ...b, title: e.target.value }; setContent({ ...content, benefits: arr }); }} />
              <input className="input" placeholder="Description" value={b.description} onChange={(e) => { const arr = [...(content.benefits ?? [])]; arr[i] = { ...b, description: e.target.value }; setContent({ ...content, benefits: arr }); }} />
              <button onClick={() => setContent({ ...content, benefits: (content.benefits ?? []).filter((_, idx) => idx !== i) })} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setContent({ ...content, benefits: [...(content.benefits ?? []), { title: '', description: '' }] })} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Add Benefit</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Features</h3>
        <div className="space-y-3">
          {(content.features ?? []).map((f, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="Title" value={f.title} onChange={(e) => { const arr = [...(content.features ?? [])]; arr[i] = { ...f, title: e.target.value }; setContent({ ...content, features: arr }); }} />
              <input className="input" placeholder="Description" value={f.description} onChange={(e) => { const arr = [...(content.features ?? [])]; arr[i] = { ...f, description: e.target.value }; setContent({ ...content, features: arr }); }} />
              <button onClick={() => setContent({ ...content, features: (content.features ?? []).filter((_, idx) => idx !== i) })} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setContent({ ...content, features: [...(content.features ?? []), { title: '', description: '' }] })} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Add Feature</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Pricing</h3>
        <div className="space-y-3">
          {(content.pricing ?? []).map((p, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex gap-2">
                <input className="input" placeholder="Name" value={p.name} onChange={(e) => { const arr = [...(content.pricing ?? [])]; arr[i] = { ...p, name: e.target.value }; setContent({ ...content, pricing: arr }); }} />
                <input className="input" placeholder="Price" value={p.price} onChange={(e) => { const arr = [...(content.pricing ?? [])]; arr[i] = { ...p, price: e.target.value }; setContent({ ...content, pricing: arr }); }} />
                <button onClick={() => setContent({ ...content, pricing: (content.pricing ?? []).filter((_, idx) => idx !== i) })} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
              </div>
              <input className="input" placeholder="Features (comma-separated)" value={p.features.join(', ')} onChange={(e) => { const arr = [...(content.pricing ?? [])]; arr[i] = { ...p, features: e.target.value.split(',').map((s) => s.trim()) }; setContent({ ...content, pricing: arr }); }} />
            </div>
          ))}
          <button onClick={() => setContent({ ...content, pricing: [...(content.pricing ?? []), { name: '', price: '', features: [] }] })} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Add Tier</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Testimonials</h3>
        <div className="space-y-3">
          {(content.testimonials ?? []).map((t, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="Name" value={t.name} onChange={(e) => { const arr = [...(content.testimonials ?? [])]; arr[i] = { ...t, name: e.target.value }; setContent({ ...content, testimonials: arr }); }} />
              <input className="input" placeholder="Quote" value={t.quote} onChange={(e) => { const arr = [...(content.testimonials ?? [])]; arr[i] = { ...t, quote: e.target.value }; setContent({ ...content, testimonials: arr }); }} />
              <button onClick={() => setContent({ ...content, testimonials: (content.testimonials ?? []).filter((_, idx) => idx !== i) })} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setContent({ ...content, testimonials: [...(content.testimonials ?? []), { name: '', quote: '' }] })} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Add Testimonial</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">FAQ</h3>
        <div className="space-y-3">
          {(content.faq ?? []).map((f, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2">
                <input className="input" placeholder="Question" value={f.question} onChange={(e) => { const arr = [...(content.faq ?? [])]; arr[i] = { ...f, question: e.target.value }; setContent({ ...content, faq: arr }); }} />
                <button onClick={() => setContent({ ...content, faq: (content.faq ?? []).filter((_, idx) => idx !== i) })} className="btn-ghost"><Trash2 className="w-4 h-4" /></button>
              </div>
              <input className="input" placeholder="Answer" value={f.answer} onChange={(e) => { const arr = [...(content.faq ?? [])]; arr[i] = { ...f, answer: e.target.value }; setContent({ ...content, faq: arr }); }} />
            </div>
          ))}
          <button onClick={() => setContent({ ...content, faq: [...(content.faq ?? []), { question: '', answer: '' }] })} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Add FAQ</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Contact</h3>
        <div className="space-y-3">
          <div><label className="label">Contact Email</label><input className="input" value={content.contactEmail ?? ''} onChange={(e) => update('contactEmail', e.target.value)} /></div>
          <div><label className="label">Contact Phone</label><input className="input" value={content.contactPhone ?? ''} onChange={(e) => update('contactPhone', e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

function WebsitePreview({ content }: { content: WebsiteContent }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-white dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="font-bold text-slate-900 dark:text-white">{content.brandName || 'Your Brand'}</span>
          <button className="px-4 py-1.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: content.primaryColor || '#2563eb' }}>{content.heroCta || 'Get Started'}</button>
        </div>

        <div className="px-6 py-16 text-center" style={{ backgroundColor: content.primaryColor ? `${content.primaryColor}10` : '#eff6ff' }}>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{content.heroTitle || 'Your Business Name'}</h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto mb-6">{content.heroSubtitle || 'Your subtitle here'}</p>
          <button className="px-6 py-2.5 rounded-lg text-white font-medium" style={{ backgroundColor: content.primaryColor || '#2563eb' }}>{content.heroCta || 'Get Started'}</button>
        </div>

        {(content.benefits ?? []).length > 0 && (
          <div className="px-6 py-12">
            <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-8">Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(content.benefits ?? []).map((b, i) => (
                <div key={i} className="text-center">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{b.title}</h3>
                  <p className="text-sm text-slate-500">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(content.pricing ?? []).length > 0 && (
          <div className="px-6 py-12 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-8">Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {(content.pricing ?? []).map((p, i) => (
                <div key={i} className="card p-6 text-center">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white my-3">{p.price}</p>
                  <ul className="text-sm text-slate-500 space-y-1">{p.features.map((f, j) => <li key={j}>{f}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {(content.faq ?? []).length > 0 && (
          <div className="px-6 py-12">
            <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-8">FAQ</h2>
            <div className="max-w-2xl mx-auto space-y-4">
              {(content.faq ?? []).map((f, i) => (
                <div key={i}>
                  <p className="font-medium text-slate-900 dark:text-white">{f.question}</p>
                  <p className="text-sm text-slate-500 mt-1">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-8 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-400">
          Contact: {content.contactEmail || 'contact@example.com'}
        </div>
      </div>
    </div>
  );
}
