"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchEvent, Team } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";

/**
 * 카드 발생 시 방송 스타일 오버레이.
 * 심판이 카드를 들어올리듯 카드가 회전하며 튀어나온다.
 */
export default function CardToast({
  event,
  lang,
  home,
  away,
}: {
  event: MatchEvent | null;
  lang: Lang;
  home: Team;
  away: Team;
}) {
  const red = event?.card === "red";
  const team = event?.side === "home" ? home : away;
  const detail = lang === "ko" && event?.detailKo ? event.detailKo : event?.detail;

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="pointer-events-none fixed inset-x-0 top-24 z-[58] flex justify-center px-4"
        >
          <div
            className="flex items-center gap-4 rounded-lg border border-surface-line bg-surface-raised/97 px-5 py-3.5 shadow-2xl backdrop-blur"
            style={{ borderLeft: `4px solid ${red ? "#d03b3b" : "#fab219"}` }}
          >
            {/* 카드 — 심판이 들어올리듯 */}
            <motion.div
              initial={{ rotate: -35, y: 14 }}
              animate={{ rotate: -8, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.06 }}
              className="h-12 w-8 shrink-0 rounded-sm shadow-lg"
              style={{
                background: red ? "#d03b3b" : "#fab219",
                boxShadow: `0 0 18px ${red ? "rgba(208,59,59,0.5)" : "rgba(250,178,25,0.45)"}`,
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="font-display text-sm font-bold uppercase tracking-widest"
                  style={{ color: red ? "#d03b3b" : "#fab219" }}
                >
                  {t(lang, red ? "card.red" : "card.yellow")}
                </span>
                <span className="metric-num rounded bg-surface-panel px-1.5 py-0.5 text-xs font-bold text-ink-secondary">
                  {event.minute}&apos;
                </span>
                <span className="text-xs text-ink-muted">
                  {team.flag} {lang === "ko" ? team.nameKo : team.name}
                </span>
              </div>
              {event.player && (
                <div className="mt-0.5 text-sm font-bold text-ink-primary">{event.player}</div>
              )}
              <p className="mt-0.5 max-w-md text-[11px] leading-snug text-ink-secondary">{detail}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
