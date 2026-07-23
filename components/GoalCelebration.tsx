"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchEvent } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

const COLORS = ["#42f59b", "#ffd54a", "#5ad2ff", "#ff5a6e", "#ffffff"];

/** 골 순간 컨페티 파티클 (중앙에서 방사형으로 터짐) */
function particles(seed: number) {
  const n = 34;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (seed % 7) * 0.3;
    const dist = 140 + ((i * 53 + seed * 17) % 220);
    return {
      id: i,
      x: Math.cos(a) * dist,
      y: Math.sin(a) * dist - 40, // 살짝 위로
      color: COLORS[(i + seed) % COLORS.length],
      size: 7 + ((i * 13 + seed) % 8),
      rot: (i * 47) % 360,
    };
  });
}

/** 골 세리머니 선수 실루엣 (양팔 벌린 환호 포즈) */
function CelebFigure({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 150" className="h-40 w-28 drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:h-52 sm:w-36" fill="none">
      <g stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        {/* 양팔 (V자 환호) */}
        <path d="M45 52 L20 22" />
        <path d="M55 52 L80 22" />
        {/* 다리 (달리기/점프) */}
        <path d="M47 92 L34 138" />
        <path d="M53 92 L70 130" />
      </g>
      {/* 몸통 */}
      <rect x="40" y="48" width="20" height="48" rx="10" fill={color} />
      {/* 머리 */}
      <circle cx="50" cy="24" r="13" fill={color} />
      {/* 등번호 느낌 하이라이트 */}
      <circle cx="20" cy="22" r="6.5" fill={color} />
      <circle cx="80" cy="22" r="6.5" fill={color} />
    </svg>
  );
}

export default function GoalCelebration({
  goal,
  minute,
  lang,
  accent = "#42f59b",
}: {
  goal: MatchEvent | undefined;
  minute: number;
  lang: Lang;
  accent?: string;
}) {
  return (
    <AnimatePresence>
      {goal && (
        <motion.div
          key={`goal-${minute}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-hidden"
        >
          {/* 어둡게 + 방사형 플래시 */}
          <div className="absolute inset-0 bg-night-900/55" />
          <motion.div
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute h-40 w-40 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,213,74,0.7) 0%, transparent 70%)" }}
          />

          {/* 컨페티 */}
          {particles(minute).map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.rot }}
              transition={{ duration: 1.3, ease: "easeOut" }}
              className="absolute rounded-[2px]"
              style={{ width: p.size, height: p.size, background: p.color }}
            />
          ))}

          {/* 선수 실루엣 등장 + GOAL 텍스트 */}
          <div className="relative flex flex-col items-center">
            {/* 스포트라이트 */}
            <motion.div
              initial={{ opacity: 0, scaleY: 0.3 }}
              animate={{ opacity: 0.5, scaleY: 1 }}
              transition={{ duration: 0.5 }}
              className="absolute -top-4 h-56 w-64 origin-bottom"
              style={{ background: `radial-gradient(ellipse at 50% 100%, ${accent}55 0%, transparent 70%)` }}
            />

            <motion.div
              initial={{ scale: 0.5, rotate: -8, y: 10 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 11 }}
              className="relative text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="font-display text-6xl font-bold uppercase tracking-tight text-neon-gold drop-shadow-[0_0_40px_rgba(255,213,74,0.85)] sm:text-8xl"
              >
                {lang === "ko" ? "골!" : "GOAL!"}
              </motion.div>
            </motion.div>

            {/* 선수 등장 (아래에서 튀어오르며 등장) */}
            <motion.div
              initial={{ y: 140, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 170, damping: 15, delay: 0.12 }}
              className="relative -mt-2 flex flex-col items-center"
            >
              <CelebFigure color={accent} />
              {goal.player && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="-mt-2 rounded-full bg-black/60 px-4 py-1 font-display text-2xl font-bold text-white shadow-lg sm:text-3xl"
                  style={{ boxShadow: `0 0 24px ${accent}66` }}
                >
                  ⚽ {goal.player}
                </motion.div>
              )}
            </motion.div>

            <div className="mt-2 max-w-md text-center text-base font-semibold text-white/90 drop-shadow sm:text-lg">
              {lang === "ko" && goal.detailKo ? goal.detailKo : goal.detail}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
