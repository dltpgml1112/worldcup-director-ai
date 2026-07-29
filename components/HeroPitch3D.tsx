"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FORMATIONS } from "@/lib/formations";
import {
  ballReactionPositions,
  toWorld,
  type PitchPoint,
  type ReactionInput,
} from "@/lib/pitchPositions";
import { ballTexture, shadowTexture } from "@/lib/pitchTextures";
import { CornerFlags, Goal, PitchLights, Stadium, Turf } from "./PitchScenery";
import PlayerFigure from "./PlayerFigure";

/**
 * 랜딩 히어로용 경기장.
 *
 * 161팀을 훑는 투표자는 클릭 전에 이탈한다 — 이 앱의 무기(3D 경기장)를
 * 첫 화면에서 바로 보여주기 위한 씬이다. 상호작용 없이 카메라가 천천히 돌고,
 * 공이 움직이면 선수들이 실제 전술 보드와 **같은 함수**로 반응한다
 * (`ballReactionPositions`) — 랜딩에서 본 움직임이 실제 제품의 움직임이다.
 */

const BALL_R = 0.5;

/** 홈은 위로, 원정은 아래로 공격 (절대 피치 좌표) */
function buildSquads(): { home: ReactionInput[]; away: ReactionInput[] } {
  const slots = FORMATIONS["433"];
  return {
    home: slots.map((s, i) => ({
      id: `h${i}`,
      pos: { x: s.x, y: s.y },
      gk: s.role === "GK",
    })),
    away: slots.map((s, i) => ({
      id: `a${i}`,
      pos: { x: 100 - s.x, y: 100 - s.y },
      gk: s.role === "GK",
    })),
  };
}

function HeroFigure({
  color,
  target,
  phase,
}: {
  color: string;
  target: React.MutableRefObject<THREE.Vector3>;
  phase: number;
}) {
  const g = useRef<THREE.Group>(null);
  const spawned = useRef(false);
  const speed = useRef(0);
  const prev = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    if (!spawned.current) {
      grp.position.copy(target.current);
      prev.current.copy(target.current);
      spawned.current = true;
      return;
    }
    const step = Math.max(1e-4, Math.min(dt, 0.1));
    grp.position.lerp(target.current, 1 - Math.pow(0.004, step));

    const moved = grp.position.distanceTo(prev.current);
    speed.current = THREE.MathUtils.lerp(speed.current, moved / step, 0.2);
    if (moved > 0.008) {
      const yaw = Math.atan2(grp.position.x - prev.current.x, grp.position.z - prev.current.z);
      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, yaw, 0.15);
    }
    prev.current.copy(grp.position);
  });

  return (
    <group ref={g}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} />
      </mesh>
      <PlayerFigure jersey={color} speedRef={speed} phase={phase} />
    </group>
  );
}

function HeroScene({ homeColor, awayColor }: { homeColor: string; awayColor: string }) {
  const squads = useMemo(buildSquads, []);

  // 선수별 목표 위치 벡터 (매 프레임 갱신)
  const targets = useMemo(() => {
    const m = new Map<string, React.MutableRefObject<THREE.Vector3>>();
    for (const p of [...squads.home, ...squads.away]) {
      const w = toWorld(p.pos);
      m.set(p.id, { current: new THREE.Vector3(w.x, 0, w.z) });
    }
    return m;
  }, [squads]);

  const ballMesh = useRef<THREE.Mesh>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const ballPitch = useRef<PitchPoint>({ x: 50, y: 50 });
  const hop = useRef({ from: { x: 50, y: 50 }, to: { x: 50, y: 62 }, t: 0, dur: 1.6, apex: 1.2 });
  const seed = useRef(0);

  useFrame((state, dt) => {
    const step = Math.min(dt, 0.05);
    const h = hop.current;
    h.t += step / h.dur;

    if (h.t >= 1) {
      // 다음 목적지 — 아무 선수 근처로 결정론적으로 이동
      seed.current++;
      const all = [...squads.home, ...squads.away].filter((p) => !p.gk);
      const pick = all[(seed.current * 7) % all.length];
      const jitter = ((seed.current * 13) % 11) - 5;
      h.from = { ...h.to };
      h.to = {
        x: Math.max(8, Math.min(92, pick.pos.x + jitter)),
        y: Math.max(8, Math.min(92, pick.pos.y + jitter * 0.6)),
      };
      const d = Math.hypot(h.to.x - h.from.x, h.to.y - h.from.y);
      h.dur = Math.max(0.9, Math.min(2.6, d / 22));
      h.apex = d > 26 ? 4.5 : 0.9;
      h.t = 0;
    }

    const t = h.t;
    ballPitch.current = {
      x: h.from.x + (h.to.x - h.from.x) * t,
      y: h.from.y + (h.to.y - h.from.y) * t,
    };
    const bw = toWorld(ballPitch.current);
    const by = BALL_R + 4 * h.apex * t * (1 - t);

    if (ballMesh.current) {
      ballMesh.current.position.set(bw.x, by, bw.z);
      ballMesh.current.rotation.x += step * 3;
      ballMesh.current.rotation.z += step * 1.4;
    }
    if (ballShadow.current) {
      ballShadow.current.position.set(bw.x, 0.035, bw.z);
      ballShadow.current.scale.setScalar(1 + (by - BALL_R) * 0.22);
    }

    // 실제 전술 보드와 동일한 반응 함수 — 랜딩에서 본 움직임이 제품의 움직임이다
    for (const [squad, attackingUp, hasBall] of [
      [squads.home, true, true],
      [squads.away, false, false],
    ] as const) {
      const moved = ballReactionPositions(squad, ballPitch.current, {
        press: 60,
        hasBall,
        attackingUp,
      });
      moved.forEach((pos, id) => {
        const ref = targets.get(id);
        if (!ref) return;
        const w = toWorld(pos);
        ref.current.set(w.x, 0, w.z);
      });
    }

    // 시네마틱 궤도 — 천천히 한 바퀴
    const a = state.clock.elapsedTime * 0.055;
    state.camera.position.set(
      Math.sin(a) * 108,
      40 + Math.sin(a * 1.7) * 6,
      Math.cos(a) * 108
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <color attach="background" args={["#070a0e"]} />
      <fog attach="fog" args={["#070a0e", 170, 380]} />
      <PitchLights />
      <Stadium />
      <Turf />
      <Goal sign={1} />
      <Goal sign={-1} />
      <CornerFlags />

      {squads.home.map((p, i) => (
        <HeroFigure
          key={p.id}
          color={p.gk ? "#c98500" : homeColor}
          target={targets.get(p.id)!}
          phase={i * 0.7}
        />
      ))}
      {squads.away.map((p, i) => (
        <HeroFigure
          key={p.id}
          color={p.gk ? "#c98500" : awayColor}
          target={targets.get(p.id)!}
          phase={i * 0.7 + 3.1}
        />
      ))}

      <mesh ref={ballMesh}>
        <sphereGeometry args={[BALL_R, 20, 16]} />
        <meshStandardMaterial map={ballTexture()} roughness={0.45} emissive="#20262e" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={ballShadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} opacity={0.85} />
      </mesh>
    </>
  );
}

export default function HeroPitch3D({
  homeColor = "#c8102e",
  awayColor = "#e8ecf1",
}: {
  homeColor?: string;
  awayColor?: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 44, 108], fov: 40, near: 1, far: 900 }}
      // 배경 연출이므로 포인터 이벤트를 먹지 않는다 (위의 폼이 항상 클릭 가능해야 한다)
      style={{ pointerEvents: "none" }}
    >
      <HeroScene homeColor={homeColor} awayColor={awayColor} />
    </Canvas>
  );
}
