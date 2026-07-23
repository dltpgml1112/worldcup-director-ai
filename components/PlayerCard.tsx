"use client";

import type { Player } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { displayName } from "@/lib/i18n";
import { cardTier, cardStats, STAT_LABELS, type CardStats } from "@/lib/playerCard";

const TIER: Record<string, { bg: string; text: string; sub: string; ring: string }> = {
  gold: {
    bg: "linear-gradient(160deg,#fbe58a 0%,#e9c14a 45%,#b8860b 100%)",
    text: "#3a2c00",
    sub: "rgba(58,44,0,0.65)",
    ring: "rgba(58,44,0,0.25)",
  },
  silver: {
    bg: "linear-gradient(160deg,#eef2f6 0%,#c3ccd6 45%,#9aa6b2 100%)",
    text: "#242a31",
    sub: "rgba(36,42,49,0.6)",
    ring: "rgba(36,42,49,0.2)",
  },
  bronze: {
    bg: "linear-gradient(160deg,#e6a86b 0%,#c17a3f 45%,#8a4f22 100%)",
    text: "#2a1400",
    sub: "rgba(42,20,0,0.65)",
    ring: "rgba(42,20,0,0.25)",
  },
};

export default function PlayerCard({
  player,
  lang,
  flag,
  compact,
}: {
  player: Player;
  lang: Lang;
  flag?: string;
  compact?: boolean;
}) {
  const tier = cardTier(player);
  const th = TIER[tier];
  const stats = cardStats(player);
  const name = displayName(lang, player.name, player.nameKo);
  const w = compact ? 150 : 190;

  return (
    <div
      className="relative flex flex-col items-center rounded-2xl px-3 py-3 shadow-2xl"
      style={{ width: w, background: th.bg, color: th.text, border: `1px solid ${th.ring}` }}
    >
      {player.legend && <div className="absolute right-2 top-2 text-base leading-none">⭐</div>}
      {/* 상단: 평점 + 포지션 */}
      <div className="flex w-full items-start gap-2">
        <div className="flex flex-col items-center leading-none">
          <span className="font-display text-4xl font-bold tabular-nums">{player.rating}</span>
          <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: th.sub }}>
            {player.role}
          </span>
          {flag && <span className="mt-1 text-lg">{flag}</span>}
        </div>
        <div className="ml-auto flex h-14 w-14 items-center justify-center rounded-full text-3xl" style={{ background: th.ring }}>
          {player.legend ? "⭐" : "⚽"}
        </div>
      </div>

      {/* 이름 */}
      <div
        className="mt-2 w-full truncate border-y py-1 text-center font-display text-lg font-bold uppercase tracking-tight"
        style={{ borderColor: th.ring }}
      >
        {name}
      </div>

      {/* 6대 스탯 */}
      <div className="mt-2 grid w-full grid-cols-3 gap-x-2 gap-y-1">
        {(Object.keys(stats) as (keyof CardStats)[]).map((k) => (
          <div key={k} className="flex items-baseline justify-center gap-1">
            <span className="font-display text-base font-bold tabular-nums">{stats[k]}</span>
            <span className="text-[9px] font-bold" style={{ color: th.sub }}>
              {STAT_LABELS[k]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
