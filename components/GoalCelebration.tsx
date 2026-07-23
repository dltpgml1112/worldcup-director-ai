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

export default function GoalCelebration({
  goal,
  minute,
  lang,
}: {
  goal: MatchEvent | undefined;
  minute: number;
  lang: Lang;
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

          {/* GOAL 텍스트 */}
          <motion.div
            initial={{ scale: 0.5, rotate: -8, y: 10 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 11 }}
            className="relative text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 0.7 }}
              className="font-display text-7xl font-bold uppercase tracking-tight text-neon-gold drop-shadow-[0_0_40px_rgba(255,213,74,0.85)] sm:text-9xl"
            >
              {lang === "ko" ? "골!" : "GOAL!"}
            </motion.div>
            <div className="mt-2 text-xl font-semibold text-white drop-shadow">
              {lang === "ko" && goal.detailKo ? goal.detailKo : goal.detail}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
