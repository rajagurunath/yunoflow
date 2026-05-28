import { YunoMark } from "./YunoMark";

export type PublicPage = "landing" | "pricing" | "docs";

function Mark() {
  return <YunoMark className="h-8 w-8" />;
}

export function PublicNav({ onNav, onSignIn, current }: {
  onNav: (p: PublicPage) => void; onSignIn: () => void; current: PublicPage;
}) {
  const link = "text-sm text-inkmut transition hover:text-ink";
  return (
    <header className="sticky top-0 z-50 border-b border-vline bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <button onClick={() => onNav("landing")} className="flex items-center gap-2.5">
          <Mark />
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">YunoFlow</span>
        </button>
        <nav className="hidden flex-1 items-center gap-7 md:flex">
          <a href="#how" onClick={() => onNav("landing")} className={link}>How it works</a>
          <a href="#lifecycle" onClick={() => onNav("landing")} className={link}>Lifecycle</a>
          <a href="#usecases" onClick={() => onNav("landing")} className={link}>Use cases</a>
          <button onClick={() => onNav("docs")} className={`${link} ${current === "docs" ? "text-ink" : ""}`}>Docs</button>
          <button onClick={() => onNav("pricing")} className={`${link} ${current === "pricing" ? "text-ink" : ""}`}>Pricing</button>
        </nav>
        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <button onClick={onSignIn} className={link}>Sign in</button>
          <button onClick={onSignIn}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:-translate-y-px hover:bg-ink2">
            Open console
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const col = "flex flex-col gap-2";
  const link = "text-left text-sm text-inkmut transition hover:text-ink";
  return (
    <footer className="border-t border-vline bg-sand">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-5">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-serif text-base font-semibold text-ink">YunoFlow</span>
          </div>
          <p className="mt-3 max-w-[15rem] text-sm text-inkmut">
            The lifecycle platform for agentic systems — built for payments teams.
          </p>
        </div>
        <div className={col}>
          <div className="mb-1 font-plex text-[11px] uppercase tracking-wider text-inkdim">Platform</div>
          <button className={link} onClick={() => onNav("landing")}>How it works</button>
          <button className={link} onClick={() => onNav("landing")}>Lifecycle</button>
          <button className={link} onClick={() => onNav("landing")}>Use cases</button>
          <button className={link} onClick={onSignIn}>Console</button>
        </div>
        <div className={col}>
          <div className="mb-1 font-plex text-[11px] uppercase tracking-wider text-inkdim">Pricing</div>
          <button className={link} onClick={() => onNav("pricing")}>Plans</button>
          <button className={link} onClick={() => onNav("pricing")}>Usage estimator</button>
          <button className={link} onClick={() => onNav("pricing")}>Enterprise</button>
        </div>
        <div className={col}>
          <div className="mb-1 font-plex text-[11px] uppercase tracking-wider text-inkdim">Docs</div>
          <button className={link} onClick={() => onNav("docs")}>Overview</button>
          <button className={link} onClick={() => onNav("docs")}>Quickstart</button>
          <button className={link} onClick={() => onNav("docs")}>Agent dimensions</button>
          <button className={link} onClick={() => onNav("docs")}>API reference</button>
        </div>
        <div className={col}>
          <div className="mb-1 font-plex text-[11px] uppercase tracking-wider text-inkdim">Channels</div>
          <span className="text-sm text-inkmut">Telegram</span>
          <span className="text-sm text-inkmut">Slack · WhatsApp <span className="text-inkdim">(soon)</span></span>
          <span className="text-sm text-inkmut">REST · WebSocket · A2A</span>
        </div>
      </div>
      <div className="border-t border-vline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-center md:flex-row md:text-left">
          <span className="font-plex text-[11px] text-inkdim">© 2026 YunoFlow · A demo built for the Yuno AI Engineer hiring challenge.</span>
          <span className="font-plex text-[11px] text-inkdim">Not affiliated with Yuno · illustrative pricing</span>
        </div>
      </div>
    </footer>
  );
}
