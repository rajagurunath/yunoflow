/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens are CSS-variable channels so the console can switch
        // theme (.theme-light) without rewriting component classes.
        bg0: "rgb(var(--c-bg0) / <alpha-value>)", bg1: "rgb(var(--c-bg1) / <alpha-value>)",
        bg2: "rgb(var(--c-bg2) / <alpha-value>)", bg3: "rgb(var(--c-bg3) / <alpha-value>)",
        bg4: "rgb(var(--c-bg4) / <alpha-value>)",
        t0: "rgb(var(--c-t0) / <alpha-value>)", t1: "rgb(var(--c-t1) / <alpha-value>)",
        t2: "rgb(var(--c-t2) / <alpha-value>)", t3: "rgb(var(--c-t3) / <alpha-value>)",
        mint: "rgb(var(--c-mint) / <alpha-value>)", cyan: "rgb(var(--c-cyan) / <alpha-value>)",
        amber: "rgb(var(--c-amber) / <alpha-value>)", coral: "rgb(var(--c-coral) / <alpha-value>)",
        gold: "rgb(var(--c-gold) / <alpha-value>)",
        line: "var(--line)",
        line2: "var(--line2)",
        // ---- Vault (light, enterprise) palette for public surfaces ----
        paper: "#fffdf9", sand: "#f5f2ec", ink: "#14181c", ink2: "#222a30",
        inkmut: "#5c6470", inkdim: "#8a93a0",
        emerald: "#0d6e54", emerald2: "#0a5a44", goldv: "#b78a2e",
        vline: "rgba(20,24,28,0.10)", vline2: "rgba(20,24,28,0.16)",
      },
      fontFamily: {
        disp: ["Clash Display", "Satoshi", "sans-serif"],
        sans: ["Satoshi", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        serif: ["Fraunces", "Georgia", "serif"],
        gsans: ["General Sans", "Satoshi", "system-ui", "sans-serif"],
        plex: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(43,245,184,.25), 0 0 28px rgba(43,245,184,.28)",
      },
    },
  },
  plugins: [],
};
