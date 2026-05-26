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

  const field = "w-full rounded-lg border border-vline2 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-emerald";

  return (
    <div className="grid h-screen grid-cols-1 bg-paper lg:grid-cols-2">
      {/* Brand panel — deep ink (the dark product side) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex">
        <button onClick={onBack} className="flex items-center gap-2.5 self-start">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper/10">
            <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2" style={{ borderColor: "#5fe0b8" }} />
          </span>
          <span className="font-serif text-lg font-semibold">orchestra</span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 font-plex text-[10px] uppercase tracking-wider text-white/50">by yuno</span>
        </button>

        <div className="max-w-md">
          <div className="font-plex text-[11px] uppercase tracking-[0.2em]" style={{ color: "#5fe0b8" }}>Agentic infrastructure</div>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight">
            The control plane for your payment agents.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Build, test, fine-tune, deploy, and evolve multi-agent workflows — on a real
            runtime, connected to your channels, with live cost and guardrails.
          </p>
          <div className="mt-8 rounded-xl bg-bg0 p-4"><OrchestrationDiagram /></div>
        </div>

        <div className="font-plex text-[10px] text-white/35">Built for the Yuno AI Engineer hiring challenge</div>
      </div>

      {/* Form — paper */}
      <div className="relative flex items-center justify-center p-6">
        <form onSubmit={submit} className="relative z-10 w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink">
              <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2" style={{ borderColor: "#15936f" }} />
            </span>
            <span className="font-serif text-lg font-semibold text-ink">orchestra</span>
          </div>

          <h1 className="font-serif text-3xl font-semibold text-ink">Sign in to the console</h1>
          <p className="mt-1.5 text-sm text-inkmut">Welcome back. Enter your credentials to continue.</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block font-plex text-[11px] uppercase tracking-wide text-inkmut">Username</label>
              <input className={field} value={username} autoComplete="username"
                onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block font-plex text-[11px] uppercase tracking-wide text-inkmut">Password</label>
              <input type="password" className={field} value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {err && <div className="mt-4 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">{err}</div>}

          <button type="submit" disabled={busy}
            className="mt-6 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper transition hover:-translate-y-px hover:bg-ink2 disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in →"}
          </button>

          <div className="mt-5 rounded-lg border border-vline bg-sand px-3.5 py-2.5 font-plex text-[11px] text-inkmut">
            <span className="text-ink">Demo access</span> — username <span className="text-emerald">admin</span> · password <span className="text-emerald">orchestra</span>
            <div className="mt-1 text-inkdim">(configurable via AUTH_USERNAME / AUTH_PASSWORD in .env)</div>
          </div>

          <button type="button" onClick={onBack} className="mt-6 text-sm text-inkmut hover:text-ink">← Back to site</button>
        </form>
      </div>
    </div>
  );
}
