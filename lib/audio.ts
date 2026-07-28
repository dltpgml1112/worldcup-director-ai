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

/** 지금 소리가 실제로 나는 상태인가 — 일시정지 중엔 효과음을 예약하지 않는다 */
export function isActive(): boolean {
  return started && ctx?.state === "running";
}

/**
 * 경기 일시정지 시 사운드도 같이 멈춘다.
 * gain을 0으로 줄이는 대신 컨텍스트를 suspend해서, 정지 중 예약된 효과음이
 * 재개 순간 한꺼번에 터지는 일이 없게 한다.
 */
export function pauseCrowd(): void {
  try {
    if (ctx?.state === "running") void ctx.suspend();
  } catch {
    /* noop */
  }
}

export function resumeCrowd(): void {
  try {
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {
    /* noop */
  }
}

/** 모멘텀 절대값(0-100)에 따라 웅성거림 세기/음색 조절 */
export function setCrowdLevel(momentumAbs: number): void {
  if (!ctx || !crowdGain || !bandpass) return;
  const t = ctx.currentTime;
  const level = 0.03 + (Math.min(100, momentumAbs) / 100) * 0.05;
  crowdGain.gain.setTargetAtTime(level, t, 0.6);
  bandpass.frequency.setTargetAtTime(420 + (momentumAbs / 100) * 260, t, 0.6);
}

/**
 * 심판 호루라기 한 번.
 *
 * 실제 피(pea) 호루라기는 순음이 아니라 두 개의 근접 배음이 맥놀이를 만들고
 * 코르크가 굴러가며 트릴이 생긴다. 그래서 오실레이터 2개를 살짝 어긋난 주파수로
 * 겹치고, 숨소리용 노이즈를 섞은 뒤 짧은 지연 잔향을 붙여 경기장 느낌을 낸다.
 */
function blowWhistle(at: number, dur: number, level: number): void {
  if (!ctx) return;
  const c = ctx;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(level, at + 0.02);
  out.gain.setValueAtTime(level, at + dur - 0.08);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  // 맥놀이를 만드는 두 개의 근접 배음
  for (const [base, detune, gain] of [
    [2150, 0, 1],
    [2150, 17, 0.7],
    [4300, 0, 0.18],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, at);
    osc.detune.setValueAtTime(detune, at);
    // 코르크 트릴
    const steps = Math.max(4, Math.floor(dur / 0.028));
    for (let i = 0; i < steps; i++) {
      osc.frequency.setValueAtTime(base + (i % 2 ? 70 : -70), at + i * 0.028);
    }
    const g = c.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // 숨소리 (노이즈)
  const breath = c.createBufferSource();
  breath.buffer = makeNoiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 1.4;
  const bg = c.createGain();
  bg.gain.value = 0.1;
  breath.connect(bp).connect(bg).connect(out);
  breath.start(at);
  breath.stop(at + dur + 0.02);

  // 경기장 잔향 — 짧은 지연 + 감쇠
  const delay = c.createDelay(0.4);
  delay.delayTime.value = 0.11;
  const fb = c.createGain();
  fb.gain.value = 0.22;
  delay.connect(fb).connect(delay);
  const wet = c.createGain();
  wet.gain.value = 0.3;
  out.connect(delay).connect(wet).connect(c.destination);
  out.connect(c.destination);
}

/** 심판 호루라기 — 전/후반 종료는 double */
export function whistle(double = false): void {
  if (!isActive()) return;
  try {
    const t = ctx!.currentTime;
    blowWhistle(t, 0.34, 0.075);
    if (double) blowWhistle(t + 0.42, 0.34, 0.075);
  } catch {
    /* noop */
  }
}

/** 킥오프 — 길게 한 번 불고 관중이 살아난다 */
export function kickoffWhistle(): void {
  if (!isActive()) return;
  try {
    const t = ctx!.currentTime;
    blowWhistle(t, 0.72, 0.09);

    // 관중 환호 스웰
    const c = ctx!;
    const swell = c.createBufferSource();
    swell.buffer = makeNoiseBuffer(c);
    swell.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(760, t + 0.9);
    bp.frequency.exponentialRampToValueAtTime(420, t + 2.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    swell.connect(bp).connect(g).connect(c.destination);
    swell.start(t);
    swell.stop(t + 3);
  } catch {
    /* noop */
  }
}

/** 카드 — 짧고 날카로운 휘슬 + 관중 야유 */
export function cardSound(red = false): void {
  if (!isActive()) return;
  try {
    const c = ctx!;
    const t = c.currentTime;
    blowWhistle(t, 0.2, 0.085);

    // 야유 — 낮은 대역 노이즈 스웰
    const boo = c.createBufferSource();
    boo.buffer = makeNoiseBuffer(c);
    boo.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "bandpass";
    lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + 1.6);
    const g = c.createGain();
    const peak = red ? 0.2 : 0.12;
    g.gain.setValueAtTime(0.0001, t + 0.15);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (red ? 2.6 : 1.9));
    boo.connect(lp).connect(g).connect(c.destination);
    boo.start(t);
    boo.stop(t + (red ? 2.8 : 2.1));
  } catch {
    /* noop */
  }
}

/** 골 함성 — 짧은 노이즈 스웰 + 필터 스윕 */
export function goalRoar(): void {
  if (!isActive() || !ctx) return;
  const c = ctx;
  try {
    const roar = c.createBufferSource();
    roar.buffer = makeNoiseBuffer(c);
    roar.loop = true;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;

    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.14, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    bp.frequency.exponentialRampToValueAtTime(500, t + 3.2);

    roar.connect(bp).connect(g).connect(c.destination);
    roar.start(t);
    roar.stop(t + 3.4);
  } catch {
    /* noop */
  }
}
