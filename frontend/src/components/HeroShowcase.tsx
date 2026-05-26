import { useEffect, useState } from "react";

// Hero visual: an abstract, living "agent constellation" — glowing orbs (agents,
// tools, runtime) connected by flowing light threads, with brand-dot packets
// travelling between them (A2A traffic). Wrapped in a console frame with a
// cycling lifecycle ribbon, an A2A message ticker, and a live observability
// footer. Deliberately abstract (no labelled boxes) and distinct from the
// labelled OrchestrationDiagram used in the How-it-works section.

const VB = { w: 1000, h: 430 };

type Orb = { id: number; x: number; y: number; r: number; c: string };
const ORBS: Orb[] = [
  { id: 0, x: 110, y: 215, r: 6, c: "#e8c07d" },
  { id: 1, x: 248, y: 138, r: 10, c: "#2bf5b8" },
  { id: 2, x: 262, y: 300, r: 8, c: "#38d6ff" },
  { id: 3, x: 430, y: 208, r: 15, c: "#2bf5b8" }, // hub
  { id: 4, x: 602, y: 120, r: 9, c: "#2bf5b8" },
  { id: 5, x: 616, y: 302, r: 11, c: "#38d6ff" },
  { id: 6, x: 778, y: 178, r: 8, c: "#2bf5b8" },
  { id: 7, x: 828, y: 312, r: 6, c: "#ffc15e" },
  { id: 8, x: 908, y: 214, r: 13, c: "#2bf5b8" }, // sink / runtime
];
const BY = Object.fromEntries(ORBS.map((o) => [o.id, o]));

type Edge = { a: number; b: number; a2a?: boolean };
const EDGES: Edge[] = [
  { a: 0, b: 1 }, { a: 0, b: 2 },
  { a: 1, b: 3 }, { a: 2, b: 3 },
  { a: 1, b: 2, a2a: true },
  { a: 3, b: 4 }, { a: 3, b: 5 },
  { a: 4, b: 5, a2a: true },
  { a: 4, b: 6 }, { a: 5, b: 6 }, { a: 5, b: 7 },
  { a: 4, b: 8 }, { a: 6, b: 8 }, { a: 7, b: 8 },
];

// orbs lit, in sequence, to suggest execution flowing through the mesh
const SEQ = [0, 1, 3, 5, 4, 6, 8];
const LIFE = ["Build", "Test", "Fine-tune", "Deploy", "Evolve"];
const CHATTER = [
  ["triage → router", "intent = refund · 0.94"],
  ["agent ↔ agent", "negotiating refund · A2A"],
  ["refund ↔ ledger", "verify duplicate charge (A2A)"],
  ["runtime", "checkpoint persisted · resumable"],
  ["monitor → MLflow", "trace flushed · p95 812ms"],
];

const edgePath = (e: Edge) => {
  const a = BY[e.a], b = BY[e.b];
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
};

export function HeroShowcase() {
  const [tick, setTick] = useState(0);
  const [life, setLife] = useState(0);
  const [chat, setChat] = useState(0);
  const [obs, setObs] = useState({ tokens: 1840, cost: 0.0012, traces: 12, p95: 812 });
  const [spark, setSpark] = useState<number[]>(() => Array.from({ length: 22 }, () => 22 + Math.random() * 60));

  useEffect(() => {
    const t = setInterval(() => {
      setTick((k) => (k + 1) % SEQ.length);
      setChat((c) => (c + 1) % CHATTER.length);
      const d = 90 + Math.floor(Math.random() * 360);
      setObs((o) => ({
        tokens: o.tokens + d,
        cost: +(o.cost + d * 0.0000028).toFixed(4),
        traces: o.traces + (Math.random() > 0.55 ? 1 : 0),
        p95: 760 + Math.floor(Math.random() * 140),
      }));
      setSpark((s) => [...s.slice(1), 20 + Math.random() * 64]);
    }, 1200);
    const l = setInterval(() => setLife((x) => (x + 1) % LIFE.length), 1700);
    return () => { clearInterval(t); clearInterval(l); };
  }, []);

  const activeId = SEQ[tick];
  const [who, what] = CHATTER[chat];

  return (
    <div className="rounded-2xl border border-vline2 bg-ink p-3 shadow-[0_40px_90px_-30px_rgba(20,24,28,.5)]">
      {/* window chrome */}
      <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-t2">yunoflow · live orchestration</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-mint">
          <span className="h-1.5 w-1.5 rounded-full bg-mint soft-pulse" /> running
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-bg0">
        {/* Lifecycle ribbon */}
        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-t3">lifecycle</span>
          {LIFE.map((s, i) => {
            const on = i === life;
            const done = i < life;
            return (
              <span key={s} className="flex items-center gap-1">
                <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition-all duration-500 ${
                  on ? "bg-mint/15 text-mint shadow-[0_0_0_1px_rgba(43,245,184,.4)]"
                     : done ? "text-mint/55" : "text-t3"}`}>{s}</span>
                {i < LIFE.length - 1 && <span className={`text-[9px] ${i < life ? "text-mint/40" : "text-t3"}`}>→</span>}
              </span>
            );
          })}
          <span className="ml-auto h-1 w-1 rounded-full bg-mint soft-pulse" />
        </div>

        {/* Abstract agent constellation */}
        <div className="relative aspect-[1000/430] w-full">
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="hs-flow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#38d6ff" /><stop offset="1" stopColor="#2bf5b8" />
              </linearGradient>
              <radialGradient id="hs-core" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#2bf5b8" stopOpacity="0.9" />
                <stop offset="1" stopColor="#2bf5b8" stopOpacity="0" />
              </radialGradient>
              <pattern id="hs-dots" width="34" height="34" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.1" fill="rgba(255,255,255,.05)" />
              </pattern>
            </defs>

            {/* textured field + soft glow behind the hub */}
            <rect width={VB.w} height={VB.h} fill="url(#hs-dots)" />
            <circle cx="460" cy="215" r="240" fill="url(#hs-core)" opacity="0.10" />

            {/* threads */}
            {EDGES.map((e, i) => {
              const d = edgePath(e);
              const live = e.a === activeId || e.b === activeId;
              const stroke = live ? "url(#hs-flow)" : e.a2a ? "rgba(56,214,255,.30)" : "rgba(255,255,255,.12)";
              return (
                <g key={`e${i}`}>
                  <path id={`hs-e${i}`} d={d} fill="none" stroke={stroke}
                    strokeWidth={live ? 2.4 : 1.3} strokeDasharray={e.a2a ? "5 7" : undefined}
                    className={live ? "flow-line" : ""} />
                  <circle r={e.a2a ? 3.4 : 3} fill={e.a2a ? "#38d6ff" : "url(#hs-flow)"} opacity={live ? 1 : 0.5}>
                    <animateMotion dur={`${e.a2a ? 2.6 : 1.9}s`} repeatCount="indefinite" begin={`${i * 0.22}s`}>
                      <mpath href={`#hs-e${i}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

            {/* orbs: breathing halo + ring + center spark */}
            {ORBS.map((o) => {
              const live = o.id === activeId;
              return (
                <g key={`o${o.id}`}>
                  {/* breathing halo */}
                  <circle cx={o.x} cy={o.y} r={o.r} fill="none" stroke={o.c} strokeWidth="1.4">
                    <animate attributeName="r" values={`${o.r};${o.r + 15};${o.r}`} dur="3.4s"
                      begin={`${o.id * 0.32}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.55;0;0.55" dur="3.4s"
                      begin={`${o.id * 0.32}s`} repeatCount="indefinite" />
                  </circle>
                  {/* active burst */}
                  {live && (
                    <circle cx={o.x} cy={o.y} r={o.r} fill="none" stroke={o.c} strokeWidth="2">
                      <animate attributeName="r" values={`${o.r};${o.r + 26}`} dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* ring body */}
                  <circle cx={o.x} cy={o.y} r={o.r} fill={o.c} fillOpacity={live ? 0.22 : 0.12}
                    stroke={o.c} strokeWidth={live ? 2.4 : 1.6} strokeOpacity={live ? 1 : 0.7} />
                  {/* center spark */}
                  <circle cx={o.x} cy={o.y} r={Math.max(2, o.r * 0.34)} fill={o.c} fillOpacity={live ? 1 : 0.8} />
                </g>
              );
            })}
          </svg>

          {/* floating A2A message ticker */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-lg border border-line2 bg-bg2/85 px-2.5 py-1.5 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan soft-pulse" />
            <span className="font-mono text-[10px] text-t0">{who}</span>
            <span className="font-mono text-[10px] text-t2">· {what}</span>
          </div>
        </div>

        {/* Observability footer */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1.3fr] items-end gap-2 border-t border-line px-4 py-3">
          <Metric label="tokens" value={obs.tokens.toLocaleString()} />
          <Metric label="live cost" value={`$${obs.cost.toFixed(4)}`} accent />
          <Metric label="traces" value={String(obs.traces)} />
          <div>
            <div className="font-mono text-[10px] text-t2">throughput · p95 {obs.p95}ms</div>
            <div className="mt-1 flex h-7 items-end gap-[3px]">
              {spark.map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-cyan/30 to-mint/80"
                  style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-t2">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${accent ? "text-mint" : "text-t0"}`}>{value}</div>
    </div>
  );
}
