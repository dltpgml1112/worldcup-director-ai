"use client";

import { Component, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { t, displayName } from "@/lib/i18n";
import { compactness, pitchFrame } from "@/lib/pitchPositions";
import { heatLegendStops } from "@/lib/pitchAnalytics";
import TacticalPitch from "./TacticalPitch";
import BenchStrip from "./BenchStrip";
import { CAM_KEYS, type CamKey, type OverlayFlags } from "@/lib/pitchView";

/** three.js는 브라우저 전용 — SSR을 끄고 필요할 때만 로드한다 */
const Pitch3D = dynamic(() => import("./Pitch3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-lg border border-surface-line bg-surface-panel">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-team-home border-t-transparent" />
        <span className="text-[11px] text-ink-muted">Loading 3D stadium…</span>
      </div>
    </div>
  ),
});

type Mode = "2d" | "3d";

/**
 * WebGL을 못 쓰는 환경(구형 GPU·원격 데스크톱·하드웨어 가속 off)에서
 * 보드 전체가 죽지 않도록 2D로 폴백한다. 시연 중 화면이 비는 사고를 막는 안전장치.
 */
class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("[TacticalBoard] 3D 렌더 실패 — 2D 보드로 폴백합니다", err);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const OVERLAY_KEYS: { key: keyof OverlayFlags; i18n: string; color: string }[] = [
  { key: "heat", i18n: "board.ov.heat", color: "#5aa3ee" },
  { key: "passes", i18n: "board.ov.passes", color: "#3987e5" },
  { key: "block", i18n: "board.ov.block", color: "#3987e5" },
  { key: "line", i18n: "board.ov.line", color: "#199e70" },
  { key: "press", i18n: "board.ov.press", color: "#c98500" },
  { key: "influence", i18n: "board.ov.influence", color: "#9aa4b2" },
];

export default function TacticalBoard() {
  const [mode, setMode] = useState<Mode>("3d");
  const [camKey, setCamKey] = useState<CamKey>("behind");
  const [cinematic, setCinematic] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overlays, setOverlays] = useState<OverlayFlags>({
    line: true,
    press: false,
    block: true,
    influence: false,
    heat: false,
    passes: false,
  });
  const [heatPlayer, setHeatPlayer] = useState<string | null>(null);

  const lang = useGame((s) => s.lang);
  const players = useGame((s) => s.players);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const match = getMatch(matchId);

  // HUD 지표 — 2D/3D가 쓰는 것과 같은 배치 계산에서 뽑는다
  const metrics = useMemo(() => {
    const f = pitchFrame({ match, players, tactics, minute, playing });
    return {
      compact: compactness(f.home),
      lineHeight: Math.round(f.homeLine),
      gap: Math.round(f.awayLine - f.homeLine),
    };
  }, [match, players, tactics, minute, playing]);

  const toggleOverlay = (k: keyof OverlayFlags) =>
    setOverlays((o) => ({ ...o, [k]: !o[k] }));

  const viewport = (
    <div className={expanded ? "h-full w-full" : "aspect-[3/4] w-full"}>
      {mode === "3d" ? (
        <WebGLBoundary fallback={<TacticalPitch />}>
          <Pitch3D camKey={camKey} overlays={overlays} cinematic={cinematic} heatPlayer={heatPlayer} />
        </WebGLBoundary>
      ) : (
        <TacticalPitch />
      )}
    </div>
  );

  const controls = (
    <>
      {/* 뷰 전환 + 전체화면 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border border-surface-line bg-surface-panel p-0.5">
          {(["2d", "3d"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                mode === m ? "bg-team-home text-white" : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {t(lang, m === "2d" ? "board.2d" : "board.3d")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {mode === "3d" && (
            <button
              onClick={() => setCinematic((v) => !v)}
              className={`chip transition ${
                cinematic ? "bg-series-4/20 text-series-4" : "bg-white/5 text-ink-muted hover:text-ink-secondary"
              }`}
            >
              🎬 {t(lang, "board.cinematic")}
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="chip bg-white/5 text-ink-muted transition hover:text-ink-secondary"
          >
            {expanded ? `✕ ${t(lang, "board.close")}` : `⤢ ${t(lang, "board.expand")}`}
          </button>
        </div>
      </div>

      {/* 카메라 프리셋 */}
      {mode === "3d" && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {CAM_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setCamKey(k)}
              className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                camKey === k
                  ? "bg-surface-raised text-ink-primary ring-1 ring-team-home"
                  : "bg-surface-panel text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {t(lang, `board.cam.${k}`)}
            </button>
          ))}
        </div>
      )}

      {/* 전술 오버레이 토글 */}
      {mode === "3d" && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {OVERLAY_KEYS.map(({ key, i18n, color }) => (
            <button
              key={key}
              onClick={() => toggleOverlay(key)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold transition ${
                overlays[key] ? "bg-surface-raised text-ink-primary" : "bg-surface-panel text-ink-muted"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: overlays[key] ? color : "#3a4350" }}
              />
              {t(lang, i18n)}
            </button>
          ))}
        </div>
      )}

      {/* 히트맵 대상 선택 + 범례 */}
      {mode === "3d" && overlays.heat && (
        <div className="mb-2 rounded-md border border-surface-line bg-surface-panel p-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {t(lang, "board.heat.who")}
            </span>
            <button
              onClick={() => setHeatPlayer(null)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                heatPlayer === null ? "bg-team-home text-white" : "bg-surface-raised text-ink-muted"
              }`}
            >
              {t(lang, "board.heat.team")}
            </button>
            {players
              .filter((p) => p.role.toUpperCase() !== "GK")
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setHeatPlayer(p.id)}
                  title={displayName(lang, p.name, p.nameKo)}
                  className={`metric-num rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                    heatPlayer === p.id ? "bg-team-home text-white" : "bg-surface-raised text-ink-muted"
                  }`}
                >
                  {p.num}
                </button>
              ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-ink-muted">{t(lang, "board.heat.low")}</span>
            <span
              className="h-1.5 flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${heatLegendStops().join(",")})` }}
            />
            <span className="text-[9px] text-ink-muted">{t(lang, "board.heat.high")}</span>
          </div>
        </div>
      )}

      {/* 패스 네트워크는 실측이 아니라 추정 모델 — 켜져 있는 동안 항상 명시 */}
      {mode === "3d" && overlays.passes && (
        <div className="mb-2 rounded-md border border-neon-gold/30 bg-neon-gold/10 px-2 py-1.5 text-[10px] leading-snug text-neon-gold">
          ⚠️ {t(lang, "board.passes.estimated")}
        </div>
      )}
    </>
  );

  const hud = (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <Metric label={t(lang, "board.compact")} value={`${metrics.compact}`} unit="/100" />
      <Metric label={t(lang, "board.lineHeight")} value={`${metrics.lineHeight}`} unit="%" />
      <Metric label={t(lang, "board.gap")} value={`${metrics.gap}`} unit="%" />
    </div>
  );

  if (expanded) {
    return (
      <>
        {/* 자리 유지용 플레이스홀더 (레이아웃 점프 방지) */}
        <div className="glass rounded-2xl p-4">
          <div className="grid aspect-[3/4] w-full place-items-center rounded-lg border border-dashed border-surface-line text-xs text-ink-muted">
            {t(lang, "board.inFullscreen")}
          </div>
        </div>
        <div className="fixed inset-0 z-[60] flex flex-col bg-surface-base/95 p-4 backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-widest text-ink-secondary">
              {match?.home.flag} {t(lang, "board.title")} · {match?.away.flag}
            </span>
          </div>
          {controls}
          <div className="min-h-0 flex-1">{viewport}</div>
          <BenchStrip />
          {hud}
        </div>
      </>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          {t(lang, "board.title")}
        </span>
        <span className="text-[10px] text-white/40">
          {t(lang, mode === "3d" ? "board.hint3d" : "board.hint")}
        </span>
      </div>
      {controls}
      {viewport}
      <BenchStrip />
      {hud}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-panel px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="metric-num font-display text-lg font-bold leading-tight text-ink-primary">
        {value}
        <span className="ml-0.5 text-[10px] font-semibold text-ink-muted">{unit}</span>
      </div>
    </div>
  );
}
