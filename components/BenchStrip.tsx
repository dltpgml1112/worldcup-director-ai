"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/lib/store";
import { t, displayName } from "@/lib/i18n";

const MAX_SUBS = 5;

/**
 * 벤치 스트립 — 카드를 집어 전술 보드(2D·3D 공통)의 선수 위로 끌어다 놓으면 교체.
 * 드래그 상태는 스토어(benchDrag/subTarget)에 있어서 어느 뷰든 같은 드롭 타깃으로 동작한다.
 *
 * 포인터 캡처를 쓰지 않는다 — 캡처하면 이벤트가 카드로 리타깃되어
 * 캔버스(3D)·토큰(2D)이 hover를 못 받는다.
 */
export default function BenchStrip() {
  const bench = useGame((s) => s.bench);
  const players = useGame((s) => s.players);
  const legendMode = useGame((s) => s.legendMode);
  const subsUsed = useGame((s) => s.subsUsed);
  const lang = useGame((s) => s.lang);
  const benchDrag = useGame((s) => s.benchDrag);
  const subTarget = useGame((s) => s.subTarget);
  const startBenchDrag = useGame((s) => s.startBenchDrag);
  const dropBenchDrag = useGame((s) => s.dropBenchDrag);

  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const outOfSubs = subsUsed >= MAX_SUBS;
  const visible = useMemo(
    () => bench.filter((b) => legendMode || !b.legend),
    [bench, legendMode]
  );

  const dragged = benchDrag ? bench.find((b) => b.id === benchDrag) : undefined;
  const targeted = subTarget ? players.find((p) => p.id === subTarget) : undefined;

  // 드래그 중 전역 포인터 추적 — 어디서 손을 떼든 드래그가 끝나게 한다
  useEffect(() => {
    if (!benchDrag) {
      setGhost(null);
      return;
    }
    const move = (e: PointerEvent) => setGhost({ x: e.clientX, y: e.clientY });
    const up = () => {
      const done = dropBenchDrag();
      if (done) {
        setFlash("ok");
        setTimeout(() => setFlash(null), 1200);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [benchDrag, dropBenchDrag]);

  if (visible.length === 0 && !outOfSubs) return null;

  return (
    <div className="mt-3" data-tour="bench">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          {t(lang, "bench.title")}
        </span>
        <span className={`text-[10px] font-semibold ${outOfSubs ? "text-status-critical" : "text-ink-muted"}`}>
          {outOfSubs ? t(lang, "sub.allUsed") : t(lang, "bench.hint")}
          {!outOfSubs && ` · ${subsUsed}/${MAX_SUBS}`}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {visible.map((b) => {
          const active = benchDrag === b.id;
          return (
            <button
              key={b.id}
              type="button"
              disabled={outOfSubs}
              onPointerDown={(e) => {
                if (outOfSubs) return;
                e.preventDefault();
                // 터치/펜은 암묵적 포인터 캡처가 걸려 이후 이벤트가 이 카드로만 간다.
                // 해제해야 보드 위 선수가 hover(=조준)를 받을 수 있다.
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                setGhost({ x: e.clientX, y: e.clientY });
                startBenchDrag(b.id);
              }}
              className={`flex w-[76px] shrink-0 cursor-grab flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 transition active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-status-good bg-status-good/15"
                  : "border-surface-line bg-surface-panel hover:border-team-home/60 hover:bg-surface-hover"
              }`}
              style={{ touchAction: "none" }}
            >
              <span className="flex items-center gap-1">
                <span className="metric-num font-display text-xs font-bold text-ink-secondary">{b.num}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">{b.role}</span>
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold text-ink-primary">
                {b.legend && "⭐"}
                {displayName(lang, b.name, b.nameKo)}
              </span>
              <span className="metric-num text-[9px] font-bold text-team-home">{b.rating}</span>
            </button>
          );
        })}
      </div>

      {/* 커서를 따라다니는 고스트 카드 + 조준 대상 표시 */}
      {typeof document !== "undefined" &&
        dragged &&
        ghost &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
            style={{ left: ghost.x, top: ghost.y }}
          >
            <div
              className={`rounded-md border-2 px-2.5 py-1.5 text-center shadow-xl ${
                targeted ? "border-status-good bg-status-good/25" : "border-team-home bg-surface-raised"
              }`}
            >
              <div className="text-[11px] font-bold text-ink-primary">
                ↑ {displayName(lang, dragged.name, dragged.nameKo)}
              </div>
              {targeted ? (
                <div className="text-[10px] font-semibold text-status-critical">
                  ↓ {displayName(lang, targeted.name, targeted.nameKo)}
                </div>
              ) : (
                <div className="text-[9px] text-ink-muted">{t(lang, "bench.dropHint")}</div>
              )}
            </div>
          </div>,
          document.body
        )}

      {flash === "ok" && (
        <div className="mt-1.5 rounded-md border border-status-good/40 bg-status-good/10 px-2 py-1 text-center text-[10px] font-semibold text-status-good">
          ✓ {t(lang, "bench.done")}
        </div>
      )}
    </div>
  );
}
