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

  /*
   * 표시 순서는 **실제 경기의 홈팀이 왼쪽**이다.
   *
   * 엔진은 사용자 팀을 항상 home 슬롯에 넣기 때문에(lib/types.ts의 actualHome 참고),
   * 슬롯 순서대로 그리면 실제로는 원정이었던 한국이 왼쪽에 와서 "대한민국 0-1 남아공"이
   * 된다. 값은 맞지만 공식 기록은 "남아공 1-0 대한민국"이라, 경기를 아는 사람에게는
   * 스코어가 뒤집혀 보인다. 그래서 표시 단계에서만 실제 홈/원정 순서로 되돌린다.
   */
  const flip = match.actualHome === "away";
  const left = flip ? match.away : match.home;
  const right = flip ? match.home : match.away;
  const leftScore = flip ? snap.score[1] : snap.score[0];
  const rightScore = flip ? snap.score[0] : snap.score[1];
  const leftIsUser = !flip;

  return (
    <div className="glass-strong rounded-2xl px-5 py-3 shadow-glow">
      <div className="flex items-center justify-between gap-4">
        <TeamCell name={nm(left)} flag={left.flag} color={left.primary} align="right" home user={leftIsUser} lang={lang} />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 font-display text-4xl font-bold tabular-nums">
            <motion.span key={`l${leftScore}`} initial={{ scale: 1.6, color: "#42f59b" }} animate={{ scale: 1, color: "#fff" }}>
              {leftScore}
            </motion.span>
            <span className="text-white/40">:</span>
            <motion.span key={`r${rightScore}`} initial={{ scale: 1.6, color: "#ff5a6e" }} animate={{ scale: 1, color: "#fff" }}>
              {rightScore}
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
        <TeamCell name={nm(right)} flag={right.flag} color={right.primary} align="left" home={false} user={!leftIsUser} lang={lang} />
      </div>
      <div className="mt-1 text-center text-[11px] uppercase tracking-widest text-white/40">
        {match.year} {t(lang, "score.worldcup")} · {stageLabel(lang, match.stage, match.stageKo)} ·{" "}
        {(lang === "ko" && match.venueKo) || match.venue}
      </div>
    </div>
  );
}

/**
 * `home`은 **실제 경기의** 홈팀 여부, `user`는 감독이 맡은 팀 여부다.
 * 표시 순서가 실제 홈/원정을 따르므로, 내 팀이 어느 쪽인지는 따로 표시해줘야 한다.
 */
function TeamCell({
  name,
  flag,
  color,
  align,
  home,
  user,
  lang,
}: {
  name: string;
  flag: string;
  color: string;
  align: "left" | "right";
  home: boolean;
  user: boolean;
  lang: string;
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="text-2xl">{flag}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold" style={{ color }}>
          {name}
        </div>
        <div className={`flex items-center gap-1 text-[9px] uppercase tracking-widest ${align === "right" ? "justify-end" : ""}`}>
          <span className="text-white/35">{home ? "HOME" : "AWAY"}</span>
          {user && (
            <span className="rounded bg-neon-grass/20 px-1 text-neon-grass">
              {lang === "ko" ? "내 팀" : "YOURS"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
