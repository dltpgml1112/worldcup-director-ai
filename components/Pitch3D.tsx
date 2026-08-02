"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import {
  PITCH,
  clamp,
  convexHull,
  drift,
  pitchFrame,
  toWorld,
  type PitchFrame,
  type PitchPoint,
  type PlacedPlayer,
} from "@/lib/pitchPositions";
import {
  createSim,
  roleGroup,
  roleTarget,
  stepBall,
  type SimCtx,
  type SimPlayer,
  type SimState,
} from "@/lib/matchSim";
import { ballTexture, labelTexture, scorerBannerTexture, shadowTexture } from "@/lib/pitchTextures";
import { CornerFlags, CrowdFlashes, Goal, PitchLights, Stadium, Turf } from "./PitchScenery";
import PlayerFigure from "./PlayerFigure";
import {
  HEAT_NX,
  HEAT_NY,
  occupancy,
  paintHeatmap,
  passNetwork,
  type OccupancyResult,
} from "@/lib/pitchAnalytics";
import type { Lang } from "@/lib/i18n";
import type { Player, Side, Tactics } from "@/lib/types";
import { bookingsAt, matchPlayer } from "@/lib/cards";
import { CAM_PRESETS, type CamKey, type OverlayFlags } from "@/lib/pitchView";

/* ─────────────────────────── 헬퍼 ─────────────────────────── */

const V = new THREE.Vector3();

/** 절대 피치 좌표 → three 벡터 */
function vec(p: PitchPoint, y = 0) {
  const w = toWorld(p);
  return new THREE.Vector3(w.x, y, w.z);
}

/**
 * 세리머니 집결 지점 — 득점팀이 달려가 모이는 코너 부근.
 * 카메라와 선수 배치가 **같은 지점**을 써야 한다. 따로 계산하면
 * 카메라가 텅 빈 골대를 비추고 선수들은 화면 밖에서 뛰게 된다.
 */
function celebrationSpot(side: Side): PitchPoint {
  return { x: 74, y: side === "home" ? 82 : 18 };
}

/* ─────────────────────────── 선수 토큰 ─────────────────────────── */

interface TokenProps {
  placed: PlacedPlayer;
  color: string;
  lang: Lang;
  isHome: boolean;
  interactive: boolean;
  dragging: boolean;
  showInfluence: boolean;
  influenceColor: string;
  onGrab?: (id: string, x: number, y: number) => void;
  /** 벤치 드래그 진행 중 — 히트박스를 교체 조준용으로 쓴다 */
  benchDragActive?: boolean;
  /** 현재 교체 조준 대상인지 */
  aimed?: boolean;
  onAim?: (id: string | null) => void;
  /** 경고/퇴장 카드 보유 */
  booked?: "yellow" | "red" | null;
  /** 컨트롤러가 매 프레임 갱신하는 실제 공 기준 목표 위치 */
  liveTargets?: MutableRefObject<LiveTargets>;
  /** 현재 공을 잡고 있는 선수 id (매 프레임 갱신) */
  carrier?: MutableRefObject<string | null>;
  /** 패스를 받으러 가는 선수 id */
  receiver?: MutableRefObject<string | null>;
  /** 공 주변에서 태클·패스로 관여 가능한 선수들 */
  nearBall?: MutableRefObject<Set<string>>;
  /** 세리머니 중이면 제자리 점프 */
  partying?: boolean;
  /** 이 선수가 득점자 — 확대 + 조명 + 이름 배너 */
  scorerName?: string | null;
  /** 상세 카드 후보로 표시 (실제 열기는 짧은 탭일 때만) */
  onInspect?: (id: string, x: number, y: number) => void;
}

function PlayerToken({
  placed,
  color,
  lang,
  isHome,
  interactive,
  dragging,
  showInfluence,
  influenceColor,
  onGrab,
  benchDragActive,
  aimed,
  onAim,
  booked,
  liveTargets,
  carrier,
  receiver,
  nearBall,
  partying,
  scorerName,
  onInspect,
}: TokenProps) {
  const isScorer = !!scorerName;
  const carrierRing = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  /** 이동 속도(m/s) — 달리기 애니메이션 강도를 결정한다 */
  const speed = useRef(0);
  const prevPos = useRef(new THREE.Vector3());
  const group = useRef<THREE.Group>(null);
  const { player, pos, gk } = placed;
  const target = useMemo(() => vec(pos), [pos.x, pos.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = lang === "ko" && player.nameKo ? player.nameKo : player.name.split(" ").pop() ?? player.name;
  const label = useMemo(
    () => labelTexture({ num: player.num, name, color, legend: player.legend, dim: !isHome }),
    [player.num, name, color, player.legend, isHome]
  );

  const spawned = useRef(false);
  const live = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // position을 prop으로 주면 매 렌더마다 스냅되므로 여기서만 위치를 관리한다
    if (!spawned.current) {
      g.position.copy(target);
      spawned.current = true;
      return;
    }

    // 컨트롤러가 실제 공 기준으로 계산한 목표가 있으면 그쪽을 쫓는다
    const t = liveTargets?.current.get(player.id);
    if (t && !dragging) live.current.set(t.x, 0, t.z);
    else live.current.copy(target);

    // 드래그 중엔 즉시 추종, 그 외엔 부드럽게 보간
    const k = dragging ? 1 : 1 - Math.pow(0.0015, Math.min(dt, 0.1));
    g.position.lerp(live.current, k);

    // 실제 이동 속도 측정 → 달리기 애니메이션. 진행 방향으로 몸을 돌린다.
    const step = Math.max(1e-4, Math.min(dt, 0.1));
    const moved = g.position.distanceTo(prevPos.current);
    speed.current = THREE.MathUtils.lerp(speed.current, moved / step, 0.2);
    if (moved > 0.008) {
      const yaw = Math.atan2(g.position.x - prevPos.current.x, g.position.z - prevPos.current.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, 0.15);
    }
    prevPos.current.copy(g.position);

    /*
     * 공 관여 표시 — 세 단계. 양 팀 모두 동일하게 적용된다.
     *   ① 소유 중      진한 링 + 맥박
     *   ② 패스 받는 중  중간 밝기
     *   ③ 관여 가능    연한 링 (공 주변 14m — 태클 또는 패스 대상)
     * ③이 있어야 "누가 압박하러 붙었고 누가 패스 받을 위치인지"가 전술적으로 읽힌다.
     */
    const r = carrierRing.current;
    if (r) {
      const has = !partying && carrier?.current === player.id;
      const incoming = !partying && !has && receiver?.current === player.id;
      const involved = !partying && !has && !incoming && !!nearBall?.current.has(player.id);
      r.visible = has || incoming || involved;
      const m2 = r.material as THREE.MeshBasicMaterial;
      if (has) {
        r.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.09);
        m2.opacity = 0.92;
      } else if (incoming) {
        r.scale.setScalar(0.78);
        m2.opacity = 0.42;
      } else if (involved) {
        r.scale.setScalar(0.62);
        m2.opacity = 0.18;
      }
    }

    // 세리머니 — 득점자는 더 크게 뛰며 회전(퍼포먼스), 동료는 제자리 점프
    const b = body.current;
    if (b) {
      if (partying && !gk) {
        const t = performance.now() * 0.006 + player.num * 0.9;
        if (isScorer) {
          b.position.y = Math.abs(Math.sin(t * 1.15)) * 1.7;
          b.rotation.y += dt * 3.2; // 팔 벌리고 도는 세리머니
        } else {
          b.position.y = Math.abs(Math.sin(t)) * 1.1;
          b.rotation.y = Math.sin(t * 0.5) * 0.6;
        }
      } else if (b.position.y !== 0) {
        b.position.y *= 0.85;
        b.rotation.y *= 0.85;
      }
    }

    // 득점자는 잠깐 커진다 (피파식 클로즈업 대용 — 카메라를 더 밀지 않고 대상만 키운다)
    const want = isScorer ? 1.28 : 1;
    if (Math.abs(g.scale.x - want) > 0.005) {
      const s = THREE.MathUtils.lerp(g.scale.x, want, 1 - Math.pow(0.02, Math.min(dt, 0.1)));
      g.scale.setScalar(s);
    }
  });

  const jersey = gk ? "#c98500" : color;

  return (
    <group ref={group}>
      {/* 득점자 연출 — 조명 기둥 + 바닥 링 + 이름 배너 */}
      {isScorer && (
        <>
          {/* 위에서 내리쬐는 빛 (실제 SpotLight 대신 가산 혼합 원뿔 — 비용이 거의 없다) */}
          <mesh position={[0, 7, 0]}>
            <coneGeometry args={[3.2, 14, 20, 1, true]} />
            <meshBasicMaterial
              color="#fff2c4"
              transparent
              opacity={0.16}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
            <circleGeometry args={[3.0, 40]} />
            <meshBasicMaterial
              color="#ffd88a"
              transparent
              opacity={0.22}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* 이름 배너 */}
          <sprite position={[0, 5.6, 0]} scale={[9.2, 2.9, 1]}>
            <spriteMaterial
              map={scorerBannerTexture(scorerName!, "GOAL", color)}
              transparent
              depthWrite={false}
              depthTest={false}
            />
          </sprite>
        </>
      )}

      {/* 공 소유 표시 — 팀 색 링. 이게 없으면 '누가 패스를 주고받는지' 알 수 없다 */}
      <mesh ref={carrierRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} visible={false}>
        <ringGeometry args={[1.35, 1.95, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* 발밑 그림자 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} />
      </mesh>

      {/* 영향권 */}
      {showInfluence && !gk && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[4.0, 4.35, 40]} />
          <meshBasicMaterial color={influenceColor} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}

      {/* 선택/드래그 링 — 교체 조준 중이면 OUT 색(적색)으로 크게 */}
      {isHome && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[aimed ? 1.1 : 0.8, aimed ? 1.75 : dragging ? 1.25 : 1.0, 36]} />
          <meshBasicMaterial
            color={aimed ? "#d03b3b" : dragging ? "#ffffff" : player.legend ? "#c98500" : color}
            transparent
            opacity={aimed ? 0.95 : dragging ? 0.95 : 0.55}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 교체 조준 시 기둥 표시 — 어느 시점에서도 대상이 명확히 보이게 */}
      {aimed && (
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 6, 8]} />
          <meshBasicMaterial color="#d03b3b" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {/* 선수 형상 — 세리머니 때 이 그룹만 튀어오른다 (그림자·링은 땅에 남는다) */}
      <group ref={body}>
        <PlayerFigure
          jersey={jersey}
          speedRef={speed}
          celebrating={partying && !gk}
          phase={player.num * 0.7}
        />
      </group>

      {/* 경고 카드 — 번호 뱃지 옆에 세워 어느 각도에서도 보이게 */}
      {booked && (
        <sprite position={[2.0, 4.3, 0]} scale={[0.85, 1.2, 1]}>
          <spriteMaterial
            color={booked === "red" ? "#d03b3b" : "#fab219"}
            transparent
            depthWrite={false}
            depthTest={false}
          />
        </sprite>
      )}

      {/* 번호 · 이름 빌보드 — 이름 라벨 하단이 머리(2.2m) 바로 위에 오도록 배치 */}
      <sprite position={[0, 3.6, 0]} scale={[5.6, 3.15, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} depthTest={false} />
      </sprite>

      {/*
        상대 선수 히트박스 — 정보 확인용.
        stopPropagation을 하면 카메라 회전이 막히고, 즉시 카드를 열면 화면을 돌리려던
        드래그에도 카드가 떠버린다. 그래서 좌표만 기록하고 실제 판정(짧은 탭인지)은
        래퍼의 pointerup에서 한다.
      */}
      {!isHome && onInspect && (
        <mesh
          position={[0, 1.2, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => onInspect(player.id, e.clientX, e.clientY)}
        >
          <cylinderGeometry args={[1.0, 1.0, 3.0, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* 그랩 히트박스 — 선수 드래그 중엔 언마운트해서 잔디 레이캐스트를 막지 않는다.
          벤치 드래그 중에는 교체 드롭 타깃으로 동작한다. */}
      {interactive && onGrab && (
        <mesh
          position={[0, 1.2, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (benchDragActive) return; // 벤치 드래그 중엔 선수 이동을 시작하지 않는다
            e.stopPropagation();
            onGrab(player.id, e.clientX, e.clientY);
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            if (!benchDragActive || !onAim) return;
            e.stopPropagation();
            onAim(player.id);
          }}
          onPointerOut={() => {
            if (!benchDragActive || !onAim) return;
            if (aimed) onAim(null);
          }}
        >
          <cylinderGeometry args={[benchDragActive ? 1.9 : 1.0, benchDragActive ? 1.9 : 1.0, 3.4, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ─────────────────────────── 공 ─────────────────────────── */

/**
 * 공 반지름(m). 실제 규격은 0.11m지만 105m 경기장을 담는 카메라 거리에서는
 * 몇 픽셀도 안 되어 보이지 않는다. 전술 보드로서 '공이 어디 있는지'가 가장 중요한 정보라
 * 의도적으로 과장한다.
 */
const BALL_R = 0.5;

/** 결정론 난수 — 같은 (분, 홉 번호)면 항상 같은 값이라 시연이 재현된다 */
function hashRand(a: number, b: number) {
  let h = (a * 73856093) ^ (b * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** 꼬리 길이 (프레임 수) */
const TRAIL_N = 46;

/**
 * 공 궤적 꼬리.
 *
 * 22명이 동시에 움직이는 화면에서 작은 공 하나를 눈으로 쫓는 건 어렵다 —
 * "공이 중구난방"으로 느껴지는 이유가 그것이다. 최근 경로를 꼬리로 남기면
 * 공이 어디서 와서 어디로 가는지가 한눈에 읽힌다.
 *
 * 슛일 때는 금색으로 굵게 바뀌어 "골이 어떻게 들어갔는지"가 경로로 보인다.
 * 인스턴스 메시 하나라 드로우콜은 1이다.
 */
function BallTrail({
  sim,
  homeColor,
  awayColor,
  live,
}: {
  sim: MutableRefObject<SimState>;
  homeColor: string;
  awayColor: string;
  live: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const buf = useRef(
    Array.from({ length: TRAIL_N }, () => ({ x: 0, y: 0, z: 0, on: false }))
  );
  const head = useRef(0);
  const filled = useRef(0);
  const lastKey = useRef<string>("");
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const teamCol = useMemo(
    () => ({ home: new THREE.Color(homeColor), away: new THREE.Color(awayColor) }),
    [homeColor, awayColor]
  );
  const shotCol = useMemo(() => new THREE.Color("#ffd24a"), []);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const s = sim.current;
    const shooting = s.mode === "pass" && s.targetId === null;

    // 원형 버퍼 — unshift/pop은 매 프레임 배열을 옮겨서 낭비다
    if (live) {
      head.current = (head.current - 1 + TRAIL_N) % TRAIL_N;
      const slot = buf.current[head.current];
      slot.x = ((s.pos.x - 50) / 100) * PITCH.width;
      slot.y = BALL_R + s.height;
      slot.z = ((50 - s.pos.y) / 100) * PITCH.length;
      slot.on = true;
      filled.current = Math.min(TRAIL_N, filled.current + 1);
    }

    for (let i = 0; i < TRAIL_N; i++) {
      const p = buf.current[(head.current + i) % TRAIL_N];
      const age = i / TRAIL_N;
      if (!p.on) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -50, 0);
      } else {
        // 뒤로 갈수록 작아지고 어두워진다
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar((shooting ? 0.42 : 0.3) * (1 - age) ** 1.4);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;

    // 색은 점유 팀이나 슛 여부가 바뀔 때만 다시 올린다 (매 프레임 버퍼 업로드 회피)
    const key = shooting ? "shot" : s.side;
    if (key !== lastKey.current) {
      lastKey.current = key;
      const base = shooting ? shotCol : teamCol[s.side];
      for (let i = 0; i < TRAIL_N; i++) {
        col.copy(base).multiplyScalar((1 - i / TRAIL_N) ** 1.6);
        m.setColorAt(i, col);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, TRAIL_N]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/**
 * 공 — 시뮬레이션이 정한 위치를 따라 그리기만 한다.
 *
 * 예전에는 공이 스스로 다음 목적지를 골랐다(홉 방식). 그러다 보니 선수와 무관하게
 * 움직여 발에서 떨어져 보였다. 이제 소유·패스·태클 판정은 전부 matchSim이 하고,
 * 여기서는 그 결과를 렌더링하고 회전만 얹는다.
 */
function Ball({
  sim,
  ballWorld,
  celebrating,
  scoringSide,
  live,
}: {
  sim: MutableRefObject<SimState>;
  ballWorld: MutableRefObject<THREE.Vector3>;
  /** 세리머니 중엔 공이 골망 안에 머문다 */
  celebrating?: boolean;
  /** 득점한 팀 — 어느 골문에 공을 넣을지 결정 */
  scoringSide?: Side | null;
  live: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const spin = useRef(new THREE.Vector3());
  const spawned = useRef(false);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const step = Math.min(dt, 0.05);

    if (celebrating) {
      // 득점한 팀이 공격하는 쪽 골문에 공을 둔다
      const goalZ = (scoringSide === "home" ? -1 : 1) * (PITCH.length / 2 + 1.2);
      m.position.lerp(V.set(0, BALL_R, goalZ), 1 - Math.pow(0.02, step));
      ballWorld.current.copy(m.position);
      if (shadow.current) shadow.current.position.set(m.position.x, 0.035, m.position.z);
      return;
    }

    const s = sim.current;
    const w = toWorld(s.pos);
    const want = V.set(w.x, BALL_R + s.height, w.z);

    if (!spawned.current) {
      m.position.copy(want);
      spawned.current = true;
    }

    const prevX = m.position.x;
    const prevZ = m.position.z;
    // 정지 중엔 그 자리에 멈춘다 (시뮬레이션도 진행되지 않는다)
    m.position.lerp(want, live ? 1 - Math.pow(0.0005, step) : 0);

    // 슛일 때 공이 밝게 빛난다 — 골 장면에서 공을 놓치지 않게
    const shooting = s.mode === "pass" && s.targetId === null;
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.lerp(
      mat.emissiveIntensity,
      shooting ? 1.6 : 0.25,
      0.15
    );
    if (shooting) mat.emissive.set("#ffd24a");
    else mat.emissive.set("#20262e");

    // 회전은 실제 이동량 기반 — 구르는 방향으로 굴러간다
    const dx = m.position.x - prevX;
    const dz = m.position.z - prevZ;
    const travelled = Math.hypot(dx, dz);
    if (travelled > 1e-5) {
      spin.current.set(dz, 0, -dx).normalize();
      m.rotateOnWorldAxis(spin.current, travelled / BALL_R);
    }

    ballWorld.current.copy(m.position);

    if (shadow.current) {
      shadow.current.position.set(m.position.x, 0.035, m.position.z);
      const lift = m.position.y - BALL_R;
      shadow.current.scale.setScalar(1 + lift * 0.22);
      const mat = shadow.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0.15, 0.85 - lift * 0.075);
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[BALL_R, 24, 18]} />
        <meshStandardMaterial map={ballTexture()} roughness={0.45} emissive="#20262e" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} opacity={0.85} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── 전술 오버레이 ─────────────────────────── */

function LineMarker({ y, color }: { y: number; color: string }) {
  const z = toWorld({ x: 50, y }).z;
  return (
    <group position={[0, 0.08, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PITCH.width, 0.55]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      {/* 수직 벽 — 라인 높이를 입체로 강조 */}
      <mesh position={[0, 1.1, 0]}>
        <planeGeometry args={[PITCH.width, 2.2]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PressZone({ ball, press }: { ball: PitchPoint; press: number }) {
  const ref = useRef<THREE.Group>(null);
  const radius = 5 + (press / 100) * 13;
  const target = useMemo(() => vec(ball, 0.07), [ball.x, ball.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const spawned = useRef(false);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    V.set(target.x, 0.07, target.z);
    if (!spawned.current) {
      g.position.copy(V);
      spawned.current = true;
    }
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.1));
    g.position.lerp(V, k);
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.03;
    g.scale.setScalar(pulse);
  });

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#3987e5" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius - 0.35, radius, 48]} />
        <meshBasicMaterial color="#3987e5" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BlockShape({ placed, color }: { placed: PlacedPlayer[]; color: string }) {
  /*
   * placed는 매 렌더 새 배열이라 그대로 의존하면 볼록껍질·Shape·Line 지오메트리를
   * 초당 여러 번 새로 만든다 (재생 중 버벅임의 원인 중 하나).
   * 좌표를 1단위로 반올림한 문자열을 키로 삼아, 대형이 실제로 바뀔 때만 재생성한다.
   */
  const key = placed
    .filter((p) => !p.gk)
    .map((p) => `${Math.round(p.pos.x)},${Math.round(p.pos.y)}`)
    .join("|");

  const hull = useMemo(
    () => convexHull(placed.filter((p) => !p.gk).map((p) => ({ ...p.pos }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  const shape = useMemo(() => {
    if (hull.length < 3) return null;
    const s = new THREE.Shape();
    hull.forEach((p, i) => {
      const w = toWorld(p);
      // 로컬 XY 평면을 -90° 회전시켜 바닥에 눕히므로 y = -z
      if (i === 0) s.moveTo(w.x, -w.z);
      else s.lineTo(w.x, -w.z);
    });
    s.closePath();
    return s;
  }, [hull]);

  const outline = useMemo<[number, number, number][]>(
    () => (hull.length >= 3 ? [...hull, hull[0]].map((p) => { const w = toWorld(p); return [w.x, 0.12, w.z] as [number, number, number]; }) : []),
    [hull]
  );

  if (!shape) return null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {outline.length > 1 && (
        <Line points={outline} color={color} lineWidth={2} transparent opacity={0.85} />
      )}
    </group>
  );
}

/* ─────────────────────────── 볼 반응 컨트롤러 ─────────────────────────── */

/** 선수 id → 현재 목표 월드 좌표. 토큰이 매 프레임 읽어간다 */
export type LiveTargets = Map<string, { x: number; z: number }>;

/** 공에서 이 거리(m) 안이면 태클·패스로 즉시 관여할 수 있는 선수로 본다 */
const INVOLVED_M = 14;

/** 선수끼리 최소한 이만큼(m)은 떨어져 있어야 대형이 읽힌다 */
const MIN_GAP_M = 2.8;

/**
 * 겹침 제거.
 *
 * 볼 반응이 최근접 선수들을 공으로 끌어당기다 보니 양 팀 대여섯 명이 한 자리에
 * 포개지는 일이 생긴다. 그러면 누가 어디 있는지 전혀 읽히지 않는다.
 * 서로 밀어내는 완화(relaxation)를 두 번 돌려 최소 간격을 확보한다.
 * 양 팀을 함께 처리해야 한다 — 겹침은 팀을 가리지 않는다.
 */
function separate(map: LiveTargets, dragId: string | null) {
  const ids: string[] = [];
  map.forEach((_, id) => {
    if (id !== dragId) ids.push(id);
  });

  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < ids.length; i++) {
      const a = map.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j++) {
        const b = map.get(ids[j])!;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= MIN_GAP_M) continue;
        if (d < 1e-4) {
          // 완전히 같은 점 — 결정론적으로 어긋나게 민다 (난수 쓰면 매 프레임 떨린다)
          dx = ((i % 3) - 1) * 0.5 + 0.1;
          dz = ((j % 3) - 1) * 0.5 + 0.1;
        }
        const len = Math.hypot(dx, dz) || 1;
        const push = ((MIN_GAP_M - d) / 2) * 0.9;
        const ux = (dx / len) * push;
        const uz = (dz / len) * push;
        a.x -= ux;
        a.z -= uz;
        b.x += ux;
        b.z += uz;
      }
    }
  }
}

/**
 * 매 프레임 **실제 화면의 공** 위치로 양 팀 배치를 다시 계산한다.
 *
 * 이전에는 분 단위 앵커(ballTarget)에 반응했는데, 3D에서 눈에 보이는 공은
 * 선수 사이를 홉으로 오가는 별개 좌표라 선수들이 보이지 않는 점으로 수렴했다.
 * 그래서 "공을 따라간다"로 보이지 않았다. 여기서 그 둘을 하나로 묶는다.
 *
 * 토큰마다 계산하면 O(n²)이 되므로 컨트롤러 하나가 22명분을 한 번에 처리한다.
 */
/**
 * 경기 시뮬레이션 컨트롤러.
 *
 * 매 프레임 두 단계를 순서대로 돌린다:
 *   1) 역할별 목표 위치 계산 (직전 프레임의 공 위치 기준)
 *   2) 그 위치들로 공을 한 스텝 진행 — 공이 소유자 발에 붙고, 태클로 뺏긴다
 * 순서가 중요하다. 공을 먼저 옮기면 선수가 한 프레임 뒤처져 발에서 떨어져 보인다.
 */
function MatchSimController({
  frame,
  sim,
  ctxRef,
  ballWorld,
  targets,
  nearBall,
  carrier,
  receiver,
  enabled,
  dragId,
  celebrate,
  scorerId,
}: {
  frame: PitchFrame;
  sim: MutableRefObject<SimState>;
  ctxRef: MutableRefObject<SimCtx>;
  ballWorld: MutableRefObject<THREE.Vector3>;
  targets: MutableRefObject<LiveTargets>;
  /** 공 주변에서 태클/패스로 관여 가능한 선수들 (양 팀) */
  nearBall: MutableRefObject<Set<string>>;
  carrier: MutableRefObject<string | null>;
  receiver: MutableRefObject<string | null>;
  enabled: boolean;
  dragId: string | null;
  /** 골 세리머니 중인 팀. 경기 시계는 멈춰도 이 동안 3D는 계속 움직인다 */
  celebrate: Side | null;
  /** 득점자 — 세리머니 중앙에 세운다 */
  scorerId: string | null;
}) {
  /** 재생 중에만 흐르는 시간 — 정지하면 흔들림도 멈춘다 */
  const driftT = useRef(0);
  /*
   * 매 프레임 Map과 좌표 객체를 새로 만들면 초당 수천 개가 쌓여 GC가 주기적으로 튄다
   * (화면이 버벅이는 원인). 아래 두 풀을 재사용하고 값만 덮어쓴다.
   */
  const live = useRef(new Map<string, PitchPoint>());
  useFrame((state, dt) => {
    const map = targets.current;
    nearBall.current.clear();
    // map은 clear하지 않고 값만 덮어쓴다 (세리머니 분기에서만 새로 채운다)

    /*
     * 일시정지 중에는 화면도 완전히 멈춰야 한다.
     * 예전에는 여기서 map.clear() 후 early return을 해서, 선수들이 기준 위치로
     * 되돌아가 버렸다 (정지했는데 배치가 움직이는 것처럼 보임).
     * 드리프트 시간도 멈춰 미세한 흔들림까지 정지시킨다.
     */
    /*
     * 정지 중에도 드리프트는 (느리게) 계속 흐른다.
     *
     * 예전에는 완전히 멈춰서 22명이 통째로 정지화면처럼 굳었다 — 일시정지가 아니라
     * 화면이 죽은 것처럼 보인다. 드리프트는 기준 위치 주변의 미세한 흔들림이라
     * 배치를 바꾸지 않으면서 장면에 숨을 남긴다.
     */
    driftT.current += dt * (enabled ? 0.55 : 0.16);
    map.clear();

    /*
     * 세리머니 — 경기 시계가 멈춰도 화면은 살아있어야 한다.
     * 득점팀은 코너 쪽으로 달려가 뭉치고, 실점팀은 제자리에 선다.
     */
    if (celebrate) {
      const scoring = celebrate === "home" ? frame.homeBase : frame.awayBase;
      const other = celebrate === "home" ? frame.awayBase : frame.homeBase;
      // 카메라가 잡는 지점과 동일해야 한다
      const spot = celebrationSpot(celebrate);
      const cx = spot.x;
      const cy = spot.y;
      // 득점자는 정중앙, 동료들은 그 둘레로 — 카메라가 잡는 지점과 일치한다
      // 좌표 객체는 재사용한다 (세리머니 4.6초 동안 매 프레임 22개씩 만들면 GC가 튄다)
      const put = (id: string, x: number, y: number) => {
        let w = map.get(id);
        if (!w) {
          w = { x: 0, z: 0 };
          map.set(id, w);
        }
        w.x = ((x - 50) / 100) * PITCH.width;
        w.z = ((50 - y) / 100) * PITCH.length;
      };
      const others = scoring.filter((p) => !p.gk && p.player.id !== scorerId);
      scoring.forEach((p) => {
        if (p.gk) return put(p.player.id, p.pos.x, p.pos.y);
        if (p.player.id === scorerId) return put(p.player.id, cx, cy);
        const i = others.indexOf(p);
        const ang = (i / Math.max(1, others.length)) * Math.PI * 2;
        put(
          p.player.id,
          clamp(cx + Math.cos(ang) * 8, 6, 94),
          clamp(cy + Math.sin(ang) * 8, 6, 94)
        );
      });
      other.forEach((p) => put(p.player.id, p.pos.x, p.pos.y));
      return;
    }

    const s = sim.current;
    const ctx = ctxRef.current;
    // 연속 시간 드리프트 — 분 단위로 계산하면 배속에서 선수가 순간이동한다.
    // 정지 중에는 driftT가 멈춰 있어 배치가 그대로 굳는다.
    const t = driftT.current;

    /* ── 1단계: 역할별 목표 위치 (직전 프레임의 공 기준) ── */
    const lp = live.current;
    // 스쿼드에서 빠진 선수(교체)는 풀에서도 제거한다
    if (lp.size > ctx.players.length) {
      const ids = new Set(ctx.players.map((p) => p.id));
      lp.forEach((_, id) => {
        if (!ids.has(id)) lp.delete(id);
      });
    }
    ctx.players.forEach((p, i) => {
      const hasBall = s.side === p.side;
      const target = roleTarget(p, s.pos, ctx, hasBall, s.chase.includes(p.id));
      const d = drift(i, t, p.group === "GK");
      // 좌표 객체를 재사용한다 (매 프레임 새로 만들면 GC가 튄다)
      let o = lp.get(p.id);
      if (!o) {
        o = { x: 0, y: 0 };
        lp.set(p.id, o);
      }
      o.x = clamp(target.x + d.dx * 0.5, 3, 97);
      o.y = clamp(target.y - d.dy * 0.5, 3, 97);
    });

    // 소유자는 공을 몰고 전진한다 — 제자리에 서 있으면 드리블처럼 안 보인다
    if (s.mode === "carry" && s.carrierId) {
      const cp = lp.get(s.carrierId);
      const owner = ctx.players.find((p) => p.id === s.carrierId);
      if (cp && owner) {
        cp.y = clamp(cp.y + (owner.side === "home" ? 1.6 : -1.6), 3, 97);
      }
    }

    /* ── 2단계: 그 위치로 공을 한 스텝 진행 ── */
    if (enabled) stepBall(s, dt, lp, ctx);

    /* ── 3단계: 월드 좌표로 변환 + 겹침 제거 ── */
    // map의 값 객체도 재사용한다 (toWorld가 매번 새 객체를 만들지 않도록)
    lp.forEach((pos, id) => {
      if (id === dragId) return; // 드래그 중인 선수는 커서를 그대로 따른다
      let w = map.get(id);
      if (!w) {
        w = { x: 0, z: 0 };
        map.set(id, w);
      }
      w.x = ((pos.x - 50) / 100) * PITCH.width;
      w.z = ((50 - pos.y) / 100) * PITCH.length;
    });
    if (dragId) map.delete(dragId);
    // 교체돼 사라진 선수의 좌표가 남으면 유령이 실제 선수를 밀어낸다 — 정리한다
    map.forEach((_, id) => {
      if (!lp.has(id)) map.delete(id);
    });
    separate(map, dragId);

    // 간격을 정리한 뒤에 공 근접 판정 — 밀려난 최종 위치가 기준이어야 한다
    const bx = ((s.pos.x - 50) / 100) * PITCH.width;
    const bz = ((50 - s.pos.y) / 100) * PITCH.length;
    ballWorld.current.set(bx, s.height + 0.5, bz);
    map.forEach((w, id) => {
      const d = Math.hypot(w.x - bx, w.z - bz);
      if (d < INVOLVED_M) nearBall.current.add(id);
    });

    // 소유·수신 표시는 시뮬레이션 상태 그대로 (거리로 추정하지 않는다)
    carrier.current = s.mode === "carry" ? s.carrierId : null;
    receiver.current = s.mode === "pass" ? s.targetId : null;
  });

  return null;
}

/* ─────────────────────────── 점유 히트맵 ─────────────────────────── */

/**
 * 격자를 캔버스에 칠해 잔디 바로 위 평면에 얹는다.
 * 캔버스/텍스처를 한 번만 만들고 다시 칠하기만 해서 GPU 텍스처가 매번 새로 생기지 않게 한다.
 */
function HeatmapLayer({ grid }: { grid: Float32Array }) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = HEAT_NX * 10;
    c.height = HEAT_NY * 10;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  // 씬에서 빠질 때 GPU 리소스 반환
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    paintHeatmap(canvas, grid);
    texture.needsUpdate = true;
  }, [canvas, texture, grid]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <planeGeometry args={[PITCH.width, PITCH.length]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

/* ─────────────────────────── 패스 네트워크 ─────────────────────────── */

function PassNetworkLayer({
  analytics,
  players,
  tactics,
  color,
}: {
  analytics: OccupancyResult;
  players: Player[];
  tactics: Tactics;
  color: string;
}) {
  const net = useMemo(
    () => passNetwork({ players, avg: analytics.avg, tactics }),
    [players, analytics, tactics]
  );

  return (
    <group>
      {net.links.map((l) => {
        const a = toWorld(l.a);
        const b = toWorld(l.b);
        return (
          <Line
            key={`${l.from}-${l.to}`}
            points={[
              [a.x, 0.4, a.z],
              [b.x, 0.4, b.z],
            ]}
            color={color}
            // 강도 → 선 굵기. 굵기만으로 순위를 읽을 수 있게 범위를 넓게 잡는다
            lineWidth={0.8 + l.weight * 5.5}
            transparent
            opacity={0.3 + l.weight * 0.6}
          />
        );
      })}

      {net.nodes.map((n) => {
        const w = toWorld(n.pos);
        const r = 0.7 + n.involvement * 1.7;
        return (
          <group key={n.id} position={[w.x, 0.42, w.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r, 28]} />
              <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[r, r + 0.22, 28]} />
              <meshBasicMaterial color="#e8ecf1" transparent opacity={0.85} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─────────────────────────── 카메라 ─────────────────────────── */

/** 이벤트 연출용 카메라 샷. key가 바뀌면 새 샷으로 재무장한다 */
export interface CineShot {
  key: string;
  pos: [number, number, number];
  target: [number, number, number];
  /** 클수록 빠르게 붙는다 */
  speed?: number;
}

function CameraRig({
  camKey,
  controls,
  shot,
}: {
  camKey: CamKey;
  controls: MutableRefObject<any>;
  shot: CineShot | null;
}) {
  const { camera } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; speed: number } | null>(null);
  const last = useRef<CamKey | null>(null);
  const lastShot = useRef<string | null>(null);
  /** 연출 직전의 시점 — 끝나면 프리셋이 아니라 여기로 돌아간다 */
  const beforeShot = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const presetGoal = () => {
    const p = CAM_PRESETS[camKey];
    return {
      pos: new THREE.Vector3(...p.pos),
      target: new THREE.Vector3(...p.target),
      speed: 1,
    };
  };

  /*
   * 연출 샷이 프리셋보다 우선한다.
   * 샷이 끝나면 프리셋으로 되돌리지 않고 **연출 직전에 보고 있던 시점**으로 복귀한다.
   * 사용자가 직접 확대·회전해 둔 화면을 세리머니 한 번에 잃어버리면 안 된다.
   */
  const shotKey = shot?.key ?? null;
  if (lastShot.current !== shotKey) {
    lastShot.current = shotKey;
    if (shot) {
      if (!beforeShot.current) {
        beforeShot.current = {
          pos: camera.position.clone(),
          target: controls.current?.target?.clone() ?? new THREE.Vector3(),
        };
      }
      goal.current = {
        pos: new THREE.Vector3(...shot.pos),
        target: new THREE.Vector3(...shot.target),
        speed: shot.speed ?? 1.6,
      };
    } else {
      const back = beforeShot.current;
      beforeShot.current = null;
      goal.current = back
        ? { pos: back.pos, target: back.target, speed: 1.3 }
        : presetGoal();
    }
  }

  if (last.current !== camKey) {
    last.current = camKey;
    // 연출 중에 시점을 바꾸면, 복귀 지점도 새 프리셋으로 갱신한다
    if (shot) {
      const p = presetGoal();
      beforeShot.current = { pos: p.pos, target: p.target };
    } else {
      goal.current = presetGoal();
    }
  }

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    const k = 1 - Math.pow(0.004 / g.speed, Math.min(dt, 0.1));
    camera.position.lerp(g.pos, k);
    const c = controls.current;
    if (c) {
      c.target.lerp(g.target, k);
      c.update();
    }
    // 연출 샷은 도착해도 유지한다 (샷이 끝날 때 부모가 null로 바꾼다)
    if (!shot && camera.position.distanceTo(g.pos) < 0.2) goal.current = null;
  });

  return null;
}

/* ─────────────────────────── 씬 ─────────────────────────── */

interface SceneProps {
  camKey: CamKey;
  overlays: OverlayFlags;
  cinematic: boolean;
  drag: string | null;
  setDrag: (id: string | null) => void;
  /** 선수를 잡을 때 — 클릭/드래그 판별을 위해 포인터 좌표를 함께 넘긴다 */
  onGrab: (id: string, x: number, y: number) => void;
  /** 상대 선수를 누를 때 — 이동은 없고 탭 후보로만 기록한다 */
  onMarkTap: (id: string, x: number, y: number) => void;
  /** 히트맵 대상 선수. null이면 팀 전체 */
  heatPlayer: string | null;
}

function Scene({ camKey, overlays, cinematic, drag, setDrag, onGrab, onMarkTap, heatPlayer }: SceneProps) {
  const controls = useRef<any>(null);
  const players = useGame((s) => s.players);
  const setPlayerPos = useGame((s) => s.setPlayerPos);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const lang = useGame((s) => s.lang);
  const benchDrag = useGame((s) => s.benchDrag);
  const subTarget = useGame((s) => s.subTarget);
  const setSubTarget = useGame((s) => s.setSubTarget);
  const setSelectedPlayer = useGame((s) => s.setSelectedPlayer);
  const manualPositions = useGame((s) => s.manualPositions);

  const match = getMatch(matchId);
  // smoothDrift: 흔들림은 렌더러가 연속 시간으로 준다 (분 단위면 배속에서 튄다)
  const manualIds = useMemo(() => new Set(manualPositions), [manualPositions]);
  const frame = useMemo(
    () =>
      pitchFrame({
        match, players, tactics, minute, playing,
        dragId: drag, smoothDrift: true, manualIds,
      }),
    [match, players, tactics, minute, playing, drag, manualIds]
  );

  // 실제 화면의 공 위치 + 그 공을 기준으로 계산된 선수 목표 (매 프레임 갱신)
  const ballWorld = useRef(new THREE.Vector3());
  const liveTargets = useRef<LiveTargets>(new Map());
  const sim = useRef<SimState>(createSim());

  /*
   * 시뮬레이션 입력. 매 렌더마다 갱신하되 ref로 넘겨 useFrame이 항상 최신을 보게 한다.
   * scripted* 는 실제 타임라인이 지시하는 국면 — 골/슛이 예정된 분에는 그 팀 쪽으로
   * 공을 몰아줘서, 자유 시뮬레이션이 기록된 결과와 어긋나지 않게 한다.
   */
  const simCtx = useMemo<SimCtx>(() => {
    const toSim = (placed: typeof frame.homeBase, side: Side): SimPlayer[] =>
      placed.map((p) => ({
        id: p.player.id,
        base: p.pos,
        role: p.player.role,
        rating: p.player.rating,
        side,
        group: roleGroup(p.player.role),
      }));
    const last = match ? [...match.timeline].reverse().find((e) => e.minute <= minute) : undefined;
    const scriptedShot = !!match?.timeline.some(
      (e) => Math.abs(e.minute - minute) <= 1 && (e.type === "goal" || e.type === "shot")
    );
    // 이 분에 골이 예정돼 있으면 득점자를 실제 선수와 연결해 시뮬레이션에 넘긴다
    const goalEv = match?.timeline.find((e) => e.minute === minute && e.type === "goal");
    const scorerSquad = goalEv
      ? goalEv.side === "home"
        ? players
        : (match?.awayXI ?? [])
      : [];
    const scriptedScorer = goalEv?.player ? matchPlayer(scorerSquad, goalEv.player) : undefined;

    return {
      players: [...toSim(frame.homeBase, "home"), ...toSim(frame.awayBase, "away")],
      tactics,
      minute,
      scriptedSide: last && last.type !== "whistle" ? last.side : frame.possession,
      scriptedY: frame.ball.y,
      scriptedShot,
      scriptedScorerId: scriptedScorer?.id ?? null,
      scriptedGoalMinute: goalEv ? minute : null,
    };
  }, [frame, tactics, minute, match, players]);

  const ctxRef = useRef(simCtx);
  ctxRef.current = simCtx;
  const carrier = useRef<string | null>(null);
  const receiver = useRef<string | null>(null);
  const nearBall = useRef<Set<string>>(new Set());

  /* ── 이벤트 연출: 골 스윕 · 킥오프 플라이인 ── */
  const [shot, setShot] = useState<CineShot | null>(null);
  const [flashing, setFlashing] = useState(false);
  /**
   * 세리머니 상태를 하나의 객체로 묶는다.
   * 예전에는 celebrate/scorer를 따로 set 해서, 한쪽만 반영된 상태(팀은 세리머니 중인데
   * 득점자는 없음)가 생길 수 있었다 — 첫 골에서 이름·하이라이트가 안 뜨던 원인.
   */
  const [celeb, setCeleb] = useState<{
    side: Side;
    scorerId: string | null;
    scorerName: string | null;
  } | null>(null);
  const celebTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrate = celeb?.side ?? null;
  /** 슛이 날아가는 구간 — 이 동안은 경기가 멈춰도 시뮬레이션을 계속 돌린다 */
  const [shooting, setShooting] = useState(false);
  const shootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goalNow = match?.timeline.find((e) => e.minute === minute && e.type === "goal");
  const goalKey = goalNow ? `goal-${minute}` : null;

  /*
   * 골 처리 순서 — 슛을 먼저 보여주고 세리머니를 시작한다.
   *
   * 골 분이 되면 경기가 즉시 정지되면서 frame.live가 false가 되고, 그러면 시뮬레이션이
   * 멈춰 슛이 날아갈 시간이 없다. 공이 골대에서 먼 채로 골 배너만 뜨는 이유가 이것이다.
   * 그래서 SHOT_WINDOW 동안은 정지와 무관하게 시뮬레이션을 계속 돌려 슛을 보여준 뒤,
   * 세리머니로 넘어간다.
   */
  useEffect(() => {
    if (!goalNow) return;
    setShooting(true);
    if (shootTimer.current) clearTimeout(shootTimer.current);
    shootTimer.current = setTimeout(() => {
      setShooting(false);
      shootTimer.current = null;
      startCelebration();
    }, SHOT_WINDOW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalKey]);

  useEffect(() => () => {
    if (shootTimer.current) clearTimeout(shootTimer.current);
  }, []);

  function startCelebration() {
    if (!goalNow) return;
    /*
     * 세리머니 무리를 정면에서 잡는다.
     *
     * 주의 1: 골대만 겨냥하면 선수들은 코너에서 뛰고 화면엔 빈 골대만 남는다.
     *         반드시 celebrationSpot()과 같은 지점을 바라봐야 한다.
     * 주의 2: 카메라를 골라인 바깥(|z| > 60)에 두면 관중석 박스 내부로 들어가
     *         스탠드 뒷면만 보이는 검은 화면이 된다 (스탠드는 z 62~85 구간).
     */
    const spot = toWorld(celebrationSpot(goalNow.side));
    // 중앙선 쪽에서 코너를 바라보게 — 뒤로 골대가 배경에 걸린다.
    // 거리를 너무 좁히면 선수가 화면을 꽉 채워 무슨 상황인지 안 보인다 (약 34m 유지).
    const towardMid = spot.z > 0 ? -1 : 1;
    setShot({
      key: goalKey!,
      pos: [spot.x + 19, 11, spot.z + towardMid * 28],
      target: [spot.x, 1.8, spot.z],
      speed: 2.4,
    });
    setFlashing(true);

    // 득점자를 실제 선수와 연결한다 — 이게 없으면 상대 골에서 누가 넣었는지 보이지 않는다
    const squad = goalNow.side === "home" ? players : (match?.awayXI ?? []);
    const who = goalNow.player ? matchPlayer(squad, goalNow.player) : undefined;
    setCeleb({
      side: goalNow.side,
      scorerId: who?.id ?? null,
      scorerName: who ? (lang === "ko" && who.nameKo ? who.nameKo : who.name) : null,
    });

    /*
     * 종료 타이머는 cleanup으로 취소하지 않는다.
     * goalNow는 minute이 바뀌면 undefined가 되어 effect가 재실행되는데, 그때 cleanup이
     * 타이머를 죽이면 세리머니 상태가 영영 해제되지 않는다 (선수가 코너에 굳어버림).
     * '되다 안 되다' 하던 원인이 이것이다.
     */
    if (celebTimer.current) clearTimeout(celebTimer.current);
    celebTimer.current = setTimeout(() => {
      setShot(null);
      setFlashing(false);
      setCeleb(null);
      celebTimer.current = null;
    }, 4600);
  }

  // 언마운트 시에만 타이머 정리
  useEffect(() => () => {
    if (celebTimer.current) clearTimeout(celebTimer.current);
  }, []);

  /*
   * 킥오프 — 높은 곳에서 프리셋 위치로 내려온다.
   *
   * 주의: cleanup으로 타이머를 취소하면 안 된다. playing이 토글되는 순간(예: 알림으로
   * 일시정지) 타이머가 죽고 shot이 영영 해제되지 않아, 카메라 프리셋과 궤도 조작이
   * 통째로 잠긴다 (OrbitControls가 shot === null일 때만 활성화되기 때문).
   */
  useEffect(() => {
    if (minute !== 1 || !playing) return;
    setShot({ key: "kickoff", pos: [0, 150, 6], target: [0, 0, 0], speed: 0.55 });
    if (celebTimer.current) clearTimeout(celebTimer.current);
    celebTimer.current = setTimeout(() => {
      setShot(null);
      celebTimer.current = null;
    }, 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, playing]);

  /*
   * 안전장치 — 어떤 이유로든 연출 샷이 6초 넘게 남아 있으면 강제로 해제한다.
   * 연출이 박히면 사용자가 카메라를 아예 못 쓰게 되므로, 조작 불능만은 막는다.
   */
  useEffect(() => {
    if (!shot) return;
    const id = setTimeout(() => setShot(null), 6000);
    return () => clearTimeout(id);
  }, [shot]);

  const homeColor = match?.home.primary ?? "#3987e5";
  const awayColor = match?.away.primary ?? "#d95926";

  // 경고 보유 선수 — 양 팀 모두 토큰에 카드를 세운다
  const bookedById = useMemo(() => {
    const map = new Map<string, "yellow" | "red">();
    const squads = [players, match?.awayXI ?? []];
    for (const b of bookingsAt(match, minute)) {
      const squad = b.side === "home" ? squads[0] : squads[1];
      const p = matchPlayer(squad, b.player);
      // 퇴장이 경고를 덮어쓴다
      if (p && (b.card === "red" || !map.has(p.id))) map.set(p.id, b.card);
    }
    return map;
  }, [match, players, minute]);

  // 히트맵/패스 네트워크는 0~현재분을 매 분 재계산하므로 필요할 때만 돌린다.
  // 드래그 중에는 직전 결과를 재사용해 포인터 이동마다 90프레임을 다시 도는 걸 막는다.
  const needAnalytics = overlays.heat || overlays.passes;
  const analyticsRef = useRef<OccupancyResult | null>(null);
  const analytics = useMemo(() => {
    if (!needAnalytics) {
      analyticsRef.current = null;
      return null;
    }
    if (drag) return analyticsRef.current;
    const r = occupancy({ match, players, tactics, upTo: minute, playerId: heatPlayer });
    analyticsRef.current = r;
    return r;
  }, [needAnalytics, drag, match, players, tactics, minute, heatPlayer]);

  const onDragMove = useCallback(
    (p: PitchPoint) => {
      if (!drag) return;
      // 범위를 넓게 — 감독이 원하는 곳에 놓을 수 있어야 한다 (골라인·터치라인 근처 포함)
      setPlayerPos(drag, clamp(p.x, 2, 98), clamp(p.y, 2, 98));
    },
    [drag, setPlayerPos]
  );

  return (
    <>
      <color attach="background" args={["#070a0e"]} />
      <fog attach="fog" args={["#070a0e", 150, 340]} />

      <PitchLights />

      <Stadium />
      <CrowdFlashes active={flashing} />
      <Turf onDragMove={onDragMove} />
      <Goal sign={1} />
      <Goal sign={-1} />
      <CornerFlags />

      {/* 분석 레이어 — 잔디 바로 위 (선수·전술 오버레이보다 아래) */}
      {overlays.heat && analytics && <HeatmapLayer grid={analytics.grid} />}
      {overlays.passes && analytics && (
        <PassNetworkLayer analytics={analytics} players={players} tactics={tactics} color={homeColor} />
      )}

      {/* 전술 오버레이 */}
      {overlays.block && <BlockShape placed={frame.home} color={homeColor} />}
      {overlays.line && <LineMarker y={frame.homeLine} color={homeColor} />}
      {overlays.line && <LineMarker y={frame.awayLine} color={awayColor} />}
      {overlays.press && <PressZone ball={frame.ball} press={tactics.press} />}

      {/* 공 반응 계산 — 토큰보다 먼저 등록되어야 같은 프레임에 반영된다 */}
      <MatchSimController
        frame={frame}
        sim={sim}
        ctxRef={ctxRef}
        ballWorld={ballWorld}
        targets={liveTargets}
        nearBall={nearBall}
        carrier={carrier}
        receiver={receiver}
        enabled={frame.live || shooting}
        dragId={drag}
        celebrate={celebrate}
        scorerId={celeb?.scorerId ?? null}
      />

      {/* 상대 (드래그 불가) */}
      {frame.awayBase.map((p) => (
        <PlayerToken
          key={`away-${p.player.id}`}
          placed={p}
          color={awayColor}
          lang={lang}
          isHome={false}
          interactive={false}
          dragging={false}
          showInfluence={false}
          influenceColor={awayColor}
          booked={bookedById.get(p.player.id) ?? null}
          liveTargets={liveTargets}
          carrier={carrier}
          receiver={receiver}
          nearBall={nearBall}
          scorerName={celeb?.scorerId === p.player.id ? celeb.scorerName : null}
          partying={celebrate === "away"}
          onInspect={onMarkTap}
        />
      ))}

      {/* 우리 팀 (드래그 가능) */}
      {frame.homeBase.map((p) => (
        <PlayerToken
          key={`home-${p.player.id}`}
          placed={p}
          color={homeColor}
          lang={lang}
          isHome
          interactive={drag === null}
          dragging={drag === p.player.id}
          showInfluence={overlays.influence}
          influenceColor={homeColor}
          onGrab={onGrab}
          benchDragActive={benchDrag !== null}
          aimed={subTarget === p.player.id}
          onAim={setSubTarget}
          booked={bookedById.get(p.player.id) ?? null}
          liveTargets={liveTargets}
          carrier={carrier}
          receiver={receiver}
          nearBall={nearBall}
          scorerName={celeb?.scorerId === p.player.id ? celeb.scorerName : null}
          partying={celebrate === "home"}
        />
      ))}

      {/* 공 궤적 — 공이 어디서 와서 어디로 가는지 보이게 한다 */}
      {celebrate === null && (
        <BallTrail
          sim={sim}
          homeColor={homeColor}
          awayColor={awayColor}
          live={frame.live || shooting}
        />
      )}

      <Ball
        sim={sim}
        ballWorld={ballWorld}
        celebrating={celebrate !== null}
        scoringSide={celebrate}
        live={frame.live || shooting}
      />

      <CameraRig camKey={camKey} controls={controls} shot={shot} />
      <OrbitControls
        ref={controls}
        // 연출 샷이 도는 동안은 조작을 막아 카메라 워크가 끊기지 않게 한다
        enabled={drag === null && benchDrag === null && shot === null}
        enablePan={false}
        minDistance={22}
        maxDistance={190}
        maxPolarAngle={Math.PI / 2.08}
        autoRotate={cinematic}
        autoRotateSpeed={0.45}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

/* ─────────────────────────── 공개 컴포넌트 ─────────────────────────── */

/**
 * 골 선언 전에 슛 장면을 보여주는 시간(ms).
 * 박스로 찔러주는 패스(최대 0.8초) + 받아서 잡기(0.45초) + 슛(0.62초)이 들어가야 한다.
 */
const SHOT_WINDOW = 1900;

/** 이 시간·거리 안에서 손을 떼면 이동이 아니라 '클릭'으로 본다 */
const TAP_MS = 250;
const TAP_PX = 6;

export default function Pitch3D({
  camKey,
  overlays,
  cinematic,
  heatPlayer = null,
}: {
  camKey: CamKey;
  overlays: OverlayFlags;
  cinematic: boolean;
  heatPlayer?: string | null;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const setSelectedPlayer = useGame((s) => s.setSelectedPlayer);
  /** 드래그 시작 시점·좌표 — 짧게 누르고 떼면 이동이 아니라 상세 카드를 연다 */
  const tap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);

  const markTap = useCallback((id: string, x: number, y: number) => {
    tap.current = { id, t: performance.now(), x, y };
  }, []);

  const grab = useCallback(
    (id: string, x: number, y: number) => {
      markTap(id, x, y);
      setDrag(id);
    },
    [markTap]
  );

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
      onPointerUp={(e) => {
        const s = tap.current;
        tap.current = null;
        setDrag(null);
        if (!s) return;
        const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
        if (performance.now() - s.t < TAP_MS && moved < TAP_PX) setSelectedPlayer(s.id);
      }}
      onPointerLeave={() => {
        tap.current = null;
        setDrag(null);
      }}
    >
      <Canvas
        // 프레임이 떨어지면 R3F가 해상도를 자동으로 낮춘다 (저사양에서 버벅임 완화)
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: CAM_PRESETS[camKey].pos, fov: 42, near: 0.5, far: 800 }}
      >
        <Scene
          camKey={camKey}
          overlays={overlays}
          cinematic={cinematic}
          drag={drag}
          setDrag={setDrag}
          onGrab={grab}
          onMarkTap={markTap}
          heatPlayer={heatPlayer}
        />
      </Canvas>
    </div>
  );
}
