"use client";

import { motion } from "framer-motion";

/** -100(away) ~ +100(home) 모멘텀을 중앙 기준 바로 표현 */
export default function MomentumBar({ momentum, homeCode, awayCode }: { momentum: number; homeCode: string; awayCode: string }) {
  const pct = (momentum + 100) / 2; // 0-100
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
        <span>{homeCode}</span>
        <span>Momentum</span>
        <span>{awayCode}</span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-neon-grass/25 via-white/10 to-neon-red/25">
        <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40" />
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-glow"
          style={{ background: momentum >= 0 ? "#42f59b" : "#ff5a6e" }}
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
  );
}
