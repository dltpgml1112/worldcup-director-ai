"use client";

import type { MatchData, Tactics } from "@/lib/types";
import { winProbCurve } from "@/lib/matchEngine";
import { useGame } from "@/lib/store";
import { t } from "@/lib/i18n";

/** ESPN식 실시간 승리확률 곡선 (SVG) */
export default function WinProbChart({ match, tactics, minute }: { match: MatchData; tactics: Tactics; minute: number }) {
  const lang = useGame((s) => s.lang);
  const curve = winProbCurve(match, tactics);
  const end = curve[curve.length - 1]?.minute || 90;
  const W = 320,
    H = 90;
  const x = (m: number) => (m / end) * W;
  const y = (p: number) => H - (p / 100) * H;

  const homePath = curve.map((c, i) => `${i ? "L" : "M"}${x(c.minute).toFixed(1)},${y(c.home).toFixed(1)}`).join(" ");
  const areaPath = `${homePath} L${W},${H} L0,${H} Z`;
  const nowX = x(Math.min(minute, end));

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
        <span>{t(lang, "stats.winprob")}</span>
        <span style={{ color: match.home.primary }}>{match.home.code}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full">
        <defs>
          <linearGradient id="wpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#42f59b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#42f59b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
        <path d={areaPath} fill="url(#wpfill)" />
        <path d={homePath} fill="none" stroke="#42f59b" strokeWidth="2" />
        <line x1={nowX} y1="0" x2={nowX} y2={H} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <circle cx={nowX} cy={y(curve.find((c) => c.minute >= Math.min(minute, end))?.home ?? 50)} r="3.5" fill="#fff" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/40">
        <span>0'</span>
        <span>{Math.round(end / 2)}'</span>
        <span>{end}'</span>
      </div>
    </div>
  );
}
