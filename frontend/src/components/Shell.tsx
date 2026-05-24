import React from "react";
import type { View } from "../App";

const NAV: [View, string, string][] = [
  ["templates", "◆", "Templates"],
  ["studio", "◎", "Agents"],
  ["builder", "⟁", "Workflows"],
  ["history", "≡", "History"],
  ["channels", "✈", "Channels"],
];

export function Shell({ view, setView, children }: {
  view: View; setView: (v: View) => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-atmos relative flex h-screen">
      <nav className="relative z-10 flex w-16 flex-col items-center gap-2 border-r border-line bg-bg2/80 py-4">
        <div className="mb-2 grid h-7 w-7 place-items-center rounded-lg grad shadow-glow">
          <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
        </div>
        {NAV.map(([key, glyph, label]) => (
          <button key={key} title={label} onClick={() => setView(key)}
            className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition ${
              view === key ? "bg-mint/10 text-mint" : "text-t2 hover:bg-bg3 hover:text-t0"}`}>
            {glyph}
          </button>
        ))}
      </nav>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-bg2/70 px-5 backdrop-blur-md">
          <span className="font-disp text-base font-semibold tracking-wide">orchestra</span>
          <span className="rounded-full border border-line2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-t2">by yuno</span>
          <span className="ml-1 font-mono text-xs text-t2">AI Agent Orchestration Platform</span>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
