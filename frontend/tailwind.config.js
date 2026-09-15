/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070d",
          900: "#0a0e18",
          800: "#111726",
          700: "#1a2235",
          600: "#243049",
        },
        accent: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },
        gold: {
          300: "#fcd34d",
          400: "#facc15",
          500: "#d4a017",
        },
        good: "#22c55e",
        bad: "#ef4444",
        warn: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
        reactor: "0 0 20px rgba(56, 189, 248, 0.55), 0 0 60px rgba(56, 189, 248, 0.15)",
        gold: "0 0 20px rgba(250, 204, 21, 0.35)",
      },
      keyframes: {
        "reactor-spin": { to: { transform: "rotate(360deg)" } },
        "scan": { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
      },
      animation: {
        "reactor-spin": "reactor-spin 6s linear infinite",
        "scan": "scan 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
