import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthProvider';
import { supabase } from '../lib/supabase';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/videos', label: 'Videos' },
  { to: '/users', label: 'Users' },
  { to: '/payments', label: 'Payments' },
  { to: '/referrals', label: 'Referrals' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
];

function Mark() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <defs>
          <linearGradient id="tbLogo" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FF651C" />
            <stop offset="0.5" stopColor="#FD3667" />
            <stop offset="1" stopColor="#7D27E3" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="11" stroke="url(#tbLogo)" strokeWidth="3" />
        <path d="M16.5 14.5L26 20L16.5 25.5V14.5Z" fill="url(#tbLogo)" />
      </svg>
      <span className="font-display font-semibold text-[13px] tracking-tight">
        Reel<span className="brand-gradient-text">Spark</span>
      </span>
    </div>
  );
}

function useVitals() {
  return useQuery({
    queryKey: ['vitals'],
    refetchInterval: 60000,
    queryFn: async () => {
      const [pending, reports] = await Promise.all([
        supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('is_deleted', false),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return { pending: pending.count ?? 0, reports: reports.count ?? 0 };
    },
  });
}

function Vitals({ className = '' }: { className?: string }) {
  const { data } = useVitals();
  const items = [
    ['pending', data?.pending ?? 0, 'text-pink'],
    ['reports', data?.reports ?? 0, 'text-orange'],
  ] as const;
  return (
    <div className={`flex items-center gap-3 font-mono text-[11px] ${className}`}>
      {items.map(([label, n, color]) => (
        <span key={label} className="flex items-center gap-1">
          <span className={n ? color : 'text-text-muted'}>{n}</span>
          <span className="text-text-muted">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function Layout() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-2.5 py-1.5 text-[13px] font-medium rounded transition-colors ${
      isActive ? 'text-text' : 'text-text-muted hover:text-text'
    } ${isActive ? 'after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:bg-pink after:rounded-full' : ''}`;

  return (
    <div className="min-h-dvh bg-bg">
      {/* top strip */}
      <div className="sticky top-0 z-40 bg-bg">
        <div className="h-12 flex items-center gap-4 px-3 sm:px-4">
          <Mark />

          {/* desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 md:hidden" />

          <Vitals className="hidden sm:flex" />

          <div className="hidden md:flex items-center gap-3 pl-3 border-l border-border">
            <span className="text-[11px] text-text-muted max-w-[160px] truncate">{profile?.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-[11px] font-semibold text-coral hover:underline"
            >
              Log out
            </button>
          </div>

          {/* mobile menu toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="md:hidden p-1.5 -mr-1.5 rounded text-text-muted hover:text-text hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* brand-gradient hairline */}
        <div className="h-px brand-gradient opacity-70" />

        {/* mobile drawer */}
        {open && (
          <div className="md:hidden border-b border-border bg-bg px-2 py-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm font-medium ${
                    isActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface hover:text-text'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-border">
              <span className="text-[11px] text-text-muted truncate">{profile?.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-[11px] font-semibold text-coral"
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
