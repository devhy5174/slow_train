/* =====================================================
   0. 게임 상태 저장소 (state.js)
   런타임 상태를 한 곳에서 관리합니다.
   core.js의 렌더링 전역(renderer·scene·cam 등)과 달리,
   여기에는 네트워크로 주고받거나 초기화·재설정이 필요한 값만 담습니다.

   Supabase 연결 시 교체 지점:
     - carId        → 서버 방 배정 응답값으로 교체
     - occ          → 서버에서 받은 객차 좌석 상태로 초기화
     - hasTicket    → 서버 발급 승차권 확인 결과로 교체
   ===================================================== */

const GameState = {

  // ----- 객차(Room) 정보 -----
  // 향후: Supabase 방 배정 시 서버에서 받은 carId로 교체
  // 객차 이동 시 occ 초기화 필요
  carId: 1,

  // ----- 플레이어 세션 -----
  // main.js에서 입장 방식(승차권 구매/무임승차)에 따라 설정
  hasTicket: true,

  // ----- 게임 흐름 -----
  ended: false,      // 접속 종료 여부 (강제 퇴장 후 렌더 루프 중단에 사용)
  inspecting: false, // 승무원 검표 진행 중 (이동 입력·착석 클릭 차단)
  kick: null,        // 강제 퇴장 카운트다운 { t: 남은 초 } | null

  // ----- 좌석 점유 테이블 -----
  // 현재 구조: occ[seatId] = actorId
  //   - 플레이어·NPC 공용, 중복 착석 방지에 사용
  //   - actor.js sitDown/standUp/goSeat/cancelRes에서 직접 읽고 씀
  //
  // 향후 승차권 시스템 적용 시 확장 예정:
  //   occ[seatId] = {
  //     reservedBy:  userId | null,   // 승차권 소유자 (지정석만 존재)
  //     occupiedBy:  actorId | null,  // 현재 착석자
  //   }
  //   seatType 'free' 좌석은 reservedBy 항상 null
  //   객차(carId) 이동 시 반드시 occ = {} 로 초기화
  occ: {},

};
