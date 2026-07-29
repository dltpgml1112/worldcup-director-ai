"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * 용어 설명 툴팁.
 *
 * "컴팩트니스 62/100"이 무슨 뜻인지 알 방법이 없다는 게 첫 사용자의 가장 큰 벽이었다.
 * 모든 지표 옆에 붙여 스스로 설명하게 한다 (Football Manager가 속성마다 설명을 다는 방식).
 * 마우스뿐 아니라 키보드 포커스로도 열려 접근성을 유지한다.
 */
export default function InfoTip({
  text,
  align = "right",
}: {
  text: string;
  /** 말풍선이 화면 밖으로 나가지 않도록 정렬 방향을 지정한다 */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="grid h-3.5 w-3.5 place-items-center rounded-full border border-surface-line text-[8px] font-bold leading-none text-ink-muted transition hover:border-team-home hover:text-team-home"
      >
        ?
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            role="tooltip"
            className={`pointer-events-none absolute bottom-full z-[70] mb-1.5 w-56 rounded-md border border-surface-line bg-surface-raised px-2.5 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ink-secondary shadow-xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
