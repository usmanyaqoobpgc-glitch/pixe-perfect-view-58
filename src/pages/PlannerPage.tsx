import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { generateBusinessPlan } from '@/lib/ai-planner.functions';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { useNavigate } from '@tanstack/react-router';
import {
  Sparkles, Check, ChevronRight, ChevronLeft, DollarSign, Globe,
  Users, Clock, Target, Megaphone, Lightbulb,
} from 'lucide-react';
import { PLAN_SECTIONS, SECTION_LABELS } from '@/lib/types';

const STEPS = [
  { key: 'idea', label: 'Business Idea', icon: Lightbulb, description: 'What do you want to build?' },
  { key: 'budget', label: 'Budget', icon: DollarSign, description: 'How much can you invest?' },
  { key: 'market', label: 'Market', icon: Globe, description: 'Where will you operate?' },
  { key: 'customer', label: 'Target Customer', icon: Users, description: 'Who are you selling to?' },
  { key: 'skills', label: 'Skills & Time', icon: Clock, description: 'What can you bring?' },
  { key: 'model', label: 'Business Model', icon: Target, description: 'How will you make money?' },
  { key: 'channels', label: 'Marketing Channels', icon: Megaphone, description: 'How will you reach people?' },
  { key: 'review', label: 'Review & Generate', icon: Sparkles, description: 'Confirm and generate your plan' },
];

const BUSINESS_MODELS = [
  'SaaS / Software', 'E-commerce', 'Services / Consulting', 'Digital Products',
  'Subscription', 'Marketplace', 'Content / Media', 'Affiliate', 'Coaching / Course',
];

const CHANNELS = [
  'Social Media', 'Email Marketing', 'SEO / Blog', 'Paid Ads',
  'Content Marketing', 'Referrals', 'Partnerships', 'Cold Outreach',
  'Community / Forums', 'Influencer',
];

export function PlannerPage() {
  const generatePlan = useServerFn(generateBusinessPlan);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    idea: '',
    budget: '',
    country: 'United States',
    target_customer: '',
    skills: '',
    available_time: '',
    business_model: BUSINESS_MODELS[0],
    revenue_target: '',
    target_deadline: '',
    marketing_channels: [] as string[],
  });

  const updateForm = (key: string, value: string | string[]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      marketing_channels: f.marketing_channels.includes(ch)
        ? f.marketing_channels.filter((c) => c !== ch)
        : [...f.marketing_channels, ch],
    }));
  };

  const canProceed = () => {
    switch (STEPS[step].key) {
      case 'idea': return form.idea.trim().length >= 10;
      case 'budget': return form.budget !== '' && Number(form.budget) >= 0;
      case 'market': return form.country.trim().length > 0;
      case 'customer': return form.target_customer.trim().length >= 3;
      case 'skills': return form.skills.trim().length >= 2 && form.available_time !== '';
      case 'model': return form.business_model.length > 0 && form.revenue_target !== '' && form.target_deadline !== '';
      case 'channels': return form.marketing_channels.length > 0;
      case 'review': return true;
      default: return false;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedSections([]);

    try {
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          user_id: user!.id,
          name: form.idea.slice(0, 50) + '...',
          idea: form.idea,
          budget: Number(form.budget),
          country: form.country,
          target_customer: form.target_customer,
          skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
          available_time_hours_per_week: Number(form.available_time),
          business_model: form.business_model,
          revenue_target: Number(form.revenue_target),
          target_deadline: form.target_deadline,
          marketing_channels: form.marketing_channels,
          status: 'planning',
        })
        .select()
        .single();

      if (bizError) throw new Error(bizError.message);

      let sections: string[];
      try {
        const result = await generatePlan({ data: { businessId: business.id } });
        sections = result.sections || [];
      } catch (err) {
        // A dropped/severed connection ("Failed to fetch") does not stop the
        // server from finishing and persisting the plan — poll for the result
        // before treating it as a failure.
        const networkFailure =
          err instanceof TypeError || /failed to fetch|network|load failed/i.test(String(err));
        if (!networkFailure) throw err;

        sections = await waitForPersistedPlan(business.id);
        if (sections.length === 0) throw err;
      }
      setGeneratedSections(sections);


      await supabase.from('notifications').insert({
        user_id: user!.id,
        title: 'Business plan generated',
        message: `Your plan for "${form.idea.slice(0, 40)}" is ready. Review and start executing.`,
        type: 'ai',
      });

      setTimeout(() => navigate({ to: '/businesses' }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div>
        <PageHeader title="AI Business Planner" description="Generating your business plan" />
        <div className="card p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary-600 text-white flex items-center justify-center mb-4 animate-pulse-soft">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Generating your business plan...
            </h2>
            <p className="text-sm text-slate-500 max-w-md">
              Our AI agents are analyzing your idea, researching the market, and creating actionable steps.
              This may take a moment.
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            {PLAN_SECTIONS.map((section) => {
              const done = generatedSections.includes(section);
              return (
                <div
                  key={section}
                  className={`flex items-center gap-3 p-2 rounded-lg transition ${done ? 'bg-accent-50 dark:bg-accent-500/10' : 'bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-accent-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {done ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />}
                  </div>
                  <span className={`text-sm ${done ? 'text-accent-700 dark:text-accent-400 font-medium' : 'text-slate-400'}`}>
                    {SECTION_LABELS[section]}
                  </span>
                </div>
              );
            })}
          </div>
          {error && (
            <div className="mt-6 max-w-md mx-auto p-4 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div>
      <PageHeader title="AI Business Planner" description="Turn your idea into an executable plan" />

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center shrink-0">
              <div
                className={`flex flex-col items-center gap-1 ${i <= step ? 'opacity-100' : 'opacity-40'}`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition ${
                    i < step
                      ? 'bg-accent-500 text-white'
                      : i === step
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === step ? 'text-primary-600' : 'text-slate-400'} hidden sm:block`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-12 h-0.5 mx-1 ${i < step ? 'bg-accent-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 flex items-center justify-center">
            <StepIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{STEPS[step].label}</h2>
            <p className="text-sm text-slate-400">{STEPS[step].description}</p>
          </div>
        </div>

        {/* Step content */}
        <div className="space-y-4 animate-fade-in" key={step}>
          {STEPS[step].key === 'idea' && (
            <div>
              <label className="label">Describe your business idea</label>
              <textarea
                value={form.idea}
                onChange={(e) => updateForm('idea', e.target.value)}
                className="input min-h-[120px] resize-y"
                placeholder="e.g. I have $100 and want to build an online business targeting $1,000 revenue in 90 days. I want to sell digital templates..."
              />
              <p className="text-xs text-slate-400 mt-2">Be as specific as possible. Include your budget, target revenue, and timeline if you have them.</p>
            </div>
          )}

          {STEPS[step].key === 'budget' && (
            <div>
              <label className="label">How much money can you invest to start?</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={(e) => updateForm('budget', e.target.value)}
                  className="input pl-7"
                  placeholder="100"
                />
              </div>
              <div className="flex gap-2 mt-3">
                {[0, 50, 100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => updateForm('budget', String(amt))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${form.budget === String(amt) ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {STEPS[step].key === 'market' && (
            <div>
              <label className="label">Country / Market</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => updateForm('country', e.target.value)}
                className="input"
                placeholder="United States"
              />
            </div>
          )}

          {STEPS[step].key === 'customer' && (
            <div>
              <label className="label">Who is your target customer?</label>
              <textarea
                value={form.target_customer}
                onChange={(e) => updateForm('target_customer', e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="e.g. Small business owners who need professional templates but can't afford a designer..."
              />
            </div>
          )}

          {STEPS[step].key === 'skills' && (
            <>
              <div>
                <label className="label">What skills do you have?</label>
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => updateForm('skills', e.target.value)}
                  className="input"
                  placeholder="design, writing, coding, marketing..."
                />
                <p className="text-xs text-slate-400 mt-1">Comma-separated</p>
              </div>
              <div>
                <label className="label">Hours available per week</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={form.available_time}
                  onChange={(e) => updateForm('available_time', e.target.value)}
                  className="input"
                  placeholder="10"
                />
              </div>
            </>
          )}

          {STEPS[step].key === 'model' && (
            <>
              <div>
                <label className="label">Business Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_MODELS.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateForm('business_model', m)}
                      className={`px-3 py-2 rounded-lg text-sm border text-left transition ${form.business_model === m ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Revenue Target ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.revenue_target}
                    onChange={(e) => updateForm('revenue_target', e.target.value)}
                    className="input"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="label">Target Deadline</label>
                  <input
                    type="date"
                    value={form.target_deadline}
                    onChange={(e) => updateForm('target_deadline', e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </>
          )}

          {STEPS[step].key === 'channels' && (
            <div>
              <label className="label">Preferred Marketing Channels</label>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`px-3 py-2 rounded-lg text-sm border text-left transition flex items-center gap-2 ${form.marketing_channels.includes(ch) ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                  >
                    {form.marketing_channels.includes(ch) && <Check className="w-4 h-4" />}
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {STEPS[step].key === 'review' && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-2 text-sm">
                <ReviewItem label="Idea" value={form.idea} />
                <ReviewItem label="Budget" value={`$${form.budget}`} />
                <ReviewItem label="Market" value={form.country} />
                <ReviewItem label="Target Customer" value={form.target_customer} />
                <ReviewItem label="Skills" value={form.skills} />
                <ReviewItem label="Time/Week" value={`${form.available_time} hours`} />
                <ReviewItem label="Business Model" value={form.business_model} />
                <ReviewItem label="Revenue Target" value={`$${form.revenue_target}`} />
                <ReviewItem label="Deadline" value={form.target_deadline} />
                <ReviewItem label="Channels" value={form.marketing_channels.join(', ')} />
              </div>
              <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400 text-xs">
                AI-generated plans are estimates and recommendations, not guarantees of success.
                Revenue targets are goals, not promises. Always validate with your own research.
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="btn-primary"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canProceed()}
              className="btn-primary"
            >
              <Sparkles className="w-4 h-4" />
              Generate Business Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-slate-500 dark:text-slate-400 min-w-[120px]">{label}:</span>
      <span className="text-slate-900 dark:text-slate-200 flex-1">{value || '—'}</span>
    </div>
  );
}
