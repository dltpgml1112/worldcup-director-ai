"use client";

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import {
  PITCH,
  convexHull,
  fromWorld,
  pitchFrame,
  toWorld,
  type PitchPoint,
  type PlacedPlayer,
} from "@/lib/pitchPositions";
import {
  TURF_MARGIN,
  ballTexture,
  labelTexture,
  netTexture,
  shadowTexture,
  standTexture,
  turfTexture,
} from "@/lib/pitchTextures";
import type { Lang } from "@/lib/i18n";
import { CAM_PRESETS, type CamKey, type OverlayFlags } from "@/lib/pitchView";

/* ─────────────────────────── 헬퍼 ─────────────────────────── */

const V = new THREE.Vector3();

/** 절대 피치 좌표 → three 벡터 */
function vec(p: PitchPoint, y = 0) {
  const w = toWorld(p);
  return new THREE.Vector3(w.x, y, w.z);
}

/* ─────────────────────────── 스타디움 ─────────────────────────── */

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
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial map={tex} color="#161c25" roughness={0.95} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[crowd.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[crowd.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.62} vertexColors sizeAttenuation transparent opacity={0.72} />
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
      <mesh position={[0, 28.6, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[6, 3, 1]} />
        <meshStandardMaterial color="#0f141b" emissive="#fdf6d8" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Stadium() {
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

/* ─────────────────────────── 골대 · 코너 깃발 ─────────────────────────── */

function Goal({ sign }: { sign: 1 | -1 }) {
  const net = netTexture();
  const w = 7.32;
  const h = 2.44;
  const d = 2;
  const z = (sign * PITCH.length) / 2;
  const post = (
    <cylinderGeometry args={[0.07, 0.07, h, 10]} />
  );
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

function CornerFlags() {
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

/* ─────────────────────────── 잔디 (드래그 평면) ─────────────────────────── */

function Turf({ onDragMove }: { onDragMove: (p: PitchPoint) => void }) {
  const tex = turfTexture();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        const p = fromWorld(e.point.x, e.point.z);
        onDragMove(p);
      }}
    >
      <planeGeometry args={[PITCH.width + TURF_MARGIN * 2, PITCH.length + TURF_MARGIN * 2]} />
      <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
    </mesh>
  );
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
}: TokenProps) {
  const group = useRef<THREE.Group>(null);
  const { player, pos, gk } = placed;
  const target = useMemo(() => vec(pos), [pos.x, pos.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = lang === "ko" && player.nameKo ? player.nameKo : player.name.split(" ").pop() ?? player.name;
  const label = useMemo(
    () => labelTexture({ num: player.num, name, color, legend: player.legend, dim: !isHome }),
    [player.num, name, color, player.legend, isHome]
  );

  const spawned = useRef(false);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // position을 prop으로 주면 매 렌더마다 스냅되므로 여기서만 위치를 관리한다
    if (!spawned.current) {
      g.position.copy(target);
      spawned.current = true;
      return;
    }
    // 드래그 중엔 즉시 추종, 그 외엔 부드럽게 보간
    const k = dragging ? 1 : 1 - Math.pow(0.0015, Math.min(dt, 0.1));
    g.position.lerp(target, k);
  });

  const jersey = gk ? "#c98500" : color;

  return (
    <group ref={group}>
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

      {/* 선택/드래그 링 */}
      {isHome && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.8, dragging ? 1.25 : 1.0, 32]} />
          <meshBasicMaterial
            color={dragging ? "#ffffff" : player.legend ? "#c98500" : color}
            transparent
            opacity={dragging ? 0.95 : 0.55}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 몸통 */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.8, 12]} />
        <meshStandardMaterial color="#151a21" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 1.0, 14]} />
        <meshStandardMaterial color={jersey} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#c99e78" roughness={0.8} />
      </mesh>

      {/* 번호 · 이름 빌보드 — 이름 라벨 하단이 머리(2.2m) 바로 위에 오도록 배치 */}
      <sprite position={[0, 3.6, 0]} scale={[5.6, 3.15, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} depthTest={false} />
      </sprite>

      {/* 그랩 히트박스 — 드래그 중엔 언마운트해서 잔디 레이캐스트를 막지 않는다 */}
      {interactive && onGrab && (
        <mesh
          position={[0, 1.2, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onGrab(player.id);
          }}
        >
          <cylinderGeometry args={[1.0, 1.0, 2.6, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ─────────────────────────── 공 ─────────────────────────── */

function Ball({ pos, height }: { pos: PitchPoint; height: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const target = useMemo(() => vec(pos, Math.max(0.11, height)), [pos.x, pos.y, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const spawned = useRef(false);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (!spawned.current) {
      m.position.copy(target);
      spawned.current = true;
    }
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.1));
    m.position.lerp(target, k);
    m.rotation.x += dt * 3.4;
    m.rotation.z += dt * 1.6;
    if (shadow.current) {
      shadow.current.position.set(m.position.x, 0.03, m.position.z);
      const s = 1 + m.position.y * 0.35;
      shadow.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.115, 20, 16]} />
        <meshStandardMaterial map={ballTexture()} roughness={0.42} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} opacity={0.8} />
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

/* ─────────────────────────── 카메라 ─────────────────────────── */

function CameraRig({ camKey, controls }: { camKey: CamKey; controls: MutableRefObject<any> }) {
  const { camera } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const last = useRef<CamKey | null>(null);

  if (last.current !== camKey) {
    last.current = camKey;
    const p = CAM_PRESETS[camKey];
    goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
  }

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.1));
    camera.position.lerp(g.pos, k);
    const c = controls.current;
    if (c) {
      c.target.lerp(g.target, k);
      c.update();
    }
    if (camera.position.distanceTo(g.pos) < 0.2) goal.current = null;
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
}

function Scene({ camKey, overlays, cinematic, drag, setDrag }: SceneProps) {
  const controls = useRef<any>(null);
  const players = useGame((s) => s.players);
  const setPlayerPos = useGame((s) => s.setPlayerPos);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const lang = useGame((s) => s.lang);

  const match = getMatch(matchId);
  const frame = useMemo(
    () => pitchFrame({ match, players, tactics, minute, playing, dragId: drag }),
    [match, players, tactics, minute, playing, drag]
  );

  const homeColor = match?.home.primary ?? "#3987e5";
  const awayColor = match?.away.primary ?? "#d95926";

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

      <hemisphereLight args={["#cfe3ff", "#1a2a20", 0.85]} />
      <directionalLight position={[40, 70, 30]} intensity={1.5} color="#fff6e0" />
      <directionalLight position={[-50, 50, -40]} intensity={0.55} color="#9fc4ff" />

      <Stadium />
      <Turf onDragMove={onDragMove} />
      <Goal sign={1} />
      <Goal sign={-1} />
      <CornerFlags />

      {/* 전술 오버레이 */}
      {overlays.block && <BlockShape placed={frame.home} color={homeColor} />}
      {overlays.line && <LineMarker y={frame.homeLine} color={homeColor} />}
      {overlays.line && <LineMarker y={frame.awayLine} color={awayColor} />}
      {overlays.press && <PressZone ball={frame.ball} press={tactics.press} />}

      {/* 상대 (드래그 불가) */}
      {frame.away.map((p) => (
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
        />
      ))}

      {/* 우리 팀 (드래그 가능) */}
      {frame.home.map((p) => (
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
        />
      ))}

      <Ball pos={frame.ball} height={frame.ballHeight} />

      <CameraRig camKey={camKey} controls={controls} />
      <OrbitControls
        ref={controls}
        enabled={drag === null}
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
}: {
  camKey: CamKey;
  overlays: OverlayFlags;
  cinematic: boolean;
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
        <Scene camKey={camKey} overlays={overlays} cinematic={cinematic} drag={drag} setDrag={setDrag} />
      </Canvas>
    </div>
  );
}
