/* =====================================================
   11. 간식 판매원 (vendor.js) — 가상 구매만, 실제 결제 없음
   일정 간격으로 출입문에서 등장 → 통로 이동(중간중간 멈춤) → 반대편 퇴장 → 재등장.
   가까이 가서 [말걸기]를 눌러야 간식 메뉴가 열립니다.
   ===================================================== */

const VENDOR_GAP = 25; // 판매원이 다시 등장하는 간격(초)
// 간식 메뉴: [이름, 가격(원), 이모지]
const MENU = [['삶은 계란', 1500, '🥚'], ['사이다', 1500, '🥤'], ['과자', 1800, '🍪'], ['커피', 2000, '☕'], ['도시락', 5500, '🍱']];

// 간식 판매원과 카트(바퀴 포함) 생성. 처음엔 숨겨 두고 vendorTick이 등장시킴
function makeVendor() {
  V = mkActor('vendor', '판매원', { npc: true, label: '간식 판매원', shirt: 0xff8a3d, hair: 0x333333, skin: 0xf1c79e, pants: 0x3b3b4a });
  const c = new THREE.Group(); c.position.set(0, 0, 0.8); V.wheels = [];
  box(c, 0.8, 0.45, 0.55, 0xc9d6e2, 0, 0.5, 0); box(c, 0.84, 0.05, 0.6, 0xe8553d, 0, 0.76, 0); box(c, 0.7, 0.04, 0.04, 0x333333, 0, 0.9, -0.28); // 카트 몸체/윗판/손잡이
  [[-0.2, 0xf4efe3], [0, 0xf2b632], [0.2, 0x8fbf6a]].forEach(([x, col]) => box(c, 0.16, 0.14, 0.2, col, x, 0.86, 0)); // 윗판 위 간식 상자
  // 바퀴 2개(이동 중 회전)
  for (const sx of [-0.38, 0.38]) {
    const w = new THREE.Group(); w.position.set(sx, 0.14, 0);
    const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), mat(0x333333)); cy.rotation.z = Math.PI / 2; w.add(cy); c.add(w); V.wheels.push(w);
  }
  V.g.add(c); V.g.visible = false; V.active = false; V.timer = 6; V.dir = 1; V.speed = 0.8;
}

// 판매원 스케줄(매 프레임): 일정 간격으로 출입문 등장 → 통로 이동 → 반대편 퇴장 → 재등장
// 이동 중 중간중간 잠깐 멈추고 '필요한 거 있으신가요?' 말풍선
function vendorTick(dt) {
  // 아직 등장 전: 대기 시간이 끝나면 등장
  if (!V.active) {
    if ((V.timer -= dt) > 0) return;
    V.active = true; V.g.visible = true; V.g.position.set(-V.dir * 7.7, 0, 0);
    V.path = [{ x: V.dir * 7.7, z: 0 }]; V.pause = 0; V.nextStop = rnd(4, 6); speak(V, '간식 있어요~! 🛒', 4); V.say = rnd(8, 14); return;
  }
  // 멈춤 타이머: 멈춰 있는 동안엔 이동/바퀴 정지, 멈추는 순간 말풍선
  if (V.pause > 0) V.pause -= dt;
  else if ((V.nextStop -= dt) <= 0) { V.pause = rnd(2.5, 4); V.nextStop = rnd(5, 8); speak(V, '필요한 거 있으신가요?', V.pause); }
  const m = V.pause > 0 ? false : stepPath(V, dt); animate(V, m, dt);
  const u = V.g.userData; u.aL.rotation.x = u.aR.rotation.x = -1.2; // 카트 손잡이를 잡음
  if (m) V.wheels.forEach(w => w.rotation.x += dt * 5);
  if (V.pause <= 0 && (V.say -= dt) <= 0) { V.say = rnd(8, 14); speak(V, '삶은 계란, 사이다 있어요!', 3); }
  // 반대편 끝에 도착하면 퇴장하고 다음 등장까지 대기(방향 반전)
  if (!V.path.length) { V.active = false; V.g.visible = false; V.timer = VENDOR_GAP; V.dir *= -1; }
}

// 플레이어와 판매원 거리가 2.2 이내인지(가까이 가서 말을 걸 수 있는 거리)
const nearVendor = () => V.active && Math.hypot(V.g.position.x - P.g.position.x, V.g.position.z - P.g.position.z) < 2.2;

// 판매원 가까이 가서 [말걸기]를 눌러야(또는 가까이서 판매원을 눌러야) 간식 메뉴가 열림
function openShop() {
  if (GameState.inspecting) return;
  if (!nearVendor()) return toast('판매원 가까이 가서 [말걸기] 버튼을 눌러야 간식을 살 수 있어요.');
  speak(P, '간식 주세요!', 2.5); speak(V, '어서오세요! 뭐 드릴까요?', 3); V.pause = Math.max(V.pause, 3); panel('menu');
}

// 매 프레임: 판매원이 가까운지에 따라 [말걸기] 버튼 활성/비활성
function updateShop() {
  const n = nearVendor(); $('bShop').disabled = !n;
  if (!n) $('menu').hidden = true; else if (!$('menu').hidden) V.pause = Math.max(V.pause, 1); // 메뉴를 보는 동안 판매원이 기다림
}
