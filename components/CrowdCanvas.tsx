"use client";

import { useEffect, useRef } from "react";

/** 관중석 + 카메라 플래시 + 조명 스윕을 canvas로 그리는 분위기 레이어 */
export default function CrowdCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0,
      h = 0;
    const dots: { x: number; y: number; base: number; hue: number; sp: number; ph: number }[] = [];
    const flashes: { x: number; y: number; life: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots.length = 0;
      const cols = Math.floor(w / 10);
      const rows = Math.floor((h * 0.62) / 9);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: c * 10 + (r % 2) * 5 + 3,
            y: r * 9 + 6,
            base: 0.12 + Math.random() * 0.25,
            hue: 210 + Math.random() * 40,
            sp: 0.4 + Math.random() * 1.6,
            ph: Math.random() * Math.PI * 2,
          });
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const render = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // 관중
      for (const d of dots) {
        const tw = d.base + Math.sin(t * d.sp + d.ph) * 0.08;
        ctx.fillStyle = `hsla(${d.hue}, 45%, ${40 + tw * 60}%, ${0.35 + tw})`;
        ctx.fillRect(d.x, d.y, 2.2, 2.2);
      }

      // 카메라 플래시
      if (Math.random() < 0.14) {
        flashes.push({ x: Math.random() * w, y: Math.random() * h * 0.6, life: 1 });
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2 + (1 - f.life) * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${f.life})`;
        ctx.fill();
        f.life -= 0.06;
        if (f.life <= 0) flashes.splice(i, 1);
      }

      // 조명 스윕
      const sweepX = (Math.sin(t * 0.25) * 0.5 + 0.5) * w;
      const g = ctx.createRadialGradient(sweepX, h * 0.1, 0, sweepX, h * 0.1, h * 0.9);
      g.addColorStop(0, "rgba(120,180,255,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
