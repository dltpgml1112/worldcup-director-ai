import type { MatchData, MatchEvent, Player, Side, Tactics } from "./types";
import { playerStamina } from "./stamina";

/**
 * 경고/퇴장 관리.
 *
 * 카드가 그냥 '연출'로 끝나면 전술 프로그램이 아니다. 여기서는 경고를 **제약 조건**으로
 * 바꾼다: 경고받은 선수를 강한 압박에 계속 두면 두 번째 경고 위험이 올라가고,
 * 감독은 압박을 낮추거나 교체하는 결정을 강요받는다.
 *
 * 두 번째 경고를 난수로 '발생'시키지는 않는다 — 이 앱의 원칙이 결정론(같은 입력=같은 결과)이라,
 * 무작위 퇴장은 시연 재현성을 깨고 사용자의 판단을 운으로 만든다.
 * 대신 **위험도를 설명 가능한 수치로 제시**하고 조치를 권한다.
 */

export interface Booking {
  /** 타임라인 이벤트의 선수 문자열 (예: "Hwang In-beom") */
  player: string;
  side: Side;
  card: "yellow" | "red";
  minute: number;
}

/** 특정 분까지 누적된 경고/퇴장 */
export function bookingsAt(match: MatchData | undefined, minute: number): Booking[] {
  if (!match) return [];
  return match.timeline
    .filter((e): e is MatchEvent & { card: "yellow" | "red" } =>
      e.type === "card" && !!e.card && e.minute <= minute
    )
    .map((e) => ({
      player: e.player ?? "",
      side: e.side,
      card: e.card,
      minute: e.minute,
    }));
}

/**
 * 이벤트의 선수 문자열을 스쿼드의 Player에 맞춘다.
 * 타임라인은 "Son", "Hwang In-beom"처럼 축약형이 섞여 있어 부분 일치로 찾는다.
 */
export function matchPlayer(players: Player[], eventName: string): Player | undefined {
  if (!eventName) return undefined;
  const needle = eventName.toLowerCase().trim();
  return (
    players.find((p) => p.name.toLowerCase() === needle) ??
    players.find((p) => p.name.toLowerCase().includes(needle)) ??
    players.find((p) => needle.includes(p.name.toLowerCase())) ??
    players.find((p) => {
      const surname = p.name.toLowerCase().split(" ").pop() ?? "";
      return surname.length > 2 && needle.includes(surname);
    })
  );
}

/** 우리 팀에서 현재 경고 상태인 선수 (필드에 남아있는 선수만) */
export function bookedPlayers(
  match: MatchData | undefined,
  players: Player[],
  minute: number
): { player: Player; booking: Booking }[] {
  return bookingsAt(match, minute)
    .filter((b) => b.side === "home")
    .map((b) => {
      const player = matchPlayer(players, b.player);
      return player ? { player, booking: b } : null;
    })
    .filter((v): v is { player: Player; booking: Booking } => v !== null);
}

export interface RedRisk {
  player: Player;
  booking: Booking;
  /** 0~100 — 두 번째 경고 위험도 */
  risk: number;
  /** 위험을 만든 요인 (설명 가능성) */
  drivers: string[];
}

/**
 * 두 번째 경고 위험도.
 *
 * 근거: 경고받은 선수가 ⑴ 강한 압박을 계속 수행하고 ⑵ 체력이 떨어져 태클 타이밍이
 * 늦어지며 ⑶ 경기 시간이 지날수록 파울 누적 압력이 커질 때 퇴장 확률이 오른다.
 * 각 요인의 기여분을 그대로 노출해서 "왜 위험한지"를 감독이 확인할 수 있게 한다.
 */
export function redCardRisk(
  match: MatchData | undefined,
  players: Player[],
  minute: number,
  tactics: Tactics,
  lang: "ko" | "en" = "ko"
): RedRisk[] {
  const ko = lang === "ko";
  return bookedPlayers(match, players, minute)
    .filter(({ booking }) => booking.card === "yellow")
    .map(({ player, booking }) => {
      const drivers: string[] = [];
      let risk = 22; // 경고 보유 자체의 기본 위험

      // 압박 강도 — 가장 큰 요인
      const pressPart = (tactics.press / 100) * 34 + (tactics.highPress ? 10 : 0);
      risk += pressPart;
      if (tactics.press > 65 || tactics.highPress) {
        drivers.push(ko ? `압박 ${tactics.press}%` : `Press ${tactics.press}%`);
      }

      // 체력 저하 — 늦은 태클
      const stam = playerStamina(player, minute, tactics);
      if (stam < 60) {
        const part = ((60 - stam) / 60) * 22;
        risk += part;
        drivers.push(ko ? `체력 ${Math.round(stam)}%` : `Stamina ${Math.round(stam)}%`);
      }

      // 경과 시간
      const elapsed = Math.max(0, minute - booking.minute);
      risk += Math.min(12, elapsed * 0.16);
      if (elapsed > 20) {
        drivers.push(ko ? `경고 후 ${elapsed}분 경과` : `${elapsed}' since booking`);
      }

      // 수비 라인이 높으면 뒷공간 커버 파울이 늘어난다
      if (tactics.line > 68) {
        risk += 8;
        drivers.push(ko ? `높은 라인 ${tactics.line}%` : `High line ${tactics.line}%`);
      }

      return {
        player,
        booking,
        risk: Math.round(Math.max(0, Math.min(100, risk))),
        drivers,
      };
    })
    .sort((a, b) => b.risk - a.risk);
}

/** 위험도 구간 → 색/라벨 (색 단독으로 상태를 표현하지 않도록 라벨 동반) */
export function riskTone(risk: number, lang: "ko" | "en" = "ko") {
  const ko = lang === "ko";
  if (risk >= 70) return { color: "#d03b3b", label: ko ? "매우 높음" : "Critical" };
  if (risk >= 50) return { color: "#ec835a", label: ko ? "높음" : "High" };
  if (risk >= 32) return { color: "#fab219", label: ko ? "주의" : "Elevated" };
  return { color: "#6b7686", label: ko ? "낮음" : "Low" };
}
