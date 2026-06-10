import { PublicFooter, PublicNav, type PublicPage } from "../components/PublicChrome";
import { DEMO_VIDEO_URL, SOURCE_URL } from "../lib/config";

/* Shown in place of the sign-in / console flow once the backend has been retired.
 * The stateful backend (LangGraph runtime, Telegram, scheduler, WebSocket
 * streaming) ran on a VM that's now shut down; the static frontend stays live as
 * a showcase. This explains that plainly and points to the docs, demo, and code. */

const WHAT_RAN = [
  ["Always-on LangGraph runtime", "Multi-agent workflows executing on a real StateGraph with persistence and interrupt/resume."],
  ["Telegram + human-in-the-loop", "Two-bot approval flow — a run pauses and pings a human, who approves from chat or the console."],
  ["Scheduler & WebSocket streaming", "APScheduler cron jobs and a live event bus streaming every message, token and dollar."],
];

export function DemoRetired({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const cta = "rounded-lg px-5 py-3 text-sm font-semibold transition hover:-translate-y-px";
  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicNav onNav={onNav} onSignIn={onSignIn} current="landing" />

      <section className="vault-glow mx-auto max-w-3xl px-6 pb-24 pt-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-vline2 bg-paper px-3 py-1 font-plex text-[11px] uppercase tracking-[0.18em] text-goldv">
          <span className="h-1.5 w-1.5 rounded-full bg-goldv" /> Live demo retired
        </div>

        <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.01em] md:text-[3rem]">
          The live console is offline.
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-inkmut">
          YunoFlow was built for the <span className="text-ink">Yuno AI Engineer hiring challenge</span>.
          The interactive console ran against a stateful backend — an always-on agent
          runtime, Telegram bots, a scheduler and WebSocket streaming — hosted on a VM that
          has now been shut down to stop incurring cost. This site stays up as a showcase.
        </p>

        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-inkmut">
          Everything the console did is still fully documented, and the entire codebase is open.
          The <button onClick={() => onNav("docs")} className="text-emerald underline-offset-2 hover:underline">documentation</button> walks
          through the architecture, the 14 agent dimensions, and the design decisions end to end.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <button onClick={() => onNav("docs")} className={`${cta} bg-ink text-paper hover:bg-ink2`}>
            Read the docs →
          </button>
          <a href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" className={`${cta} border border-vline2 text-ink hover:bg-sand`}>
            Watch the 5-min demo ↗
          </a>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={`${cta} border border-vline2 text-ink hover:bg-sand`}>
            View the source ↗
          </a>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-vline bg-vline sm:grid-cols-3">
          {WHAT_RAN.map(([title, desc]) => (
            <div key={title} className="bg-paper p-5">
              <div className="font-serif text-[15px] text-ink">{title}</div>
              <div className="mt-1.5 text-[13px] leading-snug text-inkmut">{desc}</div>
            </div>
          ))}
        </div>

        <button onClick={() => onNav("landing")} className="mt-10 text-sm text-inkmut transition hover:text-ink">
          ← Back to site
        </button>
      </section>

      <PublicFooter onNav={onNav} onSignIn={onSignIn} />
    </div>
  );
}
