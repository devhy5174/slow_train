/* =====================================================
   기차멍 모드 (trainview.js)
   앉은 상태 + 헤드셋 착용 → "기차멍" 버튼 클릭 → 창가 고정 시점 전환
   "돌아가기" 버튼 → 원래 시점 복원
   ===================================================== */

const TrainView = {
  active: false,
  targetPos: null,   // 목표 카메라 위치 (THREE.Vector3)
  targetLook: null,  // 목표 카메라 타겟 (THREE.Vector3)
  savedPos: null,    // 진입 전 카메라 위치 (복원용)
};

// 기차멍 진입: 창가 고정 시점으로 전환. 착석 상태일 때만 허용. 성공 시 true 반환
function enterTrainView() {
  if (!P || P.state !== 'sit' || !P.seat || TrainView.active) return false;

  const px = P.g.position.x;
  const pz = P.g.position.z;
  const side = Math.sign(pz); // -1(왼쪽 창가) / +1(오른쪽 창가)

  // 현재 카메라 위치 저장 (복원용)
  TrainView.savedPos = cam.position.clone();

  // 목표: 캐릭터 앞쪽(+x)에서 약간 통로 방향으로 비스듬히 — 정면+창문이 함께 보이는 각도
  TrainView.targetPos  = new THREE.Vector3(px + 1.2, 1.5, -side * 0.2);
  TrainView.targetLook = new THREE.Vector3(px - 0.3, 0.75, side * 1.7);

  TrainView.active = true;

  // OrbitControls 완전 비활성화 (드래그·줌·댐핑 모두 차단)
  if (ctl) ctl.enabled = false;

  // UI: 모든 메뉴 숨김, 기차멍 오버레이 표시
  document.querySelector('.bar').hidden = true;
  document.querySelector('.hud').hidden = true;
  document.querySelector('.sound-group').hidden = true;
  $('trainViewOverlay').hidden = false;

  return true;
}

// 기차멍 종료: 카메라·컨트롤 복원
function exitTrainView() {
  if (!TrainView.active) return;
  TrainView.active = false;

  // ctl target을 현재 플레이어 위치로 복원 (follow 코드와 충돌 방지)
  if (ctl) {
    ctl.target.set(P.g.position.x, 0.6, P.g.position.z);
    ctl.enabled = true;
  }
  // 카메라를 진입 전 저장된 위치로 복원
  if (TrainView.savedPos) cam.position.copy(TrainView.savedPos);

  // UI 복원
  document.querySelector('.bar').hidden = false;
  document.querySelector('.hud').hidden = false;
  document.querySelector('.sound-group').hidden = false;
  $('trainViewOverlay').hidden = true;
}

// "기차멍" / "돌아가기" 버튼 연결 (buildUI에서 호출됨)
function initTrainViewUI() {
  const enter = $('bTrainView');
  if (enter) enter.onclick = enterTrainView;
  const exit = $('bExitTrainView');
  if (exit) exit.onclick = exitTrainView;
}
