/**
 * 팀 선택(경기 뒤집기) 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-mirror.mts
 *
 * 재생 경기에서 원정팀을 맡으면 데이터를 통째로 뒤집는다. 한 군데라도 안 뒤집히면
 * "내 팀은 프랑스인데 스코어는 아르헨티나 기준" 같은 어긋남이 생긴다.
 */
import { MATCHES } from "../data/matches";
import { mirrorMatch } from "../lib/fixture";

for (const m of MATCHES) {
  const x = mirrorMatch(m);
  const problems: string[] = [];

  if (x.home.id !== m.away.id || x.away.id !== m.home.id) problems.push("팀이 안 바뀜");
  if (x.homeXI !== m.awayXI || x.awayXI !== m.homeXI) problems.push("선발이 안 바뀜");
  if (x.finalScore[0] !== m.finalScore[1] || x.finalScore[1] !== m.finalScore[0]) problems.push("스코어가 안 뒤집힘");
  if (!x.homeBench?.length) problems.push("내 팀 벤치가 비어 있음 (교체 불가)");
  if ((x.actualHome ?? "home") === (m.actualHome ?? "home")) problems.push("실제 홈 표기가 안 바뀜");

  const hg = x.timeline.filter((e) => e.type === "goal" && e.side === "home").length;
  const ag = x.timeline.filter((e) => e.type === "goal" && e.side === "away").length;
  const om = m.timeline.filter((e) => e.type === "goal" && e.side === "away").length;
  if (hg !== om) problems.push(`골 이벤트 side 불일치 (뒤집은 홈골 ${hg} vs 원본 원정골 ${om})`);
  // 연장·승부차기가 있는 경기는 타임라인 골 수와 finalScore가 다를 수 있어 참고만 한다

  const pens = x.penalties ? ` 승부차기 ${x.penalties.join("-")}` : "";
  console.log(
    `${m.home.code}–${m.away.code} ${m.finalScore.join("-")}  →  ` +
      `${x.home.code}–${x.away.code} ${x.finalScore.join("-")}${pens}  ` +
      `벤치 ${x.homeBench?.length ?? 0}명, 타임라인 골 ${hg}-${ag}  ` +
      (problems.length ? `❌ ${problems.join(" / ")}` : "✓")
  );
}
