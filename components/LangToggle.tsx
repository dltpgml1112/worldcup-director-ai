"use client";

import { useGame } from "@/lib/store";
import type { Lang } from "@/lib/i18n";

export default function LangToggle() {
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const opts: { id: Lang; label: string }[] = [
    { id: "ko", label: "한국어" },
    { id: "en", label: "EN" },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setLang(o.id)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            lang === o.id ? "bg-neon-grass text-night-900" : "text-white/60 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
