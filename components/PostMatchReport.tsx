"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MatchData, Tactics } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { buildReport } from "@/lib/postMatch";
import { useGame } from "@/lib/store";

export default function PostMatchReport({
  match,
  snap,
  tactics,
  alt,
  open,
  onClose,
}: {
  match: MatchData;
  snap: MatchSnapshot;
  tactics: Tactics;
  alt: { score: [number, number]; homeWinProb: number };
  open: boolean;
  onClose: () => void;
}) {
  const coachName = useGame((s) => s.coachName);
  const players = useGame((s) => s.players);
  const subLog = useGame((s) => s.subLog);
  const [copied, setCopied] = useState(false);

  const report = useMemo(
    () => buildReport(match, players, snap, tactics, coachName, alt),
    [match, players, snap, tactics, coachName, alt]
  );

  const summary =
    `⚽ World Cup Director AI — Full-Time Report\n` +
    `${coachName} · ${match.home.name} vs ${match.away.name} (${match.year} ${match.stage})\n` +
    `Real: ${match.finalScore[0]}–${match.finalScore[1]}  |  Your history: ${alt.score[0]}–${alt.score[1]}\n` +
    `Grade ${report.grade} (${report.gradeScore}/100) · MOTM ${report.motm.name} ${report.motm.rating.toFixed(1)}/10\n` +
    `"${report.headlines[0]}"`;

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — 무시 */
    }
  };

  const downloadCard = () => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 630;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // 배경
    const g = ctx.createLinearGradient(0, 0, 1200, 630);
    g.addColorStop(0, "#071018");
    g.addColorStop(0.55, "#0a1f16");
    g.addColorStop(1, "#05070d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.fillStyle = "#42f59b";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText("⚽ WORLD CUP DIRECTOR AI", 70, 90);

    ctx.fillStyle = "#7c8aa0";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(`${match.year} ${match.stage} · ${match.venue}`, 70, 132);

    // 팀 & 스코어
    ctx.fillStyle = "#e8eef7";
    ctx.font = "700 64px system-ui, sans-serif";
    ctx.fillText(`${match.home.flag} ${match.home.code}  ${alt.score[0]} – ${alt.score[1]}  ${match.away.code} ${match.away.flag}`, 70, 230);

    ctx.fillStyle = "#7c8aa0";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(`Real result ${match.finalScore[0]}–${match.finalScore[1]}  ·  Projected win probability ${alt.homeWinProb}%`, 70, 275);

    // 등급 뱃지
    ctx.fillStyle = "#ffd54a";
    ctx.font = "800 150px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(report.grade, 1130, 250);
    ctx.textAlign = "left";
    ctx.fillStyle = "#7c8aa0";
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("DIRECTOR GRADE", 1130, 290);
    ctx.textAlign = "left";

    // MOTM
    ctx.fillStyle = "#5ad2ff";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText("MAN OF THE MATCH", 70, 380);
    ctx.fillStyle = "#e8eef7";
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.fillText(`${report.motm.name}  —  ${report.motm.rating.toFixed(1)} / 10`, 70, 430);

    // 헤드라인
    ctx.fillStyle = "#42f59b";
    ctx.font = "italic 700 30px system-ui, sans-serif";
    wrap(ctx, `“${report.headlines[0]}”`, 70, 505, 1060, 40);

    // 코치 서명
    ctx.fillStyle = "#7c8aa0";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText(`Directed by ${coachName}`, 70, 595);

    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `wc-director-${coachName.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const realChanged = alt.score[0] !== match.finalScore[0] || alt.score[1] !== match.finalScore[1];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
        >
          <div className="absolute inset-0 bg-night-900/85 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="glass-strong relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl p-6 sm:p-8"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              ✕
            </button>

            <div className="chip mb-2 bg-neon-gold/20 text-neon-gold">🏁 Full-Time Report</div>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              {match.home.name} <span className="text-white/40">vs</span> {match.away.name}
            </h2>

            {/* 스코어 요약 */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile label="Real History" value={`${match.finalScore[0]}–${match.finalScore[1]}`} />
              <SummaryTile label="Your History" value={`${alt.score[0]}–${alt.score[1]}`} accent />
              <SummaryTile label="Win Prob" value={`${alt.homeWinProb}%`} />
              <SummaryTile label="Grade" value={report.grade} gold />
            </div>

            {/* AI 총평 */}
            <div className="mt-5 rounded-2xl border border-neon-ice/30 bg-neon-ice/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neon-ice">
                🧠 AI Verdict {realChanged && <span className="chip bg-neon-grass/15 text-neon-grass">HISTORY REWRITTEN</span>}
              </div>
              <p className="text-sm leading-relaxed text-white/80">{report.verdict}</p>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* 선수 평점 */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">Player Ratings</div>
                <div className="space-y-1.5">
                  {[...report.ratings]
                    .sort((a, b) => b.rating - a.rating)
                    .map((r) => {
                      const isMotm = r.id === report.motm.id;
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                            isMotm ? "border-neon-gold/50 bg-neon-gold/10" : "border-white/10 bg-white/5"
                          }`}
                        >
                          <span className="w-6 text-center font-display text-xs font-bold tabular-nums text-white/50">{r.num}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {r.name}
                            {r.goals > 0 && <span className="ml-1 text-neon-gold">{"⚽".repeat(r.goals)}</span>}
                            {isMotm && <span className="ml-1.5 chip bg-neon-gold/20 text-[9px] text-neon-gold">MOTM</span>}
                          </span>
                          <span className="hidden text-[10px] text-white/40 sm:block">{r.note}</span>
                          <span
                            className="w-11 rounded-md px-1.5 py-0.5 text-center font-display text-sm font-bold tabular-nums"
                            style={{
                              background: r.rating >= 8 ? "rgba(66,245,155,0.2)" : r.rating >= 7 ? "rgba(90,210,255,0.18)" : "rgba(255,255,255,0.08)",
                              color: r.rating >= 8 ? "#42f59b" : r.rating >= 7 ? "#5ad2ff" : "#e8eef7",
                            }}
                          >
                            {r.rating.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 헤드라인 + 교체 로그 */}
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">📰 Back Pages</div>
                  <div className="space-y-2">
                    {report.headlines.map((h, i) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                        <p className="font-display text-sm font-bold uppercase leading-tight tracking-tight text-white/90">{h}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">🔁 Substitutions</div>
                  {subLog.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                      No substitutions made — you rode with your XI.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {subLog.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs">
                          <span className="font-display font-bold tabular-nums text-white/60">{s.minute}'</span>
                          <span className="text-neon-red">↓ {s.offName}</span>
                          <span className="text-white/30">→</span>
                          <span className="text-neon-grass">↑ {s.onName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 공유 */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={downloadCard} className="btn-primary !py-2.5 !text-sm">
                <span className="relative z-10">🖼️ Download Share Card</span>
              </button>
              <button
                onClick={copySummary}
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                {copied ? "✓ Copied!" : "📋 Copy Summary"}
              </button>
              <button
                onClick={onClose}
                className="ml-auto rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
              >
                Back to match
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SummaryTile({ label, value, accent, gold }: { label: string; value: string; accent?: boolean; gold?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        accent ? "border-neon-grass/40 bg-neon-grass/10" : gold ? "border-neon-gold/40 bg-neon-gold/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className={`text-[10px] uppercase tracking-widest ${accent ? "text-neon-grass" : gold ? "text-neon-gold" : "text-white/40"}`}>{label}</div>
      <div
        className={`font-display text-2xl font-bold tabular-nums ${accent ? "text-neon-grass" : gold ? "text-neon-gold" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}

/** 캔버스 텍스트 줄바꿈 헬퍼 */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, yy);
      line = w + " ";
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
