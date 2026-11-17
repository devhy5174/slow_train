/* =====================================================
   2. 객차 배치 데이터 (data.js)
   좌표계: X = 객차 길이, Z = 폭, 통로 중앙 z = 0
   좌석을 추가/이동하려면 이 파일만 수정하면 됩니다.
   ===================================================== */

// 객차 크기(L: 길이, W: 폭, H: 높이)
const CAR = { L: 15.6, W: 5.2, H: 2.6 };
// 통로 이동 한계: 플레이어/NPC가 걸을 수 있는 범위(좌석·벽 통과 방지)
const AISLE = 0.55, XMAX = 7.2;

// 일반 2인석 벤치의 x 위치(왼쪽 3줄 + 오른쪽 3줄)
const NORMAL_X = [-6.2, -4.8, -3.4, 3.4, 4.8, 6.2];
// 중앙 테이블 4인석 벤치(yaw 0 = +x 바라봄, PI = -x 바라봄, k = 구분 글자)
const TABLE_B = [{ x: -1.45, yaw: 0, k: 'A' }, { x: 1.45, yaw: Math.PI, k: 'B' }];

// 벤치 목록 생성. side -1 = 창가(왼쪽), +1 = 오른쪽. id 예: N1L, TLA
const BENCHES = [];
for (const side of [-1, 1]) {
  const s = side < 0 ? 'L' : 'R';
  NORMAL_X.forEach((x, i) => BENCHES.push({ id: `N${i + 1}${s}`, x, side, yaw: 0, zone: 'normal' }));
  TABLE_B.forEach(t => BENCHES.push({ id: `T${s}${t.k}`, x: t.x, side, yaw: t.yaw, zone: 'table' }));
}

// 좌석 목록: 벤치 1개당 좌석 2개(예: N1L-1, TLA-2). 총 32석
// seatType: 'reserved' = 지정석 (일반 2인석, 24개) / 'free' = 자유석 (중앙 테이블석, 8개)
//
// 향후 승차권 시스템에서 각 좌석의 상태는 GameState.occ로 관리:
//   현재: occ[seatId] = actorId
//   향후: occ[seatId] = { reservedBy: userId | null, occupiedBy: actorId | null }
const SEATS = BENCHES.flatMap(b => [0, 1].map(i => ({
  id: `${b.id}-${i + 1}`,
  x: b.x,
  z: b.side * (1.15 + 0.9 * i),
  yaw: b.yaw,
  zone: b.zone,
  seatType: b.zone === 'normal' ? 'reserved' : 'free',
})));

// 좌석 점유 테이블은 GameState.occ(state.js)에서 관리합니다.
// 객차(carId)별 상태이므로 GameState에 위치합니다.
