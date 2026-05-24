/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg0: "#07090d", bg1: "#0a0e15", bg2: "#0e131c", bg3: "#141b27", bg4: "#1a2433",
        t0: "#eaf0f7", t1: "#9babbf", t2: "#64768b", t3: "#3f4d5e",
        mint: "#2bf5b8", cyan: "#38d6ff", amber: "#ffc15e", coral: "#ff6b72", gold: "#e8c07d",
        line: "rgba(255,255,255,0.07)",
        line2: "rgba(255,255,255,0.12)",
      },
      fontFamily: {
        disp: ["Clash Display", "Satoshi", "sans-serif"],
        sans: ["Satoshi", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(43,245,184,.25), 0 0 28px rgba(43,245,184,.28)",
      },
    },
  },
  plugins: [],
};
