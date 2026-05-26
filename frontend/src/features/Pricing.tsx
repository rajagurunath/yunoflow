import { useMemo, useState } from "react";
import { PublicFooter, PublicNav, type PublicPage } from "../components/PublicChrome";

// Marginal token pricing schedule (per 1M tokens) — the rate drops at volume.
const TIERS = [
  { upTo: 1, rate: 0, label: "first 1M" },
  { upTo: 25, rate: 9, label: "1M – 25M" },
  { upTo: 200, rate: 7, label: "25M – 200M" },
  { upTo: 1000, rate: 5, label: "200M – 1B" },
  { upTo: Infinity, rate: 3, label: "1B+" },
];

function billFor(millions: number) {
  let remaining = millions, total = 0, prev = 0;
  for (const t of TIERS) {
    const span = Math.max(0, Math.min(remaining, t.upTo - prev));
    total += span * t.rate;
    remaining -= span; prev = t.upTo;
    if (remaining <= 0) break;
  }
  return total;
}

function recommend(millions: number) {
  if (millions <= 1) return "Developer";
  if (millions <= 25) return "Team";
  if (millions <= 400) return "Scale";
  return "Enterprise";
}

const PLANS = [
  {
    name: "Developer", price: "$0", unit: "/mo", tagline: "Prototype & learn",
    included: "1M tokens / mo", overage: "then pay-as-you-go",
    features: ["1 workspace", "Visual builder + real runtime", "Telegram channel", "Community support"],
    cta: "Start free", highlight: false,
  },
  {
    name: "Team", price: "$99", unit: "/mo", tagline: "Ship your first agents",
    included: "25M tokens / mo", overage: "$8 / 1M overage",
    features: ["5 workspaces", "All built-in tools + AP2 mock", "Guardrails & cost caps", "Email support"],
    cta: "Choose Team", highlight: false,
  },
  {
    name: "Scale", price: "$499", unit: "/mo", tagline: "Run production operations",
    included: "200M tokens / mo", overage: "$5 / 1M overage",
    features: ["Unlimited workspaces", "Durable execution (DBOS)", "MLflow observability", "SSO + audit log", "Priority support"],
    cta: "Choose Scale", highlight: true,
  },
  {
    name: "Enterprise", price: "Custom", unit: "", tagline: "Committed volume",
    included: "Volume token commits", overage: "from $3 / 1M",
    features: ["VPC / on-prem deploy", "Declining-rate commits", "Compliance & DPA", "Dedicated solutions engineer"],
    cta: "Talk to us", highlight: false,
  },
];

export function Pricing({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const [tokensM, setTokensM] = useState(120);
  const bill = useMemo(() => billFor(tokensM), [tokensM]);
  const blended = tokensM > 0 ? bill / tokensM : 0;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicNav onNav={onNav} onSignIn={onSignIn} current="pricing" />

      <section className="vault-glow relative mx-auto max-w-6xl px-6 pb-12 pt-20 text-center">
        <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Usage-based pricing</div>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-semibold leading-[1.06] tracking-[-0.01em] md:text-[3.2rem]">
          Pay for the tokens your agents <em className="italic text-emerald-grad">actually</em> use.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-inkmut">
          A small platform fee plus included tokens — and the more your agents run, the lower the
          per-token rate. No seats, no surprises. Scale from a prototype to billions of tokens.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                p.highlight ? "border-emerald bg-emerald/[0.06] shadow-[0_24px_60px_-30px_rgba(13,110,84,.6)]" : "border-vline bg-paper"}`}>
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald px-2.5 py-0.5 font-plex text-[10px] font-bold uppercase tracking-wider text-paper">
                  Most popular
                </span>
              )}
              <div className="font-serif text-xl text-ink">{p.name}</div>
              <div className="mt-0.5 text-sm text-inkmut">{p.tagline}</div>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-serif text-4xl font-semibold text-ink">{p.price}</span>
                <span className="mb-1.5 text-sm text-inkmut">{p.unit}</span>
              </div>
              <div className="mt-3 rounded-lg border border-vline bg-sand px-3 py-2">
                <div className="text-[13px] text-ink">{p.included}</div>
                <div className="font-plex text-[11px] text-inkmut">{p.overage}</div>
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-inkmut">
                    <span className="mt-0.5 text-emerald">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignIn}
                className={`mt-5 rounded-lg py-2.5 text-sm font-semibold transition ${
                  p.highlight ? "bg-emerald text-paper hover:-translate-y-px"
                  : "border border-vline2 text-ink hover:bg-sand"}`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Estimator */}
      <section className="mx-auto mt-20 max-w-6xl px-6">
        <div className="grid items-center gap-8 rounded-2xl border border-vline bg-sand p-8 md:grid-cols-2">
          <div>
            <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Estimator</div>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-ink">What will it cost?</h2>
            <p className="mt-2 text-sm text-inkmut">
              Drag to your expected monthly token volume. The marginal rate falls as you grow —
              so your blended price per million tokens keeps dropping.
            </p>

            <div className="mt-6">
              <div className="flex items-baseline justify-between font-plex text-[12px] text-inkmut">
                <span>Monthly tokens</span><span className="text-ink">{tokensM.toLocaleString()}M</span>
              </div>
              <input type="range" min={1} max={1500} step={1} value={tokensM}
                onChange={(e) => setTokensM(Number(e.target.value))}
                className="mt-2 w-full accent-emerald" />
              <div className="mt-1 flex justify-between font-plex text-[10px] text-inkdim">
                <span>1M</span><span>500M</span><span>1B</span><span>1.5B</span>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              {TIERS.map((t) => (
                <div key={t.label} className="flex justify-between font-plex text-[11px] text-inkmut">
                  <span>{t.label}</span>
                  <span className={t.rate === 0 ? "text-emerald" : ""}>{t.rate === 0 ? "free" : `$${t.rate} / 1M`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-vline2 bg-paper p-7">
            <div className="font-plex text-[11px] uppercase tracking-wider text-inkmut">Estimated monthly usage</div>
            <div className="mt-1 font-serif text-5xl font-semibold text-emerald-grad">${bill.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="mt-1 font-plex text-[12px] text-inkmut">≈ ${blended.toFixed(2)} / 1M blended</div>
            <div className="my-5 h-px bg-vline" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-inkmut">Recommended plan</span>
              <span className="rounded-full border border-emerald px-3 py-1 font-plex text-[12px] text-emerald">{recommend(tokensM)}</span>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-inkdim">
              Token rates are illustrative for this demo. Real deployments meter actual prompt +
              completion tokens per agent, with per-agent cost guardrails enforced by the runtime.
            </p>
          </div>
        </div>
      </section>

      {/* Note */}
      <section className="mx-auto mt-20 max-w-3xl px-6 text-center">
        <div className="rounded-2xl border border-vline bg-sand p-7">
          <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-goldv">About this page</div>
          <p className="mt-3 text-sm text-inkmut">
            This pricing is a creative illustration built for the <span className="text-ink">Yuno AI Engineer hiring challenge</span>.
            It demonstrates a usage-based model with volume discounts on top of a fully working,
            locally-runnable agent orchestration platform — not a commercial offer.
          </p>
        </div>
      </section>

      <div className="mt-20" />
      <PublicFooter onNav={onNav} onSignIn={onSignIn} />
    </div>
  );
}
