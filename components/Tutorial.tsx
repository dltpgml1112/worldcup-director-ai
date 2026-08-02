"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { t, type Lang } from "@/lib/i18n";

/**
 * 첫 방문 온보딩.
 *
 * 처음 본 사람이 "패널이 왜 이렇게 많지"에서 멈추는 게 가장 큰 이탈 지점이라,
 * 게임처럼 각 영역이 무엇인지 순서대로 짚어준다.
 * 각 단계는 data-tour 속성으로 실제 DOM을 찾아 하이라이트하므로,
 * 레이아웃이 바뀌어도 속성만 유지하면 따라간다.
 */

/**
 * 버전을 올리면 이미 본 사람에게도 한 번 다시 보여준다.
 * 투어에 담긴 기능이 크게 바뀌었을 때만 올린다 (v2: 프리셋·선수 카드·진행 표시 추가).
 */
const SEEN_KEY = "wcd:tour:v2";

interface Step {
  target: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
}

const STEPS: Step[] = [
  {
    target: "board",
    titleKo: "① 전술 보드 — 여기가 경기장입니다",
    titleEn: "① Tactical board — this is the pitch",
    bodyKo: "마우스를 끌면 시점이 돌아갑니다. 선수를 끌어다 놓으면 그 자리에 그대로 배치되고, 선수를 짧게 클릭하면 능력치·체력·경고 카드가 열립니다.",
    bodyEn: "Drag to orbit. Drag a player to place them exactly where you drop them; a short click opens their attributes, stamina and cards.",
  },
  {
    target: "camera",
    titleKo: "② 카메라 시점",
    titleEn: "② Camera angles",
    bodyKo: "처음이라면 '중계 캠'이 가장 보기 편합니다. '탑다운'은 대형을 확인할 때 좋습니다.",
    bodyEn: "Start with Broadcast. Top-down is best for reading shape.",
  },
  {
    target: "overlays",
    titleKo: "③ 전술 오버레이",
    titleEn: "③ Tactical overlays",
    bodyKo: "경기장 위에 분석 정보를 겹쳐 봅니다. 점유 히트맵은 우리가 어디를 점유했는지, 팀 블록은 수비 대형이 얼마나 촘촘한지 보여줍니다.",
    bodyEn: "Layer analysis onto the pitch: heatmap shows where you occupied, team block shows how compact your shape is.",
  },
  {
    target: "bench",
    titleKo: "④ 교체는 드래그로",
    titleEn: "④ Substitute by dragging",
    bodyKo: "벤치 카드를 집어 경기장의 선수 위로 끌어다 놓으면 교체됩니다. 대상 선수에 빨간 표시가 뜹니다.",
    bodyEn: "Grab a bench card and drop it on a player. The target is ringed in red.",
  },
  {
    target: "progress",
    titleKo: "⑤ 전반·후반과 남은 시간",
    titleEn: "⑤ Halves and time remaining",
    bodyKo: "지금이 전반인지 후반인지, 몇 분 남았는지 여기서 확인합니다. 막대 위의 점은 골과 경고가 일어난 시점이라, 경기가 어떻게 흘러왔는지 한눈에 보입니다.",
    bodyEn: "See which half you're in and how long is left. Dots on the bar mark goals and cards, so you can read how the match unfolded.",
  },
  {
    target: "playback",
    titleKo: "⑥ 경기 재생",
    titleEn: "⑥ Play the match",
    bodyKo: "재생을 누르면 경기가 분 단위로 진행됩니다. 배속(3·6·12x)으로 빠르게 넘길 수 있고, 슬라이더로 원하는 시점으로 이동합니다.",
    bodyEn: "Press play to run the match minute by minute. Use 3/6/12× to speed up, or scrub with the slider.",
  },
  {
    target: "presets",
    titleKo: "⑦ 전술 프리셋 — 여기서 시작하세요",
    titleEn: "⑦ Tactical presets — start here",
    bodyKo: "게겐프레싱·역습·버스 세우기 같은 이름 있는 전술입니다. 각 카드에 적용했을 때의 예상 승리 확률이 미리 표시되고, 카드를 누르면 그 전술이 무엇을 얻고 무엇을 내주는지 함께 보여줍니다.",
    bodyEn: "Named identities like Gegenpress, Counter, or Park the bus. Each card previews the win probability it would give you, and opening one shows what it gains and what it costs.",
  },
  {
    target: "tactics",
    titleKo: "⑧ 세부 조정도 즉시 반영됩니다",
    titleEn: "⑧ Fine-tuning applies instantly",
    bodyKo: "공격 성향·수비 라인·압박을 직접 움직이면 선수 배치와 승리 확률이 곧바로 바뀌고, 변화량이 화면에 표시됩니다.",
    bodyEn: "Move Attack, Line, or Press yourself — the shape and win probability respond immediately, and the change is shown on screen.",
  },
  {
    target: "coach",
    titleKo: "⑨ AI 코치가 근거와 함께 제안합니다",
    titleEn: "⑨ The AI coach explains itself",
    bodyKo: "상황에 맞는 전술을 신뢰도와 근거 수치를 붙여 제안합니다. 경기 중에는 화면 아래쪽에도 즉시 조치가 뜹니다.",
    bodyEn: "Recommendations come with confidence and the numbers behind them. Urgent calls also appear over the pitch.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function Tutorial() {
  const lang = useGame((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  /*
   * 첫 방문에만 자동 실행 — 단, **라운드 브리핑이 닫힌 뒤에** 시작한다.
   * 둘이 동시에 뜨면 튜토리얼 스포트라이트가 브리핑 모달을 덮어 양쪽 다 못 읽는다.
   */
  const briefingOpen = useGame((s) => s.briefingOpen);
  useEffect(() => {
    /*
     * 이미 열려 있으면 **닫는다.** 여는 것만 막았더니 소용이 없었다 —
     * 첫 렌더에서는 briefingOpen 이 아직 false(스토어 초기값)라 튜토리얼이 먼저 열리고,
     * 그 다음 프레임에 브리핑이 true로 바꿔도 열린 튜토리얼은 그대로 남았다.
     */
    if (briefingOpen) {
      setOpen(false);
      return;
    }
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* 프라이빗 모드 등 — 조용히 넘어간다 */
    }
  }, [briefingOpen]);

  // 외부(도움말 버튼)에서 다시 열 수 있게
  useEffect(() => {
    const handler = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("wcd:tour:open", handler);
    return () => window.removeEventListener("wcd:tour:open", handler);
  }, []);

  const measure = useCallback(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[i].target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [open, i]);

  useLayoutEffect(() => {
    measure();
    // 스크롤 애니메이션이 끝난 뒤 한 번 더 잡는다
    const id = setTimeout(measure, 380);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
    setI(0);
  };

  // 키보드 조작 — 방향키/ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (i < STEPS.length - 1) setI((v) => v + 1);
        else finish();
      } else if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  if (!open) return null;

  const step = STEPS[i];
  const title = lang === "ko" ? step.titleKo : step.titleEn;
  const body = lang === "ko" ? step.bodyKo : step.bodyEn;

  // 말풍선 위치 — 하이라이트 아래가 기본, 화면 밖으로 나가면 위로 뒤집는다
  const pad = 8;
  const cardW = 340;
  const below = rect ? rect.top + rect.height + 12 : 0;
  const flip = rect ? below + 190 > window.innerHeight : false;
  const cardTop = rect ? (flip ? Math.max(12, rect.top - 190) : below) : 0;
  const cardLeft = rect
    ? Math.max(12, Math.min(window.innerWidth - cardW - 12, rect.left + rect.width / 2 - cardW / 2))
    : 0;

  return (
    <div className="fixed inset-0 z-[90]">
      {/* 스포트라이트 — 큰 box-shadow로 주변만 어둡게 만든다 */}
      {rect ? (
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="pointer-events-none absolute rounded-lg"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(4,7,11,0.82)",
            border: "2px solid #3987e5",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-surface-base/85" />
      )}

      {/* 클릭 차단 — 투어 중 실수로 조작되지 않게 */}
      <div className="absolute inset-0" onClick={() => {}} />

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
          className="absolute rounded-lg border border-surface-line bg-surface-raised p-4 shadow-2xl"
          style={
            rect
              ? { top: cardTop, left: cardLeft, width: cardW }
              : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: cardW }
          }
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="metric-num text-[10px] font-bold text-team-home">
              {i + 1} / {STEPS.length}
            </span>
            <div className="ml-auto flex gap-1">
              {STEPS.map((_, n) => (
                <span
                  key={n}
                  className="h-1 w-4 rounded-full transition"
                  style={{ background: n <= i ? "#3987e5" : "#2b333f" }}
                />
              ))}
            </div>
          </div>

          <h3 className="mb-1.5 text-sm font-bold leading-snug text-ink-primary">{title}</h3>
          <p className="mb-3 text-[12px] leading-relaxed text-ink-secondary">{body}</p>

          <div className="flex items-center gap-2">
            <button
              onClick={finish}
              className="text-[11px] font-semibold text-ink-muted transition hover:text-ink-secondary"
            >
              {t(lang, "tour.skip")}
            </button>
            <div className="ml-auto flex gap-2">
              {i > 0 && (
                <button
                  onClick={() => setI((v) => v - 1)}
                  className="rounded-md border border-surface-line px-3 py-1.5 text-[11px] font-semibold text-ink-secondary transition hover:bg-surface-hover"
                >
                  {t(lang, "tour.prev")}
                </button>
              )}
              <button
                onClick={() => (i < STEPS.length - 1 ? setI((v) => v + 1) : finish())}
                className="rounded-md border border-team-home bg-team-home px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-team-home/85"
              >
                {i < STEPS.length - 1 ? t(lang, "tour.next") : t(lang, "tour.done")}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** 헤더의 도움말 버튼 — 언제든 투어를 다시 연다 */
export function TutorialButton({ lang }: { lang: Lang }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("wcd:tour:open"))}
      className="chip border border-team-home/50 bg-team-home/15 text-team-home transition hover:bg-team-home/25"
      title={t(lang, "tour.replay")}
    >
      ? {t(lang, "tour.help")}
    </button>
  );
}
