import { useEffect, useState } from "react";

type Node = { id: string; x: number; y: number; label: string; kind: string; glyph: string; accent: string };

const NODES: Node[] = [
  { id: "telegram", x: 7, y: 50, label: "Telegram", kind: "Channel", glyph: "✈", accent: "#e8c07d" },
  { id: "triage", x: 30, y: 50, label: "Triage", kind: "Agent", glyph: "◎", accent: "#2bf5b8" },
  { id: "route", x: 52, y: 50, label: "Router", kind: "Condition", glyph: "⟁", accent: "#ffc15e" },
  { id: "refund", x: 76, y: 20, label: "Refund Agent", kind: "Agent", glyph: "◎", accent: "#2bf5b8" },
  { id: "pay", x: 76, y: 80, label: "Payment · AP2", kind: "Tool", glyph: "⛁", accent: "#38d6ff" },
  { id: "monitor", x: 95, y: 50, label: "Monitor", kind: "Runtime", glyph: "⠿", accent: "#2bf5b8" },
];

const EDGES: [string, string][] = [
  ["telegram", "triage"], ["triage", "route"],
  ["route", "refund"], ["route", "pay"],
  ["refund", "monitor"], ["pay", "monitor"],
];

// the "live" path the pulse travels, to show data flowing through the graph
const SEQUENCE = ["telegram", "triage", "route", "refund", "monitor"];

const W = 1000, H = 420;
const cx = (n: Node) => (n.x / 100) * W;
const cy = (n: Node) => (n.y / 100) * H;

export function OrchestrationDiagram() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % SEQUENCE.length), 1100);
    return () => clearInterval(t);
  }, []);
  const activeId = SEQUENCE[active];
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <div className="relative aspect-[1000/420] w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="od-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#38d6ff" /><stop offset="1" stopColor="#2bf5b8" />
          </linearGradient>
        </defs>
        {EDGES.map(([a, b], i) => {
          const na = byId[a], nb = byId[b];
          const x1 = cx(na), y1 = cy(na), x2 = cx(nb), y2 = cy(nb);
          const mx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          const live = activeId === a || activeId === b;
          return (
            <path key={i} d={d} fill="none"
              stroke={live ? "url(#od-flow)" : "rgba(255,255,255,.12)"}
              strokeWidth={live ? 2.5 : 1.5}
              className={live ? "flow-line" : ""} />
          );
        })}
      </svg>

      {NODES.map((n) => {
        const live = n.id === activeId;
        return (
          <div key={n.id} style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2">
            <div className={`flex w-[118px] flex-col items-center gap-1 rounded-xl border bg-bg2/90 px-2 py-2 text-center backdrop-blur transition ${
              live ? "border-mint/60 shadow-glow" : "border-line2"}`}>
              <span className="grid h-7 w-7 place-items-center rounded-lg text-sm"
                style={{ background: `${n.accent}22`, color: n.accent }}>{n.glyph}</span>
              <span className="font-disp text-[12px] leading-none text-t0">{n.label}</span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-t2">{n.kind}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
