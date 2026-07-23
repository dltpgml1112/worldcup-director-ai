"use client";

import { motion } from "framer-motion";
import type { MatchData } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { useGame } from "@/lib/store";
import { t, stageLabel } from "@/lib/i18n";

export default function Scoreboard({ match, snap }: { match: MatchData; snap: MatchSnapshot }) {
  const lang = useGame((s) => s.lang);
  const end = match.timeline[match.timeline.length - 1]?.minute ?? 90;
  const isFT = snap.minute >= end;
  const nm = (team: MatchData["home"]) => (lang === "ko" ? team.nameKo : team.name);
  return (
    <div className="glass-strong rounded-2xl px-5 py-3 shadow-glow">
      <div className="flex items-center justify-between gap-4">
        <TeamCell name={nm(match.home)} flag={match.home.flag} color={match.home.primary} align="right" />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 font-display text-4xl font-bold tabular-nums">
            <motion.span key={snap.score[0]} initial={{ scale: 1.6, color: "#42f59b" }} animate={{ scale: 1, color: "#fff" }}>
              {snap.score[0]}
            </motion.span>
            <span className="text-white/40">:</span>
            <motion.span key={snap.score[1] + "a"} initial={{ scale: 1.6, color: "#ff5a6e" }} animate={{ scale: 1, color: "#fff" }}>
              {snap.score[1]}
            </motion.span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="chip bg-red-500/20 text-neon-red">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-red animate-pulseGlow" />
              {isFT ? t(lang, "score.ft") : `${Math.min(snap.minute, 90)}'`}
              {snap.minute > 90 && !isFT ? ` ${t(lang, "score.et")}` : ""}
            </span>
          </div>
        </div>
        <TeamCell name={nm(match.away)} flag={match.away.flag} color={match.away.primary} align="left" />
      </div>
      <div className="mt-1 text-center text-[11px] uppercase tracking-widest text-white/40">
        {match.year} {t(lang, "score.worldcup")} · {stageLabel(lang, match.stage)} · {match.venue}
      </div>
    </div>
  );
}

function TeamCell({ name, flag, color, align }: { name: string; flag: string; color: string; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="text-2xl">{flag}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold" style={{ color }}>
          {name}
        </div>
      </div>
    </div>
  );
}
