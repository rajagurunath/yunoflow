// Demo lifecycle flag.
//
// YunoFlow was built for the Yuno AI Engineer hiring challenge. The stateful
// backend (always-on LangGraph runtime, Telegram long-poll, scheduler, WebSocket
// streaming) ran on a VM that is now shut down to stop incurring cost. The static
// frontend stays live on Vercel (free) as a showcase.
//
// When DEMO_RETIRED is true the app runs as a pure static site: the sign-in /
// console flow is replaced with a "demo retired" notice, and links that point at
// the (now-offline) backend are routed to the in-app docs instead.
//
// Flip VITE_DEMO_RETIRED=false (e.g. for local dev with `make up`) to restore the
// full live app.
export const DEMO_RETIRED = (import.meta.env.VITE_DEMO_RETIRED ?? "true") !== "false";

// External references kept alive after the backend is gone.
export const DEMO_VIDEO_URL = "https://www.loom.com/share/8459a66f49d5488884233098407f2fad";
export const SOURCE_URL = "https://github.com/rajagurunath/yunoflow";

// Static OpenAPI reference (Redoc viewer + openapi.json snapshot) served from
// /public. In retired mode the "API" links point here instead of the dead
// backend Swagger UI, so the JSON contract is still browsable with no backend.
// NB: deliberately not under /api* — the dev/preview proxy forwards that prefix
// to the (now dead) backend.
export const API_REFERENCE_URL = "/reference.html";
