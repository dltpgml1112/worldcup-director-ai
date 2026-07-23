"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { playerStamina, staminaTone } from "@/lib/stamina";

const MAX_SUBS = 5;

export default function SubstitutionPanel() {
  const players = useGame((s) => s.players);
  const bench = useGame((s) => s.bench);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const subsUsed = useGame((s) => s.subsUsed);
  const makeSub = useGame((s) => s.makeSub);
  const [selected, setSelected] = useState<string | null>(null);

  const outOfSubs = subsUsed >= MAX_SUBS;
  const selectedPlayer = players.find((p) => p.id === selected);

  const doSub = (onId: string) => {
    if (!selected) return;
    makeSub(selected, onId);
    setSelected(null);
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Substitutions & Stamina</span>
        <span className={`chip ${outOfSubs ? "bg-white/5 text-white/40" : "bg-neon-grass/15 text-neon-grass"}`}>
          {subsUsed}/{MAX_SUBS} used
        </span>
      </div>

      {/* 온-피치 선수 스태미나 */}
      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {players.map((p) => {
          const s = playerStamina(p, minute, tactics);
          const tone = staminaTone(s);
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(active ? null : p.id)}
              disabled={outOfSubs}
              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "border-neon-grass bg-neon-grass/10" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="w-6 shrink-0 text-center font-display text-xs font-bold tabular-nums text-white/60">{p.num}</span>
              <span className="w-8 shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/40">{p.role}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className="flex w-24 shrink-0 items-center gap-1.5">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${s}%`, background: tone.color }} />
                </span>
                <span className="w-7 text-right text-[10px] font-bold tabular-nums" style={{ color: tone.color }}>
                  {Math.round(s)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 벤치 선택 */}
      <AnimatePresence>
        {selectedPlayer && !outOfSubs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="mb-2 text-[11px] text-white/50">
              Replace <span className="font-bold text-neon-red">{selectedPlayer.name}</span> — pick from the bench:
            </div>
            {bench.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                Bench empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {bench.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => doSub(b.id)}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left transition hover:border-neon-grass/50 hover:bg-neon-grass/10"
                  >
                    <span className="w-6 shrink-0 text-center font-display text-xs font-bold tabular-nums text-white/60">{b.num}</span>
                    <span className="w-8 shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/40">{b.role}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.name}</span>
                    <span className="chip bg-white/5 text-[10px] text-neon-grass">{b.rating} OVR</span>
                    <span className="text-xs text-neon-grass">↑ ON</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {outOfSubs && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/40">
          All {MAX_SUBS} substitutions used.
        </div>
      )}
    </div>
  );
}
