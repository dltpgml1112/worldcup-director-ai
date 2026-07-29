"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PITCH, fromWorld, type PitchPoint } from "@/lib/pitchPositions";
import { TURF_MARGIN, netTexture, standTexture, turfTexture } from "@/lib/pitchTextures";

/**
 * 경기장 배경 지오메트리 — 전술 보드(Pitch3D)와 랜딩 히어로(HeroPitch3D)가 공유한다.
 * 상태에 의존하지 않는 순수 표현 컴포넌트만 모아둔다.
 */

const TILT = Math.atan2(11.5, 22);

function Stand({ axis, sign, span }: { axis: "x" | "z"; sign: 1 | -1; span: number }) {
  const tex = standTexture();
  const half = 12.4;
  const d0 = axis === "x" ? PITCH.width / 2 + TURF_MARGIN + 4 : PITCH.length / 2 + TURF_MARGIN + 4;
  const cx = Math.cos(TILT) * half;
  const cy = 1.5 + Math.sin(TILT) * half;

  const position: [number, number, number] =
    axis === "x" ? [sign * (d0 + cx), cy, 0] : [0, cy, sign * (d0 + cx)];
  const rotation: [number, number, number] =
    axis === "x" ? [0, 0, sign === 1 ? TILT : -TILT] : [sign === 1 ? -TILT : TILT, 0, 0];
  const size: [number, number, number] = axis === "x" ? [24.8, 1.2, span] : [span, 1.2, 24.8];

  // 좌석 점(관중) — 스탠드 로컬 좌표에 뿌린 뒤 같은 그룹 변환을 태운다
  const crowd = useMemo(() => {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = ["#3987e5", "#d95926", "#e8ecf1", "#9aa4b2", "#c98500"].map(
      (c) => new THREE.Color(c)
    );
    for (let i = 0; i < count; i++) {
      const a = (Math.random() - 0.5) * 24;
      const b = (Math.random() - 0.5) * span * 0.98;
      if (axis === "x") {
        pos[i * 3] = a;
        pos[i * 3 + 2] = b;
      } else {
        pos[i * 3] = b;
        pos[i * 3 + 2] = a;
      }
      pos[i * 3 + 1] = 0.9;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { pos, col, count };
  }, [axis, span]);

  return (
    <group position={position} rotation={rotation}>
      {/* 스탠드 구조물 — 너무 어두우면 관중 점만 허공에 뜬 것처럼 보인다 */}
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial map={tex} color="#2b3441" roughness={0.9} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[crowd.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[crowd.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.5} vertexColors sizeAttenuation transparent opacity={0.6} />
      </points>
    </group>
  );
}

function Floodlight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 28, 8]} />
        <meshStandardMaterial color="#2a323d" roughness={0.8} />
      </mesh>
      <mesh position={[0, 28.6, 0]}>
        <boxGeometry args={[6, 3, 1]} />
        <meshStandardMaterial color="#0f141b" emissive="#fdf6d8" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

export function Stadium() {
  const spanX = PITCH.length + TURF_MARGIN * 2 + 30;
  const spanZ = PITCH.width + TURF_MARGIN * 2 + 30;
  const cx = PITCH.width / 2 + TURF_MARGIN + 24;
  const cz = PITCH.length / 2 + TURF_MARGIN + 24;
  return (
    <group>
      {/* 콘코스 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[260, 300]} />
        <meshStandardMaterial color="#0b0f14" roughness={1} />
      </mesh>
      <Stand axis="x" sign={1} span={spanX} />
      <Stand axis="x" sign={-1} span={spanX} />
      <Stand axis="z" sign={1} span={spanZ} />
      <Stand axis="z" sign={-1} span={spanZ} />
      <Floodlight x={cx} z={cz} />
      <Floodlight x={-cx} z={cz} />
      <Floodlight x={cx} z={-cz} />
      <Floodlight x={-cx} z={-cz} />
    </group>
  );
}

export function Goal({ sign }: { sign: 1 | -1 }) {
  const net = netTexture();
  const w = 7.32;
  const h = 2.44;
  const d = 2;
  const z = (sign * PITCH.length) / 2;
  const post = <cylinderGeometry args={[0.07, 0.07, h, 10]} />;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[-w / 2, h / 2, 0]}>{post}<meshStandardMaterial color="#f2f5f9" roughness={0.4} /></mesh>
      <mesh position={[w / 2, h / 2, 0]}>{post}<meshStandardMaterial color="#f2f5f9" roughness={0.4} /></mesh>
      <mesh position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, w, 10]} />
        <meshStandardMaterial color="#f2f5f9" roughness={0.4} />
      </mesh>
      {/* 뒷그물 */}
      <mesh position={[0, h / 2, sign * d]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={net} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* 옆그물 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, h / 2, (sign * d) / 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshBasicMaterial map={net} transparent opacity={0.38} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* 윗그물 */}
      <mesh position={[0, h, (sign * d) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial map={net} transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function CornerFlags() {
  const pts: [number, number][] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([(sx * PITCH.width) / 2, (sz * PITCH.length) / 2]);
  return (
    <group>
      {pts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.5, 6]} />
            <meshStandardMaterial color="#e8ecf1" />
          </mesh>
          <mesh position={[0.3, 1.3, 0]}>
            <planeGeometry args={[0.6, 0.4]} />
            <meshStandardMaterial color="#c98500" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 잔디. onDragMove를 주면 선수 드래그용 레이캐스트 평면으로 동작한다 */
export function Turf({ onDragMove }: { onDragMove?: (p: PitchPoint) => void }) {
  const tex = turfTexture();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={
        onDragMove
          ? (e: ThreeEvent<PointerEvent>) => onDragMove(fromWorld(e.point.x, e.point.z))
          : undefined
      }
    >
      <planeGeometry args={[PITCH.width + TURF_MARGIN * 2, PITCH.length + TURF_MARGIN * 2]} />
      <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
    </mesh>
  );
}

/**
 * 관중석 카메라 플래시 — 골이 터지면 스탠드 전역에서 하얗게 반짝인다.
 * 실제 경기장에서 득점 순간 가장 눈에 띄는 시각 신호라, 골 연출의 핵심 요소.
 * 점 하나짜리 additive 포인트라 비용이 거의 없다.
 */
export function CrowdFlashes({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 160;

  const { positions, phase } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const ph = new Float32Array(COUNT);
    const halfW = PITCH.width / 2 + TURF_MARGIN + 16;
    const halfL = PITCH.length / 2 + TURF_MARGIN + 16;
    for (let i = 0; i < COUNT; i++) {
      // 스탠드 띠 위에 고르게 뿌린다 (네 변)
      const edge = i % 4;
      const u = Math.random() - 0.5;
      const depth = 4 + Math.random() * 18;
      if (edge === 0) { pos[i * 3] = halfW + depth; pos[i * 3 + 2] = u * halfL * 2; }
      else if (edge === 1) { pos[i * 3] = -(halfW + depth); pos[i * 3 + 2] = u * halfL * 2; }
      else if (edge === 2) { pos[i * 3] = u * halfW * 2; pos[i * 3 + 2] = halfL + depth; }
      else { pos[i * 3] = u * halfW * 2; pos[i * 3 + 2] = -(halfL + depth); }
      pos[i * 3 + 1] = 4 + Math.random() * 10;
      ph[i] = Math.random() * 100;
    }
    return { positions: pos, phase: ph };
  }, []);

  useFrame((state) => {
    const p = ref.current;
    if (!p) return;
    p.visible = active;
    if (!active) return;
    // 각 점이 서로 다른 주기로 짧게 터진다 — 규칙적이지 않게 보이도록
    const tt = state.clock.elapsedTime * 9;
    const mat = p.material as THREE.PointsMaterial;
    const attr = p.geometry.getAttribute("size") as THREE.BufferAttribute | undefined;
    if (attr) {
      for (let i = 0; i < COUNT; i++) {
        const v = Math.sin(tt + phase[i]);
        attr.setX(i, v > 0.88 ? 2.6 : 0);
      }
      attr.needsUpdate = true;
    }
    mat.opacity = 0.95;
  });

  const sizes = useMemo(() => new Float32Array(COUNT), []);

  return (
    <points ref={ref} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={2.4}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** 두 씬이 공유하는 조명 세트 */
export function PitchLights() {
  return (
    <>
      <hemisphereLight args={["#cfe3ff", "#1a2a20", 0.85]} />
      <directionalLight position={[40, 70, 30]} intensity={1.5} color="#fff6e0" />
      <directionalLight position={[-50, 50, -40]} intensity={0.55} color="#9fc4ff" />
    </>
  );
}
