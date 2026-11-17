/* =====================================================
   9. 역무원 표 검사 (conductor.js)

   ── 싱글플레이 베타 현재 흐름 ──────────────────────────
   등장 → 통로 이동 → 플레이어 옆에서 멈춤
     → openTicket()  : 팝업(tkModal) 표시
     → showTicket()  : [보여주기] 클릭 → 좌석 상태별 반응
     → noTicket()    : [표 없음] 클릭 → 강제 퇴장
   임의 규칙: hide 상태 플레이어는 검표하지 않음

   ── 확정된 검표 UX (향후 구현 예정) ─────────────────────
   1. 승무원이 플레이어 앞에 도착 → 검표 말풍선
   2. 플레이어(대상자)에게 '승차권 제출하기' 버튼 + 5초 카운트다운 표시
      - 다른 승객에게는 "OO번 승객 검표 중" 상태만 보임
   3. 버튼 클릭 or 5초 경과 → 자동 승차권 보유 여부 판정
      - 버튼 누르지 않아도 hasTicket 기준으로 결과 결정 (버튼은 UX용)
   4. 승차권 있음 → 정상 처리(좌석 상태 분기) → 다음 승객 이동
      승차권 없음 → 무임승차 적발 이벤트
   5. 연출 종료 → 승무원 계속 이동

   ── Supabase 연결 시 교체/추가 지점 ─────────────────────
   SYNC-1 : 승무원 위치·이동 → 서버 → 같은 객차 전체 브로드캐스트
   SYNC-2 : 검표 대상 승객 ID + 타이머 시작 → 서버에서 관리
            (클라이언트가 각자 타이머를 돌리면 오차 발생)
   SYNC-3 : 검표 결과(pass/fail) → 서버 판정 후 클라이언트 적용
   SYNC-4 : 선택 버튼·카운트다운 UI → 대상자에게만 렌더
   SYNC-5 : 말풍선·연출 → 같은 객차 전체 공유
   ===================================================== */

const INSPECT_GAP = 60; // 승무원이 다시 등장하는 간격(초)

// 검표 성공 후 가끔 사용하는 따뜻한 인사 대사
// 반복 방지를 위해 90초 쿨다운 + 45% 확률 적용
const CONDUCTOR_GREETINGS = [
  "오늘은 창밖 풍경이 참 좋네요.",
  "느린 기차에서는 서두르지 않으셔도 됩니다.",
  "편안한 여행 되시길 바랍니다.",
];
let _lastGreetedAt = -Infinity; // 마지막 인사 시각 (ms)

// 5초 자동 판정 타이머 상태
// [Supabase SYNC-2] 멀티플레이에서는 이 타이머를 서버가 소유하고 클라이언트는 UI만 표시
let _inspectTimer = null; // setTimeout 핸들 — 5초 후 자동 판정
let _inspectInterval = null; // setInterval 핸들 — 1초마다 카운트다운 갱신
let _inspectCountEl = null; // 카운트다운 표시 DOM 요소

// ── 승무원 생성 ────────────────────────────────────────
// 처음엔 숨겨 두고 conductorTick이 25초 뒤에 등장시킴
// C.mode: 'walk'(이동) | 'ask'(검표 직전 대기) | 'popup'(팝업 대기)
// [Supabase SYNC-1] C.g.position 변경 시 서버로 브로드캐스트
function makeConductor() {
  C = mkActor("conductor", "승무원", {
    npc: true,
    label: "승무원",
    shirt: 0x1c3a6b,
    hair: 0x222222,
    skin: 0xf1c79e,
    pants: 0x1c1c2a,
    cap: true,
  });
  C.g.visible = false;
  C.active = false;
  C.timer = 25;
  C.dir = -1;
  C.speed = 0.9;
  C.mode = "walk";
  C.pause = 0;
}

// ── 승무원 스케줄 (매 프레임 호출) ────────────────────
// 등장 → 통로 이동 → 플레이어 옆 멈춤 → 검표 → 퇴장 → 재등장
// [Supabase SYNC-1] 위치·mode 변경을 서버 채널에 emit
// [Supabase SYNC-2] 검표 시작(C.mode='ask') 시점에 서버가 타이머 시작
function conductorTick(dt) {
  // 아직 등장 전: 대기 시간이 끝나면 한쪽 문에서 등장
  if (!C.active) {
    if ((C.timer -= dt) > 0) return;
    C.active = true;
    C.g.visible = true;
    C.g.position.set(-C.dir * 7.7, 0, 0);
    C.path = [{ x: C.dir * 7.7, z: 0 }];
    C.checked = false;
    C.mode = "walk";
    C.pause = 0;
    speak(C, "승차권 검사 시간입니다~", 4);
    return;
  }
  // 팝업 대기 중: 승무원 멈춤 (플레이어 응답 or 타이머 종료 대기)
  // [향후] C.mode='popup' 구간에 5초 카운트다운 UI + '제출' 버튼 표시
  // [Supabase SYNC-2] 타이머는 서버 기준, 클라이언트는 UI만 표시
  if (C.mode === "popup") {
    animate(C, false, dt);
    return;
  }
  // 짧은 멈춤(검표 직전/인사 중): 멈춤이 끝나면 팝업 열기
  if (C.pause > 0) {
    C.pause -= dt;
    animate(C, false, dt);
    if (C.pause <= 0 && C.mode === "ask") {
      C.mode = "popup";
      openTicket();
    }
    return;
  }
  const m = stepPath(C, dt);
  animate(C, m, dt);
  // 플레이어와 같은 x 라인에서 만나면 검표 시작
  // hide 상태이거나 이미 퇴장 카운트 중이면 건너뜀
  if (
    !C.checked &&
    !GameState.kick &&
    P.state !== "hide" &&
    Math.abs(C.g.position.x - P.g.position.x) < 0.9
  ) {
    C.checked = true;
    C.mode = "ask";
    C.pause = 1.5;
    GameState.inspecting = true;
    P.path = [];
    cancelRes(P);
    Object.keys(keys).forEach((k) => (keys[k] = false));
    speak(C, "표 검사하겠습니다.", 3);
    return;
  }
  // 반대편 끝에 도착하면 퇴장하고 다음 등장까지 대기(방향 반전)
  if (!C.path.length) {
    C.active = false;
    C.g.visible = false;
    C.timer = INSPECT_GAP;
    C.dir *= -1;
  }
}

// ── 좌석 상태 판별 ────────────────────────────────────
// 검표 결과 분기에 사용. showTicket() 내부에서만 호출.
// own_seat   : 본인 지정석 착석 → 정상 통과
// other_seat : 타인 지정석 임시 착석 → 번호 안내 후 통과
// free_seat  : 자유석 착석 → 정상 통과
// standing   : 통로 대기 → 번호 안내 + 화살표
// free_rider : 무임승차 → 강제 퇴장
function getPlayerSeatState() {
  if (!GameState.hasTicket) return "free_rider";
  if (P.state !== "sit" || !P.seat) return "standing";
  if (P.seat.seatType === "free") return "free_seat";
  if (GameState.ticket && P.seat.id === GameState.ticket.seatId)
    return "own_seat";
  return "other_seat";
}

// ── 검표 팝업 열기 ─────────────────────────────────────
// 5초 카운트다운 + '승차권 제출하기' 버튼 표시.
// 버튼 클릭 or 5초 경과 → processTicketCheck() 자동 호출.
// 버튼을 누르지 않아도 hasTicket 기준으로 판정 (버튼은 UX용).
//
// [Supabase SYNC-2/4] 멀티플레이에서는 타이머를 서버가 소유.
//   서버가 "검표 시작" 이벤트를 emit → 클라이언트는 UI만 표시.
//   타이머 만료도 서버 기준 → 클라이언트는 서버 "판정 완료" 이벤트 수신 후 처리.
function openTicket() {
  _clearInspectTimer();

  // ---- UI 구성 ----
  const list = $("tkList");
  list.innerHTML = "";

  // 카운트다운 숫자 (즉시 "5초" 표시)
  _inspectCountEl = document.createElement("p");
  _inspectCountEl.style.cssText =
    "font-size:22px;font-weight:700;color:var(--red);margin:4px 0 2px;";
  _inspectCountEl.textContent = "5초 안에 제출해 주세요";
  list.appendChild(_inspectCountEl);

  // 자동 확인 안내 문구
  const autoNote = document.createElement("p");
  autoNote.style.cssText = "font-size:12px;color:var(--sub);margin:0 0 4px;";
  autoNote.textContent = "5초 내 무응답시 자동으로 확인됩니다";
  list.appendChild(autoNote);

  // 타인 지정석 임시 착석 중이면 추가 힌트
  if (GameState.hasTicket && getPlayerSeatState() === "other_seat") {
    const hint = document.createElement("p");
    hint.style.cssText = "font-size:12px;color:var(--sub);margin:4px 0 0;";
    hint.textContent = "(현재 다른 승객의 지정석에 착석 중)";
    list.appendChild(hint);
  }

  $("tkShow").textContent = "승차권 제출하기";
  $("tkShow").disabled = false;
  $("tkNone").hidden = true;
  $("tkModal").hidden = false;

  // ---- 카운트다운 (1초마다 갱신) ----
  // remaining=4부터 시작 → 1초 뒤 "4초", …, 4초 뒤 "1초", 5초 뒤 자동 판정
  // setTimeout 하나로만 최종 트리거 → setInterval/setTimeout 경쟁 조건 없음
  let remaining = 4;
  _inspectInterval = setInterval(() => {
    if (remaining > 0) {
      if (_inspectCountEl)
        _inspectCountEl.textContent = `${remaining}초 안에 제출해 주세요.`;
      remaining--;
    } else {
      // 카운트다운 종료: 인터벌 자체를 정리하고 단일 타이머로 최종 판정
      clearInterval(_inspectInterval);
      _inspectInterval = null;
      if (_inspectCountEl) _inspectCountEl.textContent = "자동 확인 중...";
      _inspectTimer = setTimeout(() => {
        _inspectTimer = null;
        if (!GameState.ended) processTicketCheck();
      }, 600); // "자동 확인 중..." 잠깐 보여주고 판정
    }
  }, 1000);
}

// 타이머와 카운트다운 인터벌을 모두 정리하는 내부 헬퍼
function _clearInspectTimer() {
  if (_inspectTimer) {
    clearTimeout(_inspectTimer);
    _inspectTimer = null;
  }
  if (_inspectInterval) {
    clearInterval(_inspectInterval);
    _inspectInterval = null;
  }
}

// ── 승차권 보유 여부 자동 판정 ─────────────────────────
// 버튼 클릭 or 타이머 만료 시 호출.
// hasTicket 기준으로 결과 결정 — 버튼 클릭 여부는 결과에 영향 없음.
//
// [Supabase SYNC-3] 멀티플레이에서는 서버 판정 결과(pass/fail)를 수신한 뒤 호출.
//   클라이언트가 각자 판정하면 서버 상태와 불일치 발생.
function processTicketCheck() {
  _clearInspectTimer();
  if (GameState.ended) return;

  // 버튼·UI 원상 복구 (다음 검표를 위해)
  $("tkNone").hidden = false;
  $("tkShow").textContent = "보여주기";
  $("tkShow").disabled = true;
  _inspectCountEl = null;

  if (GameState.hasTicket) {
    showTicket(); // 정상 처리 — 좌석 상태별 분기 (이하 기존 로직)
  } else {
    noTicket(); // 무임승차 — 강제 퇴장 흐름 (기존 로직)
  }
}

// ── 승차권 확인 완료 처리 ──────────────────────────────
// '보여주기' 클릭 시 호출. 좌석 상태별로 다른 연출.
//
// [향후 교체 예정]
// showTicket() → processTicketResult(passed: boolean) 으로 변경:
//   passed=true  → 현재 showTicket() 로직과 동일
//   passed=false → 현재 noTicket() 로직과 동일
//   버튼 클릭 여부가 아니라 passed 값으로 분기
// [Supabase SYNC-3] 서버가 판정한 결과(passed)를 수신 후 호출
// [Supabase SYNC-5] speak(C, ...) 결과를 같은 객차 전체에 브로드캐스트
function showTicket() {
  $("tkModal").hidden = true;
  GameState.inspecting = false;
  C.mode = "walk";
  C.pause = 1.5;

  const state = getPlayerSeatState();

  if (state === "own_seat") {
    // 정상 통과: 본인 지정석 확인
    speak(C, "확인했습니다. 편안한 여행 되세요!", 4);
    _maybeGreet();
  } else if (state === "other_seat") {
    // 타인 지정석 임시 착석: 번호 안내 후 선택 모달
    // 승무원이 약 4초 머물다 이동 → "잠깐 기다렸다 간다"는 뉘앙스
    C.pause = 4;
    const n = GameState.ticket ? GameState.ticket.displayNum : "?";
    speak(C, `지정석은 ${n}번입니다. 안내해 드릴까요?`, 5);
    setTimeout(() => {
      if (!GameState.ended && P.state === "sit") {
        $("seatGuideNum").textContent = `${n}번`;
        $("seatGuideModal").hidden = false;
        // 3초 후 자동 닫힘 (응답 없을 경우)
        setTimeout(() => {
          $("seatGuideModal").hidden = true;
        }, 3000);
      }
    }, 1600);
  } else if (state === "free_seat") {
    // 자유석: 정상 통과
    speak(C, "확인했습니다. 좋은 여행 되세요!", 4);
  } else if (state === "standing") {
    // 통로 대기: 지정석 번호 안내 + 황금 경로 점선 + 자동 이동
    if (GameState.ticket) {
      speak(
        C,
        `${GameState.ticket.displayNum}번 지정석으로 안내해 드릴게요.`,
        4,
      );
      setTimeout(() => {
        if (!GameState.ended) startSeatGuidance();
      }, 1500);
    } else {
      speak(C, "확인했습니다. 좋은 여행 되세요!", 4);
    }
  } else {
    speak(C, "확인했습니다. 좋은 여행 되세요!", 4);
  }
}

// 가끔(45% 확률, 90초 쿨다운) 짧은 인사 대사 추가
// own_seat 정상 통과 직후에만 호출
function _maybeGreet() {
  const now = performance.now();
  if (now - _lastGreetedAt < 90000) return;
  if (Math.random() > 0.45) return;
  _lastGreetedAt = now;
  setTimeout(() => {
    if (!GameState.ended) speak(C, pick(CONDUCTOR_GREETINGS), 4);
  }, 2800);
}

// ── 지정석 안내 모달 ───────────────────────────────────
// other_seat 케이스에서 1.6초 후 표시되는 선택 팝업 처리
// [Supabase SYNC-4] 이 UI는 검표 대상자에게만 표시. 타 승객에겐 렌더 안 함.

// '자리 안내받기': 황금 점선 경로 + 자동 이동
function acceptSeatGuide() {
  $("seatGuideModal").hidden = true;
  startSeatGuidance(); // ticket.js — 황금 경로 점선 + 자동 이동
  if (GameState.ticket)
    toast(`${GameState.ticket.displayNum}번 지정석으로 안내해 드릴게요.`);
}

// '괜찮습니다': 모달 닫기만 (강제 이동 없음)
function declineSeatGuide() {
  $("seatGuideModal").hidden = true;
}

// ── 무임승차 처리 ──────────────────────────────────────
// '표 없음' 클릭 or 향후 타이머 만료 후 hasTicket=false 판정 시 호출
// [향후] noTicket()은 processTicketResult(false) 로 흡수 예정
// [Supabase SYNC-3/5] 서버 판정 결과 수신 후 kick 이벤트 브로드캐스트
function noTicket() {
  $("tkModal").hidden = true;
  speak(C, "승차권이 없으시군요. 5초 후 하차 조치됩니다.", 5);
  C.mode = "walk";
  C.pause = 8;
  GameState.kick = { t: 5 };
  $("kickN").textContent = "5";
  $("kick").hidden = false;
}

// 매 프레임: 강제 퇴장 카운트다운 표시, 0이 되면 접속 종료
function kickTick(dt) {
  if (!GameState.kick) return;
  GameState.kick.t -= dt;
  $("kickN").textContent = Math.max(1, Math.ceil(GameState.kick.t));
  if (GameState.kick.t <= 0) endGame();
}

// ── 접속 종료 ──────────────────────────────────────────
// 렌더·소리를 멈추고 종료 화면 표시 (버튼으로 처음 화면 복귀)
// ticket=null + saveNow() 로 다음 접속 시 새 좌석 배정
function endGame() {
  GameState.ticket = null;
  clearSeatArrow();
  clearSeatGuidance(); // 황금 경로 점선도 정리
  saveNow(); // GameState.ended 설정 전에 호출해야 saveNow()가 동작함
  GameState.ended = true;
  GameState.kick = null;
  $("kick").hidden = true;
  clearInterval(RailSound.timer);
  if (RailSound.master) RailSound.master.gain.value = 0;
  if (RailSound.audio) RailSound.audio.pause();
  $("endScr").hidden = false;
}
