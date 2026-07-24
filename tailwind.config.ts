import type { Config } from "tailwindcss";

/**
 * 전문 축구 분석 도구 디자인 토큰.
 * 색상은 검증된 데이터비주얼 팔레트(다크 서피스 기준, CVD/대비 검사 통과)를 사용한다.
 * 우리 팀=blue(series-1), 상대=orange(series-2)로 고정 — 순위가 아닌 주체에 색을 고정.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 표면 / 라인
        surface: {
          base: "#0d1014",
          panel: "#12161c",
          raised: "#171d26",
          line: "#232a34",
          hover: "#1b222c",
        },
        // 잉크
        ink: {
          primary: "#e8ecf1",
          secondary: "#9aa4b2",
          muted: "#6b7686",
        },
        // 팀 (주체 고정)
        team: { home: "#3987e5", away: "#d95926" },
        // 카테고리 시리즈 (고정 순서, 순환 금지)
        series: {
          1: "#3987e5", // blue
          2: "#d95926", // orange
          3: "#199e70", // aqua
          4: "#c98500", // yellow
        },
        // 상태 (시리즈로 재사용 금지 — 항상 아이콘/라벨 동반)
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
        pitch: { DEFAULT: "#15241c", dark: "#122019", line: "rgba(232,236,241,0.28)" },

        // 하위 호환 별칭 (기존 클래스가 즉시 전문 톤으로 전환되도록 매핑)
        night: { 900: "#0d1014", 800: "#12161c", 700: "#171d26" },
        neon: { grass: "#3987e5", gold: "#c98500", ice: "#199e70", red: "#d03b3b" },
        turf: "#15241c",
      },
      fontFamily: {
        display: ['"Rajdhani"', "system-ui", "sans-serif"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        // 네온 글로우 제거 — 은은한 깊이감만
        glow: "0 1px 2px rgba(0,0,0,0.4)",
        "glow-gold": "0 1px 2px rgba(0,0,0,0.4)",
        panel: "0 1px 3px rgba(0,0,0,0.5)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseGlow: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
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
