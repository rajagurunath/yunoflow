import React from "react";
import type { View } from "../App";

// [view, glyph, label, one-line description]
const NAV: [View, string, string, string][] = [
  ["templates", "◆", "Templates", "Start from a prebuilt workflow"],
  ["studio", "◎", "Agents", "Create & configure agents"],
  ["builder", "⟁", "Workflows", "Build, run & monitor visually"],
  ["history", "≡", "History", "Past runs & transcripts"],
  ["channels", "✈", "Channels", "Connect Telegram"],
];

export function Shell({ view, setView, children, onSignOut }: {
  view: View; setView: (v: View) => void; children: React.ReactNode; onSignOut?: () => void;
}) {
  return (
    <div className="theme-light relative flex h-screen bg-bg0">
      <nav className="relative z-10 flex w-52 flex-col gap-1 border-r border-line bg-bg2/80 p-3">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <div className="grid h-8 w-8 place-items-center rounded-lg grad shadow-glow">
            <span className="block h-3 w-3 rotate-45 rounded-[2px] border-2 border-[#04110d]" />
          </div>
          <div className="leading-tight">
            <div className="font-disp text-sm font-semibold">orchestra</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-t2">by yuno</div>
          </div>
        </div>

        {NAV.map(([key, glyph, label, desc]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            title={desc}
            className={`flex items-start gap-3 rounded-lg px-3 py-2 text-left transition ${
              view === key ? "bg-mint/10 text-mint" : "text-t1 hover:bg-bg3 hover:text-t0"}`}
          >
            <span className="mt-0.5 w-4 text-center text-base leading-none">{glyph}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className={`block text-[10px] leading-tight ${view === key ? "text-mint/60" : "text-t3"}`}>{desc}</span>
            </span>
          </button>
        ))}

        <div className="mt-auto flex flex-col gap-2">
          {onSignOut && (
            <button onClick={onSignOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-t2 transition hover:bg-bg3 hover:text-coral">
              <span className="w-4 text-center text-base leading-none">⎋</span>
              <span className="text-sm font-medium">Sign out</span>
            </button>
          )}
          <div className="px-2 font-mono text-[9px] leading-relaxed text-t3">API :8000 · UI :5173</div>
        </div>
      </nav>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-bg2/70 px-5 backdrop-blur-md">
          <span className="font-mono text-xs text-t2">AI Agent Orchestration Platform</span>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
