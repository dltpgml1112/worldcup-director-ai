"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import CrowdCanvas from "@/components/CrowdCanvas";
import { COUNTRIES, YEARS, findMatch } from "@/data/matches";
import { useGame } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const setup = useGame((s) => s.setup);
  const [name, setName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0].id);
  const [opponent, setOpponent] = useState(COUNTRIES[1].id);
  const [year, setYear] = useState(YEARS[0]);

  const start = () => {
    const match = findMatch(country, opponent, year);
    setup({ coachName: name.trim() || "Coach", matchId: match?.id ?? "final-2022" });
    router.push("/match");
  };

  const match = findMatch(country, opponent, year);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <CrowdCanvas className="absolute inset-0 h-full w-full opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-night-900/40 to-night-900" />

      {/* 조명 */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[80vw] -translate-x-1/2 rounded-full bg-neon-ice/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="chip mx-auto mb-4 bg-white/10 text-white/70">🏆 The Immersive Tactical Simulator</div>
          <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl">
            World Cup <span className="bg-gradient-to-r from-neon-grass to-neon-gold bg-clip-text text-transparent">Director</span> AI
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
            What if <span className="font-semibold text-white">YOU</span> were the coach? Replay real World Cup finals,
            command the tactical board, and rewrite history.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="glass-strong mt-10 w-full max-w-2xl rounded-3xl p-6 sm:p-8"
        >
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-white/50">Coach Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name, boss…"
            className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-neon-grass"
          />

          <Picker label="Your Country" value={country} onChange={setCountry}
            options={COUNTRIES.map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))} />

          <Picker label="Opponent" value={opponent} onChange={setOpponent}
            options={COUNTRIES.filter((c) => c.id !== country).map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))} />

          <Picker label="World Cup Year" value={String(year)} onChange={(v) => setYear(Number(v))}
            options={YEARS.map((y) => ({ id: String(y), label: `${y}` }))} />

          {match && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
              Loading real data: <span className="font-semibold text-white">{match.home.name} vs {match.away.name}</span>, {match.year} {match.stage}
            </div>
          )}

          <motion.button whileTap={{ scale: 0.97 }} onClick={start} className="btn-primary mt-6 w-full">
            <span className="relative z-10">⚽ Start My World Cup</span>
            <span className="absolute inset-0 -skew-x-12 bg-white/30 mix-blend-overlay animate-sweep" />
          </motion.button>
        </motion.div>

        <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-white/40">
          {["Real match data", "Minute-by-minute engine", "Drag-drop tactics", "AI coach", "Alternate history"].map((f) => (
            <span key={f} className="chip bg-white/5">{f}</span>
          ))}
        </div>
      </div>
    </main>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/50">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border px-4 py-2 font-semibold transition ${
              value === o.id
                ? "border-neon-grass bg-neon-grass/15 text-neon-grass shadow-glow"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
