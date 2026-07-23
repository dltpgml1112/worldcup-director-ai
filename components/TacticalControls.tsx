"use client";

import { useGame } from "@/lib/store";
import { FORMATION_KEYS } from "@/lib/formations";
import type { Tactics } from "@/lib/types";
import { t } from "@/lib/i18n";

const SLIDERS: { key: keyof Tactics; k: string }[] = [
  { key: "attack", k: "ctrl.attack" },
  { key: "line", k: "ctrl.line" },
  { key: "press", k: "ctrl.press" },
  { key: "tempo", k: "ctrl.tempo" },
  { key: "width", k: "ctrl.width" },
];

const TOGGLES: { key: keyof Tactics; k: string }[] = [
  { key: "counter", k: "ctrl.counter" },
  { key: "highPress", k: "ctrl.highPress" },
  { key: "offsideTrap", k: "ctrl.offsideTrap" },
];

export default function TacticalControls() {
  const formation = useGame((s) => s.formation);
  const setFormation = useGame((s) => s.setFormation);
  const tactics = useGame((s) => s.tactics);
  const setTactic = useGame((s) => s.setTactic);
  const lang = useGame((s) => s.lang);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">{t(lang, "ctrl.formation")}</div>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        {FORMATION_KEYS.map((f) => (
          <button
            key={f}
            onClick={() => setFormation(f)}
            className={`rounded-lg py-2 font-display text-sm font-bold transition ${
              formation === f ? "bg-neon-grass text-night-900 shadow-glow" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">{t(lang, s.k)}</span>
              <span className="tabular-nums text-neon-grass">{tactics[s.key] as number}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={tactics[s.key] as number}
              onChange={(e) => setTactic(s.key, Number(e.target.value) as never)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-white/35">
              <span>{t(lang, `${s.k}.lo`)}</span>
              <span>{t(lang, `${s.k}.hi`)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {TOGGLES.map((tg) => {
          const on = tactics[tg.key] as boolean;
          return (
            <button
              key={tg.key}
              onClick={() => setTactic(tg.key, !on as never)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                on ? "border-neon-grass/50 bg-neon-grass/15 text-neon-grass" : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              <span>{t(lang, tg.k)}</span>
              <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-neon-grass" : "bg-white/20"}`}>
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-night-900 transition-all"
                  style={{ left: on ? "18px" : "2px" }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
