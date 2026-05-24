# Frontend Design — "Midnight Ledger"

> Design system + build spec for the **Orchestra by Yuno** web UI.
> Companion artifact: a working, self-contained mockup of the signature screen at
> [`mockups/workflow-editor.html`](./mockups/workflow-editor.html) — **open it in a browser.**
> Targets the **20% UI/UX & configurability** rubric, and supports the **40% demo** (the visual builder + live monitor are what the panel watches).

---

## 1. Aesthetic direction

**Concept: "Midnight Ledger" — a precision financial-instrument UI for the agent era.**

Payments infrastructure companies (Stripe, Mercury, Ramp, Adyen, Yuno) converge on a visual language that reads as *trustworthy, exact, and high-stakes*: deep dark surfaces, restrained palettes, a single confident accent, and **monospaced numerals everywhere money or metrics appear**. We take that language and push it forward for an *agentic* product — atmosphere (drifting glow, hairline grid, grain), glass panels, and a luminous **mint/aqua "value-flow"** accent that doubles as the "data is moving / money is moving" signal on live edges.

**Why this wins for Yuno specifically:** it looks like it belongs next to their product, not like a generic dashboard. The dark, instrument-grade treatment signals "production infrastructure," and the flowing mint edges literally visualize *orchestration* — the product's whole thesis.

**The one unforgettable thing:** the canvas where **agent nodes glow and pulse as they execute and mint-gradient "value" flows along the wires in real time** — the workflow doesn't just *describe* a process, you *watch it think*.

Deliberately **not**: purple-on-white gradients, Inter/Roboto/Arial, glassless flat cards, evenly-distributed timid color, generic SaaS template layout.

---

## 2. Design tokens

Implement as CSS variables (and mirror into `tailwind.config.ts`). Exact values are in the mockup's `:root`.

### Color
| Token | Hex | Use |
|---|---|---|
| `--bg-0 … --bg-4` | `#07090d → #1a2433` | Surface ramp (page → raised cards) |
| `--line / line-2 / line-3` | `rgba(255,255,255,.065 / .12 / .2)` | Hairline borders, ascending emphasis |
| `--t0 / t1 / t2 / t3` | `#eaf0f7 / #9babbf / #64768b / #3f4d5e` | Text ramp (primary → ghost) |
| `--mint` ⭐ | `#2bf5b8` | Primary accent: value-flow, run, success, active |
| `--cyan` | `#38d6ff` | Secondary signal; gradient partner |
| `--amber` | `#ffc15e` | Waiting-human / step-up / budget warning |
| `--coral` | `#ff6b72` | Error / decline / over-budget |
| `--gold` | `#e8c07d` | Channels / external I/O |
| `--grad` | `linear-gradient(135deg,cyan,mint)` | Run button, active edges, meters, brand mark |

**Discipline:** one dominant accent (mint), used sparingly on what's *alive*. Idle/neutral states stay in the grey ramp. Color = meaning, never decoration.

### Typography
| Role | Font | Source | Notes |
|---|---|---|---|
| Display / headings / node titles | **Clash Display** (500–700) | Fontshare | Characterful geometric; the brand voice |
| Body / UI | **Satoshi** (400–900) | Fontshare | Premium humanist-geometric; fintech-grade |
| Data / numerals / logs / labels | **JetBrains Mono** (400–700) | Google Fonts | **Every token count, cost, timestamp, ID, cron, config label** |

Loading (already in the mockup):
```html
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700,900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

### Space / shape / depth / motion
- **Radius:** cards `14px`, controls `8–9px`, pills `20–30px`.
- **Spacing:** 4px base; panels pad `14–16px`; node internal `9–12px`.
- **Glass panels:** `rgba(20,27,39,.72)` + `backdrop-filter: blur(16px)` + 1px `--line` border.
- **Elevation:** nodes `0 12px 30px rgba(0,0,0,.45)`; active nodes add a mint ring + glow.
- **Motion budget:** one orchestrated page-load (staggered panel slide-in + node entrance via `animation-delay`), then *reserved* runtime motion that carries meaning — `march` (flowing edges), `ring`/`pulse` (running node), `blink` (live cursor), `grow` (meters). Hover = subtle `translateY(-1/-2px)`. Respect `prefers-reduced-motion`.

---

## 3. Frontend stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Fast HMR for the Ralph loop; ReactFlow is React-native |
| Canvas | **React Flow (@xyflow/react v12)** | The visual workflow builder; custom node/edge renderers |
| Styling | **Tailwind CSS** + CSS variables + a thin `shadcn/ui` set | Tokens as Tailwind theme; shadcn for config-heavy forms/dialogs/accordions |
| Server state | **TanStack Query** | Agents/workflows/runs/templates CRUD + cache |
| Canvas/UI state | **Zustand** | Selected node, builder local state, monitor stream buffer |
| Realtime | Native **WebSocket** client (`/ws/runs/:id`) | Live monitor + node status updates (see backend WS contract) |
| Motion | **Motion** (framer-motion) for React; CSS for primitives | High-impact moments only |
| Icons | Inline SVG (as in mockup) / Lucide | Keep bundle lean; custom glyphs for node types |

Fonts may be self-hosted under `public/fonts` for the offline/local-first guarantee (don't rely on CDN for the demo).

---

## 4. Screens

### 4.1 Workflow Editor — the signature screen *(see mockup)*
Four-zone layout: **icon rail** (62px) · **node palette** (230px, draggable node cards grouped Agents/Control/Tools&I/O) · **canvas** (ReactFlow, dotted grid, minimap, zoom tools) · **inspector** (348px, tabbed **Inspector ⇄ Live Monitor**). Top bar = brand, breadcrumb, run HUD (steps/tokens/cost in mono), status pill, **Run**. Bottom = **console** (tabbed runtime logs / inter-agent / tool calls).
- **Canvas nodes** show avatar, name, model/role, a one-line "what it's doing," tool chips, and a **state tag** (idle/running/done/waiting/error). Running node = mint ring + glow; waiting-human = amber.
- **Edges**: plain → grey; active path → mint gradient with marching-ants flow + arrowhead; conditional → labeled pill (`refund ✓`, `info`); feedback loop → dashed amber (`↺ needs order id`).
- Drag from palette → drop on canvas → connect ports → select node → configure in inspector → **Run** → watch it execute live.

### 4.2 Agent Studio (CRUD + the ~14 configurable dimensions)
List/grid of agent cards (avatar, role, model, tool count, channel badges). Create/Edit = a full-height drawer reusing the **same accordion inspector** as the canvas: **Identity · Model · Tools · Memory · Schedule · Guardrails · Personality**. The accordion summaries show a count badge (e.g. `Guardrails 4`) so the *number of configurable dimensions* is visible at a glance — directly serving that impact metric. Every numeric field (temperature, window, max steps/tokens/cost) uses mono.

### 4.3 Live Monitor
Full-page version of the inspector's Monitor tab: run selector; **token/cost/budget meters** (animated bars, amber as budget nears limit); **inter-agent timeline** (sender → recipient, message, latency, per-step tokens/cost) on a vertical thread; node-status board; and a deep-link to the **MLflow** trace for the run. The custom WebSocket feed drives this in real time.

### 4.4 Message History
Per-run and per-channel transcripts. Channel conversations (Telegram) render as a chat thread with role styling; internal runs render as the inter-agent thread. Filter by agent, channel, run. Persisted `messages` are the source.

### 4.5 Template Gallery
Cards for the 3 prebuilt workflows (Payments Support Triage · Research→Draft→Review · Payment Authorization AP2). Each shows a mini graph preview + "what it demonstrates" tags (conditions / loops / HITL / channel / payments). One click → instantiate → lands in the editor. This makes "time from zero to a working multi-agent workflow" ≈ seconds.

### 4.6 Channels
Bind agents to Telegram (token status, bound chat, test-message). Designed around the `Channel` ABC so adding Slack/WhatsApp is a new card.

---

## 5. ReactFlow component spec

Custom node types (registered in `nodeTypes`): `agentNode`, `deepAgentNode`, `conditionNode`, `toolNode`, `channelNode`, `a2aRemoteNode`. Each is a styled React component matching the mockup's `.node` treatment, with typed `data` (name, role, model, tools, status, metrics) and `Handle`s for in/out ports (multi-out for condition branches).

Custom edge type `flowEdge`: renders label pill + applies `flow`/`loop` classes; `animated` toggled by run status pushed over WebSocket. A small reducer maps incoming WS run-events → node `status` + edge `active`, so the canvas animates as the backend's `astream_events` fire.

Graph (de)serialization mirrors the backend Compiler's `graph_json` schema (nodes/edges/conditional-edge predicates) — **the ReactFlow document IS the workflow definition.** See the backend plan's Compiler section for the exact schema contract.

---

## 6. Integration contract (frontend ↔ backend)

The frontend is built against the REST + WebSocket contract defined in [`backend-implementation-plan.md`](./backend-implementation-plan.md):
- REST: `/agents`, `/workflows`, `/runs`, `/templates`, `/channels` (TanStack Query).
- WebSocket `/ws/runs/:id`: event envelope `{type, node_id, role, content, tokens, cost, ts}` for `node_started|message|tool_call|token_usage|interrupt|node_finished|run_finished` → drives canvas animation, monitor timeline, and console.

---

## 7. Accessibility & responsiveness
- WCAG AA contrast on the dark theme (text ramp tuned for ≥4.5:1 on `--bg`).
- Full keyboard nav for forms/dialogs (shadcn primitives); canvas has keyboard pan/zoom + node focus rings.
- `prefers-reduced-motion` disables marching-ants/pulse, keeps state colors.
- Primary target is desktop (it's a builder); below `lg`, panels collapse to drawers and the canvas stays the focus. Monitor/History are fully responsive.

---

## 8. Frontend build order (aligned to the plan's phases)
- **P1:** app shell + tokens/fonts + minimal agent form + basic message list (serves the vertical slice).
- **P2:** ReactFlow canvas + custom nodes/edges + save/load + Run trigger (the signature screen).
- **P3:** full Agent Studio accordions (all dimensions) + Template Gallery.
- **P4:** Live Monitor + console + WebSocket-driven canvas animation + Message History.
- **P5+:** A2A remote-agent node + Deep Agent node styling; channel manager polish.

---

## 9. Rubric mapping
- **UI/UX & configurability (20%)** → distinctive non-generic aesthetic; the visible 14-dimension config surface; live, animated monitoring.
- **Demo (40%)** → the editor + live canvas are the centerpiece of the recorded demo; Template Gallery makes "zero-to-workflow" instant on camera.
- **Architecture (30%)** → ReactFlow document == backend graph schema (one contract, clean UI/runtime boundary).
- **Docs (10%)** → this file + the runnable mockup are submission assets.
