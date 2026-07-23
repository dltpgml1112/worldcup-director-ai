import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: { DEFAULT: "#0d5c2f", dark: "#0a4a26", line: "#3a8a5a" },
        turf: "#0e7a3d",
        night: { 900: "#05070d", 800: "#0a0e1a", 700: "#111827" },
        neon: { grass: "#42f59b", gold: "#ffd54a", ice: "#5ad2ff", red: "#ff5a6e" },
      },
      fontFamily: {
        display: ['"Rajdhani"', "system-ui", "sans-serif"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(66,245,155,.25)",
        "glow-gold": "0 0 40px rgba(255,213,74,.3)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseGlow: { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        sweep: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(120%)" } },
      },
      animation: {
        floaty: "floaty 4s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        sweep: "sweep 3.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
