import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ---------- buttons ---------- */

const BTN: Record<string, string> = {
  approve: 'bg-purple/20 text-purple-300 border-purple/50 hover:bg-purple/30',
  reject: 'bg-coral/20 text-red-300 border-coral/50 hover:bg-coral/30',
  neutral: 'border-border text-text-muted hover:text-text hover:border-text-muted',
  primary: 'brand-gradient text-white border-transparent hover:opacity-90',
};

export function Btn({
  variant = 'neutral',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN }) {
  return (
    <button
      {...rest}
      className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none ${BTN[variant]} ${className}`}
    />
  );
}

/* ---------- badge ---------- */

const BADGE: Record<string, string> = {
  approved: 'text-purple-300 border-purple/50 bg-purple/15',
  submitted: 'text-pink-300 border-magenta/50 bg-magenta/15',
  created: 'text-text-muted border-border',
  pending: 'text-pink-300 border-magenta/50 bg-magenta/15',
  rejected: 'text-red-300 border-coral/50 bg-coral/15',
  flagged: 'text-orange-300 border-orange/50 bg-orange/15',
  open: 'text-orange-300 border-orange/50 bg-orange/15',
  paid: 'text-purple-300 border-purple/50 bg-purple/15',
  failed: 'text-red-300 border-coral/50 bg-coral/15',
  reversed: 'text-orange-300 border-orange/50 bg-orange/15',
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
        BADGE[value] ?? 'text-text-muted border-border'
      }`}
    >
      {value}
    </span>
  );
}

/* ---------- page header ---------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-border px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display font-semibold text-lg sm:text-xl">{title}</h1>
        {description && <p className="text-text-muted text-xs mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ---------- master–detail work page ---------- */

export function WorkPage({
  title,
  description,
  actions,
  list,
  detail,
  selected,
  onBack,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  list: ReactNode;
  detail: ReactNode;
  selected: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-49px)]">
      <PageHeader title={title} description={description} actions={actions} />
      <div className="flex-1 min-h-0 lg:flex">
        <aside
          className={`lg:w-[340px] xl:w-[380px] lg:shrink-0 lg:border-r border-border lg:h-full lg:overflow-y-auto ${
            selected ? 'hidden lg:block' : 'block'
          }`}
        >
          {list}
        </aside>
        <section
          className={`flex-1 min-w-0 lg:h-full lg:overflow-y-auto ${selected ? 'block' : 'hidden lg:block'}`}
        >
          {selected && (
            <button
              onClick={onBack}
              className="lg:hidden w-full text-left px-4 py-3 text-xs font-medium text-text-muted border-b border-border hover:text-text"
            >
              ← Back to list
            </button>
          )}
          {detail}
        </section>
      </div>
    </div>
  );
}

/* ---------- list row ---------- */

export function ListRow({
  selected,
  onClick,
  title,
  subtitle,
  right,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/60 border-l-2 flex items-start gap-3 transition-colors ${
        selected ? 'bg-surface border-l-pink' : 'border-l-transparent hover:bg-surface/50'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-text-muted mt-0.5 truncate">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0 pt-0.5">{right}</div>}
    </button>
  );
}

/* ---------- detail helpers ---------- */

export function DetailEmpty({ label = 'Select an item to see details.' }: { label?: string }) {
  return (
    <div className="h-full min-h-[40vh] flex items-center justify-center p-10 text-text-muted text-sm">
      {label}
    </div>
  );
}

export function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="py-2.5 border-b border-border/60">
      <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-sm mt-1 break-words ${mono ? 'font-mono' : ''}`}>{children}</div>
    </div>
  );
}

export function ListState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-text-muted text-sm">{children}</p>;
}
