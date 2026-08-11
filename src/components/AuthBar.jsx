import { useState } from 'react';

export default function AuthBar({ authenticated, configured, onLogin, onLogout }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(password);
      setPassword('');
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-xs text-[var(--danger)]">
        Set <code className="text-[var(--text)]">AUTH_PASSWORD</code> on the server to lock edits.
      </p>
    );
  }

  if (authenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Signed in</span>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          Log out
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--accent)]"
      >
        Log in to edit
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
      >
        {busy ? '…' : 'Unlock'}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setPassword('');
          setError('');
        }}
        className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
      >
        Cancel
      </button>
      {error && <span className="w-full text-xs text-[var(--danger)]">{error}</span>}
    </form>
  );
}
