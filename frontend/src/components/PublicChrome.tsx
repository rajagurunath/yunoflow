export type PublicPage = "landing" | "pricing";

export function PublicNav({ onNav, onSignIn, current }: {
  onNav: (p: PublicPage) => void; onSignIn: () => void; current: PublicPage;
}) {
  const link = "text-sm text-t1 transition hover:text-t0";
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg0/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <button onClick={() => onNav("landing")} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg grad shadow-glow">
            <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
          </span>
          <span className="font-disp text-base font-semibold tracking-wide">orchestra</span>
          <span className="hidden rounded-full border border-line2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-t2 sm:inline">by yuno</span>
        </button>
        <nav className="hidden flex-1 items-center gap-7 md:flex">
          <a href="#how" onClick={() => onNav("landing")} className={link}>How it works</a>
          <a href="#lifecycle" onClick={() => onNav("landing")} className={link}>Lifecycle</a>
          <a href="#usecases" onClick={() => onNav("landing")} className={link}>Use cases</a>
          <button onClick={() => onNav("pricing")} className={`${link} ${current === "pricing" ? "text-t0" : ""}`}>Pricing</button>
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <button onClick={onSignIn} className={link}>Sign in</button>
          <button onClick={onSignIn}
            className="rounded-lg grad px-4 py-2 text-sm font-bold text-[#04110d] shadow-glow transition hover:-translate-y-px">
            Open console
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const col = "flex flex-col gap-2";
  const link = "text-sm text-t2 transition hover:text-t1 text-left";
  return (
    <footer className="border-t border-line bg-bg1">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg grad">
              <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
            </span>
            <span className="font-disp text-sm font-semibold">orchestra</span>
          </div>
          <p className="mt-3 max-w-[15rem] text-sm text-t2">
            The lifecycle platform for agentic systems — built for payments teams.
          </p>
        </div>
        <div className={col}>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-t3">Platform</div>
          <button className={link} onClick={() => onNav("landing")}>How it works</button>
          <button className={link} onClick={() => onNav("landing")}>Lifecycle</button>
          <button className={link} onClick={() => onNav("landing")}>Use cases</button>
          <button className={link} onClick={onSignIn}>Console</button>
        </div>
        <div className={col}>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-t3">Pricing</div>
          <button className={link} onClick={() => onNav("pricing")}>Plans</button>
          <button className={link} onClick={() => onNav("pricing")}>Usage estimator</button>
          <button className={link} onClick={() => onNav("pricing")}>Enterprise</button>
        </div>
        <div className={col}>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-t3">Channels</div>
          <span className="text-sm text-t2">Telegram</span>
          <span className="text-sm text-t2">Slack · WhatsApp <span className="text-t3">(soon)</span></span>
          <span className="text-sm text-t2">REST · WebSocket · A2A</span>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-center md:flex-row md:text-left">
          <span className="font-mono text-[11px] text-t3">© 2026 Orchestra · A demo built for the Yuno AI Engineer hiring challenge.</span>
          <span className="font-mono text-[11px] text-t3">Not affiliated with Yuno · illustrative pricing</span>
        </div>
      </div>
    </footer>
  );
}
