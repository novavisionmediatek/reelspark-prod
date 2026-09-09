import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';

export function Login() {
  const { session, profile, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  }

  const notAuthorized = session && profile && !isAdmin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="logoGrad" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FF651C" />
                <stop offset="0.5" stopColor="#FD3667" />
                <stop offset="1" stopColor="#7D27E3" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="36" height="36" rx="11" stroke="url(#logoGrad)" strokeWidth="2.6" />
            <path d="M16.5 14.5L26 20L16.5 25.5V14.5Z" fill="url(#logoGrad)" />
          </svg>
          <span className="font-display font-semibold text-lg">
            Reel<span className="brand-gradient-text">Spark</span> Admin
          </span>
        </div>

        {notAuthorized ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
            <p className="text-text font-medium">Not authorized</p>
            <p className="text-text-muted text-sm">
              This account ({session.user.email}) doesn't have admin access. Ask an existing admin to grant it,
              or sign in with an admin account.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-pink text-sm font-medium hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-pink transition-colors"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-pink transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-coral text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full brand-gradient text-white font-semibold text-sm py-2.5 rounded-lg disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="text-center text-text-muted text-xs mt-6">
          Admin accounts are provisioned manually — there's no public sign-up here.
        </p>
      </div>
    </div>
  );
}
