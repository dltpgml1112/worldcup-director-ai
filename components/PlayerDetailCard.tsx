"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { playerStamina, staminaTone } from "@/lib/stamina";
import { bookingsAt, matchPlayer, redCardRisk, riskTone } from "@/lib/cards";
import { t, displayName } from "@/lib/i18n";
import InfoTip from "./InfoTip";

/**
 * 선수 상세 카드 — 경기장에서 선수를 클릭하면 열린다.
 *
 * 지금까지 선수 정보(능력치·체력·경고·출전시간)가 여러 패널에 흩어져 있었다.
 * 한 선수를 판단하려면 한 곳에서 다 보여야 한다.
 */
export default function PlayerDetailCard() {
  const selected = useGame((s) => s.selectedPlayer);
  const setSelected = useGame((s) => s.setSelectedPlayer);
  const players = useGame((s) => s.players);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const lang = useGame((s) => s.lang);
  const match = getMatch(matchId);

  const info = useMemo(() => {
    if (!selected) return null;
    const home = players.find((p) => p.id === selected);
    const away = match?.awayXI.find((p) => p.id === selected);
    const player = home ?? away;
    if (!player) return null;
    const isHome = !!home;
    const team = isHome ? match?.home : match?.away;

    const stam = playerStamina(player, minute, tactics);
    const played = Math.max(0, minute - (player.onAt ?? 0));

    // 경고 여부
    const squad = isHome ? players : (match?.awayXI ?? []);
    const booking = bookingsAt(match, minute)
      .filter((b) => (b.side === "home") === isHome)
      .find((b) => matchPlayer(squad, b.player)?.id === player.id);

    const risk = isHome
      ? redCardRisk(match, players, minute, tactics, lang).find((r) => r.player.id === player.id)
      : undefined;

    return { player, isHome, team, stam, played, booking, risk };
  }, [selected, players, match, minute, tactics, lang]);

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-lg border border-surface-line bg-surface-raised shadow-2xl"
            style={{ borderTop: `3px solid ${info.team?.primary ?? "#3987e5"}` }}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 border-b border-surface-line p-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-bold text-white"
                style={{ background: info.team?.primary ?? "#3987e5" }}
              >
                {info.player.num}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold text-ink-primary">
                  {displayName(lang, info.player.name, info.player.nameKo)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <span>{info.team?.flag}</span>
                  <span>{info.player.role}</span>
                  {info.player.legend && <span className="text-neon-gold">⭐ {t(lang, "board.legend")}</span>}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label={t(lang, "insight.dismiss")}
                className="shrink-0 rounded px-2 py-1 text-ink-muted transition hover:bg-surface-hover hover:text-ink-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* 능력치 · 출전 */}
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t(lang, "sub.ovr")} value={`${info.player.rating}`} />
                <Stat label={t(lang, "sub.minutes")} value={`${info.played}′`} />
              </div>

              {/* 체력 */}
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-muted">
                  {t(lang, "load.avgStam")}
                  <InfoTip text={t(lang, "tip.stamina")} align="left" />
                  <span
                    className="metric-num ml-auto text-xs font-bold"
                    style={{ color: staminaTone(info.stam).color }}
                  >
                    {Math.round(info.stam)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-panel">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${info.stam}%`, background: staminaTone(info.stam).color }}
                  />
                </div>
              </div>

              {/* 경고 · 퇴장 위험 */}
              {info.booking ? (
                <div className="rounded-md border border-status-warning/40 bg-status-warning/10 p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-3 rounded-[2px]"
                      style={{ background: info.booking.card === "red" ? "#d03b3b" : "#fab219" }}
                    />
                    <span className="text-[11px] font-bold text-ink-primary">
                      {t(lang, info.booking.card === "red" ? "card.red" : "card.yellow")}
                    </span>
                    <span className="metric-num text-[11px] text-ink-muted">{info.booking.minute}′</span>
                  </div>
                  {info.risk && (
                    <div className="mt-1.5 text-[10px] leading-snug" style={{ color: riskTone(info.risk.risk, lang).color }}>
                      {t(lang, "card.risk")} <b>{info.risk.risk}/100</b> ({riskTone(info.risk.risk, lang).label})
                      {info.risk.drivers.length > 0 && (
                        <span className="text-ink-muted"> · {info.risk.drivers.join(" · ")}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-surface-line bg-surface-panel px-2.5 py-2 text-[11px] text-ink-muted">
                  {t(lang, "detail.noCard")}
                </div>
              )}

              {!info.isHome && (
                <p className="text-[10px] leading-snug text-ink-muted">{t(lang, "detail.opponent")}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-panel px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="metric-num font-display text-lg font-bold text-ink-primary">{value}</div>
    </div>
  );
}
