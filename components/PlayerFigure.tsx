"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * 선수 형상 — 전술 보드(Pitch3D)와 랜딩 히어로(HeroPitch3D)가 공유한다.
 *
 * 원통 3개짜리 이전 모델이 '레고'처럼 보였던 이유는 비율이 사람과 달랐기 때문이다.
 * 여기서는 실제 인체 비율(머리:몸 ≈ 1:7)에 맞춰 머리·목·상체·반바지·다리·팔·축구화를
 * 나누고, 이동 속도에 따라 팔다리를 흔들고 상체를 앞으로 기울인다.
 *
 * 성능: 22명이 동시에 서므로 지오메트리와 머티리얼을 모듈 레벨에서 한 번만 만들어
 * 모든 선수가 공유한다 (인스턴스마다 새로 만들면 GPU 메모리가 22배로 든다).
 */

/**
 * 부위 치수 — 발이 지면(y=0)에 닿고 정수리가 약 1.73m가 되도록 잡았다.
 * 바깥에서 FIGURE_SCALE로 키워 최종 1.94m가 된다 (105m 경기장에서 보이는 크기).
 * 허리 높이 = HIP. 다리·상체 그룹의 회전축이 여기다.
 */
const HIP = 0.78;
const FIGURE_SCALE = 1.12;

const G = {
  head: new THREE.SphereGeometry(0.123, 16, 12),
  hair: new THREE.SphereGeometry(0.129, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  neck: new THREE.CylinderGeometry(0.063, 0.068, 0.09, 8),
  torso: new THREE.CapsuleGeometry(0.194, 0.39, 4, 12),
  shorts: new THREE.CylinderGeometry(0.21, 0.228, 0.3, 12),
  // 허리에서 지면까지 닿아야 한다 (총 0.736 = 0.60 + 반지름 2개)
  leg: new THREE.CapsuleGeometry(0.068, 0.6, 3, 8),
  arm: new THREE.CapsuleGeometry(0.059, 0.365, 3, 8),
  boot: new THREE.BoxGeometry(0.125, 0.07, 0.25),
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.7): THREE.MeshStandardMaterial {
  const key = `${color}:${roughness}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    matCache.set(key, m);
  }
  return m;
}

/** 유니폼 상의보다 어두운 하의 — 팀 색에서 파생시켜 항상 조화롭게 나온다 */
function darken(color: string, k = 0.55): string {
  const c = new THREE.Color(color);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

export interface FigureProps {
  jersey: string;
  /** 이동 속도(m/s). 팔다리 스윙과 상체 기울기를 결정한다 */
  speedRef?: MutableRefObject<number>;
  /** 세리머니 — 양팔을 들고 뛴다 */
  celebrating?: boolean;
  /** 위상 분산용 (선수마다 다른 값) */
  phase?: number;
}

export default function PlayerFigure({ jersey, speedRef, celebrating, phase = 0 }: FigureProps) {
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const cycle = useRef(0);

  const mats = useMemo(
    () => ({
      jersey: mat(jersey, 0.62),
      shorts: mat(darken(jersey, 0.5), 0.7),
      skin: mat("#c99b74", 0.85),
      hair: mat("#20181a", 0.95),
      sock: mat(darken(jersey, 0.35), 0.8),
      boot: mat("#14181e", 0.5),
    }),
    [jersey]
  );

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const speed = speedRef?.current ?? 0;

    if (celebrating) {
      // 두 팔을 위로 들고 제자리에서 뛴다
      cycle.current += step * 9;
      const s = Math.sin(cycle.current + phase);
      if (armL.current) armL.current.rotation.x = -2.5 + s * 0.25;
      if (armR.current) armR.current.rotation.x = -2.5 - s * 0.25;
      if (legL.current) legL.current.rotation.x = s * 0.3;
      if (legR.current) legR.current.rotation.x = -s * 0.3;
      if (upper.current) upper.current.rotation.x = -0.12;
      return;
    }

    // 보폭은 속도에 비례 — 서 있으면 흔들리지 않는다
    const gait = Math.min(1, speed / 6);
    cycle.current += step * (2.2 + speed * 1.5);
    const s = Math.sin(cycle.current + phase);

    if (legL.current) legL.current.rotation.x = s * 0.85 * gait;
    if (legR.current) legR.current.rotation.x = -s * 0.85 * gait;
    // 팔은 다리와 반대로 (자연스러운 걸음)
    if (armL.current) armL.current.rotation.x = -s * 0.6 * gait;
    if (armR.current) armR.current.rotation.x = s * 0.6 * gait;
    // 빠를수록 상체를 앞으로 기울인다
    if (upper.current) upper.current.rotation.x = gait * 0.22;
  });

  return (
    <group scale={FIGURE_SCALE}>
      {/* 다리 — 고관절에서 회전시키려고 그룹 원점을 허리 높이에 둔다 */}
      {([
        [legL, -0.093],
        [legR, 0.093],
      ] as const).map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, HIP, 0]}>
          <mesh geometry={G.leg} material={mats.sock} position={[0, -0.37, 0]} />
          <mesh geometry={G.boot} material={mats.boot} position={[0, -0.735, 0.045]} />
        </group>
      ))}

      {/* 상체 — 기울기 축도 허리 */}
      <group ref={upper} position={[0, HIP, 0]}>
        <mesh geometry={G.shorts} material={mats.shorts} position={[0, -0.06, 0]} />
        <mesh geometry={G.torso} material={mats.jersey} position={[0, 0.3, 0]} />
        <mesh geometry={G.neck} material={mats.skin} position={[0, 0.7, 0]} />
        <mesh geometry={G.head} material={mats.skin} position={[0, 0.83, 0]} />
        <mesh geometry={G.hair} material={mats.hair} position={[0, 0.835, -0.004]} />

        {/* 팔 — 어깨에서 회전 */}
        {([
          [armL, -0.257],
          [armR, 0.257],
        ] as const).map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, 0.62, 0]}>
            <mesh geometry={G.arm} material={mats.skin} position={[0, -0.19, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}
