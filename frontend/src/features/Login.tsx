import { useState } from "react";
import { auth } from "../lib/auth";
import { OrchestrationDiagram } from "../components/OrchestrationDiagram";

export function Login({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("orchestra");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await auth.login(username, password);
      onSuccess();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-line2 bg-bg1 px-3.5 py-2.5 text-sm text-t0 outline-none transition focus:border-mint/60";

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hero-glow relative hidden flex-col justify-between overflow-hidden border-r border-line bg-bg1 p-10 lg:flex">
        <button onClick={onBack} className="flex items-center gap-2.5 self-start">
          <span className="grid h-8 w-8 place-items-center rounded-lg grad shadow-glow">
            <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
          </span>
          <span className="font-disp text-base font-semibold">orchestra</span>
          <span className="rounded-full border border-line2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-t2">by yuno</span>
        </button>

        <div className="max-w-md">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-mint">Agentic infrastructure</div>
          <h2 className="mt-3 font-disp text-3xl font-semibold leading-tight">
            The control plane for your payment agents.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-t1">
            Build, test, fine-tune, deploy, and evolve multi-agent workflows — on a real
            runtime, connected to your channels, with live cost and guardrails.
          </p>
          <div className="mt-8 opacity-90"><OrchestrationDiagram /></div>
        </div>

        <div className="font-mono text-[10px] text-t3">Built for the Yuno AI Engineer hiring challenge</div>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center bg-bg0 p-6">
        <div className="bg-atmos pointer-events-none absolute inset-0 lg:hidden" />
        <form onSubmit={submit} className="relative z-10 w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg grad shadow-glow">
              <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
            </span>
            <span className="font-disp text-base font-semibold">orchestra</span>
          </div>

          <h1 className="font-disp text-2xl font-semibold">Sign in to the console</h1>
          <p className="mt-1 text-sm text-t2">Welcome back. Enter your credentials to continue.</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-t2">Username</label>
              <input className={field} value={username} autoComplete="username"
                onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-t2">Password</label>
              <input type="password" className={field} value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {err && <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{err}</div>}

          <button type="submit" disabled={busy}
            className="mt-6 w-full rounded-lg grad py-2.5 text-sm font-bold text-[#04110d] shadow-glow transition hover:-translate-y-px disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in →"}
          </button>

          <div className="mt-5 rounded-lg border border-line bg-bg2/60 px-3.5 py-2.5 font-mono text-[11px] text-t2">
            <span className="text-t1">Demo access</span> — username <span className="text-mint">admin</span> · password <span className="text-mint">orchestra</span>
            <div className="mt-1 text-t3">(configurable via AUTH_USERNAME / AUTH_PASSWORD in .env)</div>
          </div>

          <button type="button" onClick={onBack} className="mt-6 text-sm text-t2 hover:text-t0">← Back to site</button>
        </form>
      </div>
    </div>
  );
}
