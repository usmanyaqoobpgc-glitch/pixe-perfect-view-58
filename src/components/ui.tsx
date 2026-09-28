import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'primary',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: 'primary' | 'accent' | 'warning' | 'error';
}) {
  // Semantic color is carried by a thin leading bar and the icon tint only,
  // so a grid of tiles reads as one calm surface instead of a row of colored boxes.
  const barMap = {
    primary: 'bg-primary-500',
    accent: 'bg-accent-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };
  const iconMap = {
    primary: 'text-primary-500 dark:text-primary-400',
    accent: 'text-accent-600 dark:text-accent-400',
    warning: 'text-warning-600 dark:text-warning-400',
    error: 'text-error-600 dark:text-error-400',
  };

  return (
    <div className="card relative overflow-hidden px-4 py-4 transition-colors hover:border-slate-300 dark:hover:border-white/[0.16]">
      <span className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${barMap[color]}`} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className={`w-4 h-4 shrink-0 ${iconMap[color]}`} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display text-[26px] leading-none font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
        {trend && (
          <span className={`text-xs font-medium tabular-nums ${trend.positive ? 'text-accent-600 dark:text-accent-400' : 'text-error-600 dark:text-error-400'}`}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={onCancel}>
      <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-danger">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
