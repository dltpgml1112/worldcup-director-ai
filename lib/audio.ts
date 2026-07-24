/**
 * 무의존성 크라우드 앰비언스 — Web Audio API로 필터드 노이즈를 합성한다.
 * 외부 오디오 파일 없이 관중 웅성거림 + 골 함성을 생성. 사용자 제스처(토글 클릭) 후 시작.
 */

let ctx: AudioContext | null = null;
let noise: AudioBufferSourceNode | null = null;
let crowdGain: GainNode | null = null;
let bandpass: BiquadFilterNode | null = null;
let started = false;

function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const len = context.sampleRate * 2;
  const buf = context.createBuffer(1, len, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function startCrowd(): boolean {
  if (started) return true;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx);
    noise.loop = true;

    bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 480;
    bandpass.Q.value = 0.7;

    crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.035;

    noise.connect(bandpass).connect(crowdGain).connect(ctx.destination);
    noise.start();
    started = true;
    return true;
  } catch {
    started = false;
    return false;
  }
}

export function stopCrowd(): void {
  try {
    noise?.stop();
    ctx?.close();
  } catch {
    /* noop */
  }
  ctx = null;
  noise = null;
  crowdGain = null;
  bandpass = null;
  started = false;
}

export function isRunning(): boolean {
  return started;
}

/** 모멘텀 절대값(0-100)에 따라 웅성거림 세기/음색 조절 */
export function setCrowdLevel(momentumAbs: number): void {
  if (!ctx || !crowdGain || !bandpass) return;
  const t = ctx.currentTime;
  const level = 0.03 + (Math.min(100, momentumAbs) / 100) * 0.05;
  crowdGain.gain.setTargetAtTime(level, t, 0.6);
  bandpass.frequency.setTargetAtTime(420 + (momentumAbs / 100) * 260, t, 0.6);
}

/** 심판 호루라기 — 짧은 고음 삐- (전/후반 시작·종료) */
export function whistle(double = false): void {
  if (!ctx) return;
  try {
    const blow = (at: number) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(2100, at);
      osc.frequency.setValueAtTime(2000, at + 0.05);
      // 트릴(굴림) 느낌
      for (let i = 0; i < 6; i++) osc.frequency.setValueAtTime(i % 2 ? 2200 : 2000, at + 0.05 + i * 0.03);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      osc.connect(g).connect(ctx!.destination);
      osc.start(at);
      osc.stop(at + 0.34);
    };
    const t = ctx.currentTime;
    blow(t);
    if (double) blow(t + 0.42);
  } catch {
    /* noop */
  }
}

/** 골 함성 — 짧은 노이즈 스웰 + 필터 스윕 */
export function goalRoar(): void {
  if (!ctx) return;
  try {
    const roar = ctx.createBufferSource();
    roar.buffer = makeNoiseBuffer(ctx);
    roar.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;

    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.14, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    bp.frequency.exponentialRampToValueAtTime(500, t + 3.2);

    roar.connect(bp).connect(g).connect(ctx.destination);
    roar.start(t);
    roar.stop(t + 3.4);
  } catch {
    /* noop */
  }
}
