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
  ballReactionPositions,
  clamp,
  convexHull,
  drift,
  fromWorld,
  pitchFrame,
  toWorld,
  type PitchFrame,
  type PitchPoint,
  type PlacedPlayer,
} from "@/lib/pitchPositions";
import { ballTexture, labelTexture, shadowTexture } from "@/lib/pitchTextures";
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
  onGrab?: (id: string) => void;
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
}: TokenProps) {
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

    // 세리머니 점프 — 선수마다 위상을 어긋나게 해서 한꺼번에 뛰지 않게 한다
    const b = body.current;
    if (b) {
      if (partying && !gk) {
        const t = performance.now() * 0.006 + player.num * 0.9;
        b.position.y = Math.abs(Math.sin(t)) * 1.1;
        b.rotation.y = Math.sin(t * 0.5) * 0.6;
      } else if (b.position.y !== 0) {
        b.position.y *= 0.85;
        b.rotation.y *= 0.85;
      }
    }
  });

  const jersey = gk ? "#c98500" : color;

  return (
    <group ref={group}>
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

      {/* 그랩 히트박스 — 선수 드래그 중엔 언마운트해서 잔디 레이캐스트를 막지 않는다.
          벤치 드래그 중에는 교체 드롭 타깃으로 동작한다. */}
      {interactive && onGrab && (
        <mesh
          position={[0, 1.2, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (benchDragActive) return; // 벤치 드래그 중엔 선수 이동을 시작하지 않는다
            e.stopPropagation();
            onGrab(player.id);
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

interface Hop {
  from: THREE.Vector3;
  to: THREE.Vector3;
  apex: number; // 최고 높이(m)
  dur: number; // 초
  t: number;
  /** 이 패스를 받는 선수 id. 도착하면 이 선수가 공을 소유한다 */
  toId: string | null;
  /** 도착 후 공을 잡고 있는 시간(초) — 이 동안만 소유 표시가 뜬다 */
  dwell: number;
}

/**
 * 실제 축구다운 공 움직임.
 *
 * 이전 구현은 이벤트 위치로 그냥 미끄러져 갔다 — 공이 '흘러다니는 점'으로 보였다.
 * 여기서는 공을 홉(hop) 단위로 움직인다: 선수 사이를 패스로 이동하고,
 * 짧은 패스는 낮게 굴러가고 긴 전환 패스는 크게 뜨며, 착지 후에는 튄다.
 * 회전 속도는 실제 수평 속도에 비례해서 굴러가는 느낌이 난다.
 */
function Ball({
  frame,
  minute,
  ballWorld,
  celebrating,
  carrier,
  receiver,
}: {
  frame: PitchFrame;
  minute: number;
  /** 매 프레임 실제 공 위치를 여기 기록해 선수 반응이 같은 공을 보게 한다 */
  ballWorld: MutableRefObject<THREE.Vector3>;
  /** 세리머니 중엔 공이 골망 안에 머문다 */
  celebrating?: boolean;
  /** 공을 실제로 잡고 있는 선수 id (패스 이동 중에는 null) */
  carrier: MutableRefObject<string | null>;
  /**
   * 패스가 날아가는 동안의 수신 예정 선수.
   * 이게 없으면 패스 시간(최대 1.5초) 내내 아무 표시도 없어서 깜빡이는 것처럼 보인다.
   */
  receiver: MutableRefObject<string | null>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const hop = useRef<Hop | null>(null);
  const hopIndex = useRef(0);
  const spin = useRef(new THREE.Vector3());
  /** 도착 후 남은 소유 시간 */
  const holding = useRef(0);

  // 렌더 사이에 최신 프레임을 읽기 위한 참조 (useFrame 클로저 고정 방지)
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const minuteRef = useRef(minute);
  minuteRef.current = minute;

  /** 다음 목적지를 고른다 — 점유 팀 선수에게 패스하거나, 전술적 공 위치로 전환 */
  const pickNext = (currentPos: THREE.Vector3): Hop => {
    const f = frameRef.current;
    const m = minuteRef.current;
    const i = hopIndex.current++;
    const anchor = vec(f.ball, 0);

    // 공이 전술적 위치에서 너무 멀어졌으면 그쪽으로 크게 전환한다
    const drifted = currentPos.distanceTo(anchor) > 22;

    const squadAll = (f.possession === "home" ? f.home : f.away).filter((p) => !p.gk);

    let dest: THREE.Vector3;
    let toId: string | null = null;
    if (drifted || !f.live) {
      dest = anchor;
      // 슛·골처럼 전술 위치로 크게 전환할 때도 '누가 잡는지'는 있어야 한다.
      // 그 지점에 가장 가까운 점유팀 선수가 받는 것으로 본다.
      let bestD = Infinity;
      for (const p of squadAll) {
        const d = vec(p.pos, 0).distanceTo(anchor);
        if (d < bestD) {
          bestD = d;
          toId = p.player.id;
        }
      }
    } else {
      // 점유 팀 선수 중 하나에게 패스 — 전방 패스에 가중
      const squad = squadAll;
      if (squad.length === 0) {
        dest = anchor;
      } else {
        const forwardSign = f.possession === "home" ? 1 : -1;
        const scored = squad
          .map((p, idx) => {
            const w = vec(p.pos, 0);
            const dist = w.distanceTo(currentPos);
            // 너무 가깝지도 멀지도 않은 선수 + 전진 방향 선호
            const near = Math.exp(-Math.pow(dist - 16, 2) / 320);
            const forward = ((p.pos.y - f.ball.y) * forwardSign) / 100;
            return { w, id: p.player.id, s: near * (1 + forward * 0.8) + hashRand(m, i + idx) * 0.25 };
          })
          .sort((a, b) => b.s - a.s);
        dest = scored[0].w;
        toId = scored[0].id;
      }
    }

    const dist = currentPos.distanceTo(dest);
    const r = hashRand(m, i);
    // 짧은 패스는 굴러가고(낮은 아크), 긴 전환은 크게 뜬다
    const lofted = dist > 26 || r > 0.72;
    const apex = lofted ? Math.min(9, 1.6 + dist * 0.14) : 0.1 + dist * 0.012;
    // 속도: 롱패스가 더 빠르지만 거리 비례로 시간이 늘어난다
    const speed = lofted ? 26 : 17;
    // 이동 시간 상한을 낮췄다 — 길면 '잡고 있는' 구간보다 훨씬 길어져 표시가 끊겨 보인다
    const dur = Math.max(0.35, Math.min(1.5, dist / speed));
    // 받은 선수가 잡고 있다가 다음 패스를 준다 (소유 표시가 진하게 뜨는 구간)
    const dwell = toId ? 0.7 + hashRand(m, i + 977) * 0.6 : 0;

    return { from: currentPos.clone(), to: dest, apex, dur, t: 0, toId, dwell };
  };

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const step = Math.min(dt, 0.05);

    // 세리머니 중엔 골망 안에 정지 (다음 홉을 고르지 않는다)
    if (celebrating) {
      const goalZ = (frameRef.current.possession === "home" ? -1 : 1) * (PITCH.length / 2 + 1.2);
      m.position.lerp(V.set(0, BALL_R, goalZ), 1 - Math.pow(0.02, step));
      ballWorld.current.copy(m.position);
      if (shadow.current) shadow.current.position.set(m.position.x, 0.035, m.position.z);
      hop.current = null;
      holding.current = 0;
      carrier.current = null;
      receiver.current = null;
      return;
    }

    if (!hop.current) {
      const start = vec(frameRef.current.ball, 0);
      m.position.set(start.x, BALL_R, start.z);
      hop.current = pickNext(m.position.clone());
      holding.current = 0;
    }

    const h = hop.current;

    // 받은 선수가 공을 잡고 있는 구간 — 소유 표시가 진하게 뜬다
    if (holding.current > 0) {
      holding.current -= step;
      carrier.current = h.toId;
      receiver.current = null;
      ballWorld.current.copy(m.position);
      if (shadow.current) {
        shadow.current.position.set(m.position.x, 0.035, m.position.z);
        shadow.current.scale.setScalar(1);
      }
      if (holding.current <= 0) {
        hop.current = pickNext(m.position.clone());
        carrier.current = null;
      }
      return;
    }

    // 공이 이동 중 — 아무도 '잡고' 있진 않지만 받을 선수는 흐리게 표시한다
    carrier.current = null;
    receiver.current = h.toId;
    h.t += step / h.dur;

    if (h.t >= 1) {
      m.position.set(h.to.x, BALL_R, h.to.z);
      holding.current = h.dwell;
      if (h.dwell <= 0) hop.current = pickNext(m.position.clone());
      return;
    }

    const t = h.t;
    const prevX = m.position.x;
    const prevZ = m.position.z;

    // 수평: 등속 / 수직: 포물선 + 착지 직전 바운스
    m.position.x = h.from.x + (h.to.x - h.from.x) * t;
    m.position.z = h.from.z + (h.to.z - h.from.z) * t;

    let y = BALL_R + 4 * h.apex * t * (1 - t);
    // 로빙 볼은 마지막 15%에서 한 번 더 작게 튄다
    if (h.apex > 1.2 && t > 0.85) {
      const bt = (t - 0.85) / 0.15;
      y = BALL_R + h.apex * 0.16 * 4 * bt * (1 - bt);
    }
    m.position.y = y;

    // 회전: 실제 수평 이동량 기반 — 구르는 방향으로 굴러간다
    const dx = m.position.x - prevX;
    const dz = m.position.z - prevZ;
    const travelled = Math.hypot(dx, dz);
    if (travelled > 1e-5) {
      const angle = travelled / BALL_R;
      spin.current.set(dz, 0, -dx).normalize();
      m.rotateOnWorldAxis(spin.current, angle);
    }

    ballWorld.current.copy(m.position);

    if (shadow.current) {
      shadow.current.position.set(m.position.x, 0.035, m.position.z);
      // 높이 올라갈수록 그림자는 커지고 옅어진다
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
  const hull = useMemo(
    () => convexHull(placed.filter((p) => !p.gk).map((p) => p.pos)),
    [placed]
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

/**
 * 매 프레임 **실제 화면의 공** 위치로 양 팀 배치를 다시 계산한다.
 *
 * 이전에는 분 단위 앵커(ballTarget)에 반응했는데, 3D에서 눈에 보이는 공은
 * 선수 사이를 홉으로 오가는 별개 좌표라 선수들이 보이지 않는 점으로 수렴했다.
 * 그래서 "공을 따라간다"로 보이지 않았다. 여기서 그 둘을 하나로 묶는다.
 *
 * 토큰마다 계산하면 O(n²)이 되므로 컨트롤러 하나가 22명분을 한 번에 처리한다.
 */
function BallReactionController({
  frame,
  press,
  ballWorld,
  targets,
  nearBall,
  enabled,
  dragId,
  celebrate,
}: {
  frame: PitchFrame;
  press: number;
  ballWorld: MutableRefObject<THREE.Vector3>;
  targets: MutableRefObject<LiveTargets>;
  /** 공 주변에서 태클/패스로 관여 가능한 선수들 (양 팀) */
  nearBall: MutableRefObject<Set<string>>;
  enabled: boolean;
  dragId: string | null;
  /** 골 세리머니 중인 팀. 경기 시계는 멈춰도 이 동안 3D는 계속 움직인다 */
  celebrate: Side | null;
}) {
  useFrame((state) => {
    const map = targets.current;
    map.clear();
    nearBall.current.clear();

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
      scoring.forEach((p, i) => {
        if (p.gk) {
          map.set(p.player.id, toWorld(p.pos));
          return;
        }
        const ang = (i / Math.max(1, scoring.length)) * Math.PI * 2;
        map.set(
          p.player.id,
          toWorld({
            x: clamp(cx + Math.cos(ang) * 8, 6, 94),
            y: clamp(cy + Math.sin(ang) * 8, 6, 94),
          })
        );
      });
      other.forEach((p) => map.set(p.player.id, toWorld(p.pos)));
      return;
    }

    if (!enabled) return;

    const ball = fromWorld(ballWorld.current.x, ballWorld.current.z);
    // 연속 시간 드리프트 — 분 단위로 계산하면 배속에서 선수가 순간이동한다
    const t = state.clock.elapsedTime * 0.55;

    for (const [squad, attackingUp, side, seedBase] of [
      [frame.homeBase, true, "home", 0],
      [frame.awayBase, false, "away", 20],
    ] as const) {
      const drifted = squad.map((p, i) => {
        const d = drift(i + seedBase, t, p.gk);
        return {
          id: p.player.id,
          pos: { x: p.pos.x + d.dx, y: p.pos.y - d.dy },
          gk: p.gk,
        };
      });

      const hasBall = frame.possession === side;
      const moved = ballReactionPositions(drifted, ball, { press, hasBall, attackingUp });

      moved.forEach((pos, id) => {
        // 드래그 중인 선수는 커서를 정확히 따라야 하므로 반응에서 제외
        if (id === dragId) return;
        const w = toWorld(pos);
        map.set(id, w);
        // 공에서 INVOLVED_M 안이면 태클/패스로 즉시 관여 가능한 거리로 본다
        const d = Math.hypot(w.x - ballWorld.current.x, w.z - ballWorld.current.z);
        if (d < INVOLVED_M) nearBall.current.add(id);
      });
    }
    // 소유 판정은 Ball이 패스 수신자를 직접 기록한다 (거리로 추정하지 않는다)
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

  // 연출 샷이 프리셋보다 우선한다. 샷이 끝나면 프리셋으로 돌아간다.
  const shotKey = shot?.key ?? null;
  if (lastShot.current !== shotKey) {
    lastShot.current = shotKey;
    if (shot) {
      goal.current = {
        pos: new THREE.Vector3(...shot.pos),
        target: new THREE.Vector3(...shot.target),
        speed: shot.speed ?? 1.6,
      };
    } else {
      const p = CAM_PRESETS[camKey];
      goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), speed: 1 };
    }
  }

  if (last.current !== camKey) {
    last.current = camKey;
    if (!shot) {
      const p = CAM_PRESETS[camKey];
      goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), speed: 1 };
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
  /** 히트맵 대상 선수. null이면 팀 전체 */
  heatPlayer: string | null;
}

function Scene({ camKey, overlays, cinematic, drag, setDrag, heatPlayer }: SceneProps) {
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

  const match = getMatch(matchId);
  // smoothDrift: 흔들림은 렌더러가 연속 시간으로 준다 (분 단위면 배속에서 튄다)
  const frame = useMemo(
    () => pitchFrame({ match, players, tactics, minute, playing, dragId: drag, smoothDrift: true }),
    [match, players, tactics, minute, playing, drag]
  );

  // 실제 화면의 공 위치 + 그 공을 기준으로 계산된 선수 목표 (매 프레임 갱신)
  const ballWorld = useRef(new THREE.Vector3());
  const liveTargets = useRef<LiveTargets>(new Map());
  const carrier = useRef<string | null>(null);
  const receiver = useRef<string | null>(null);
  const nearBall = useRef<Set<string>>(new Set());

  /* ── 이벤트 연출: 골 스윕 · 킥오프 플라이인 ── */
  const [shot, setShot] = useState<CineShot | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [celebrate, setCelebrate] = useState<Side | null>(null);

  const goalNow = match?.timeline.find((e) => e.minute === minute && e.type === "goal");
  const goalKey = goalNow ? `goal-${minute}` : null;

  useEffect(() => {
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
    // 중앙선 쪽에서 코너를 바라보게 — 뒤로 골대가 배경에 걸린다
    const towardMid = spot.z > 0 ? -1 : 1;
    setShot({
      key: goalKey!,
      pos: [spot.x + 15, 7.5, spot.z + towardMid * 21],
      target: [spot.x, 1.6, spot.z],
      speed: 2.4,
    });
    setFlashing(true);
    setCelebrate(goalNow.side);
    const id = setTimeout(() => {
      setShot(null);
      setFlashing(false);
      setCelebrate(null);
    }, 4600);
    return () => clearTimeout(id);
  }, [goalKey, goalNow]);

  // 킥오프 — 높은 곳에서 프리셋 위치로 내려온다
  useEffect(() => {
    if (minute !== 1 || !playing) return;
    setShot({ key: "kickoff", pos: [0, 150, 6], target: [0, 0, 0], speed: 0.55 });
    const id = setTimeout(() => setShot(null), 2200);
    return () => clearTimeout(id);
  }, [minute, playing]);

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
      setPlayerPos(drag, Math.max(4, Math.min(96, p.x)), Math.max(4, Math.min(96, p.y)));
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
      <BallReactionController
        frame={frame}
        press={tactics.press}
        ballWorld={ballWorld}
        targets={liveTargets}
        nearBall={nearBall}
        enabled={frame.live}
        dragId={drag}
        celebrate={celebrate}
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
          partying={celebrate === "away"}
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
          onGrab={setDrag}
          benchDragActive={benchDrag !== null}
          aimed={subTarget === p.player.id}
          onAim={setSubTarget}
          booked={bookedById.get(p.player.id) ?? null}
          liveTargets={liveTargets}
          carrier={carrier}
          receiver={receiver}
          nearBall={nearBall}
          partying={celebrate === "home"}
        />
      ))}

      <Ball
        frame={frame}
        minute={minute}
        ballWorld={ballWorld}
        celebrating={celebrate !== null}
        carrier={carrier}
        receiver={receiver}
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

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: CAM_PRESETS[camKey].pos, fov: 42, near: 0.5, far: 800 }}
      >
        <Scene
          camKey={camKey}
          overlays={overlays}
          cinematic={cinematic}
          drag={drag}
          setDrag={setDrag}
          heatPlayer={heatPlayer}
        />
      </Canvas>
    </div>
  );
}
