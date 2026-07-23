"use client";

import { motion } from "framer-motion";
import type { MatchData } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";

export default function StatBars({ match, snap }: { match: MatchData; snap: MatchSnapshot }) {
  const rows: { label: string; h: number | string; a: number | string; pct: [number, number] }[] = [
    { label: "Possession", h: `${snap.possession[0]}%`, a: `${snap.possession[1]}%`, pct: snap.possession },
    { label: "Expected Goals (xG)", h: snap.xg[0].toFixed(2), a: snap.xg[1].toFixed(2), pct: ratio(snap.xg[0], snap.xg[1]) },
    { label: "Shots", h: snap.shots[0], a: snap.shots[1], pct: ratio(snap.shots[0], snap.shots[1]) },
    { label: "Corners", h: snap.corners[0], a: snap.corners[1], pct: ratio(snap.corners[0], snap.corners[1]) },
  ];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
        <span style={{ color: match.home.primary }}>{match.home.code}</span>
        <span>Match Stats</span>
        <span style={{ color: match.away.primary }}>{match.away.code}</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm tabular-nums">
              <span className="font-semibold">{r.h}</span>
              <span className="text-white/50">{r.label}</span>
              <span className="font-semibold">{r.a}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-neon-grass" animate={{ width: `${r.pct[0]}%` }} transition={{ duration: 0.5 }} />
              <motion.div className="h-full bg-neon-red" animate={{ width: `${r.pct[1]}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ratio(a: number, b: number): [number, number] {
  const t = a + b;
  if (t <= 0) return [50, 50];
  return [Math.round((a / t) * 100), Math.round((b / t) * 100)];
}
