/* =====================================================
   11. 간식 판매원 (vendor.js) — 가상 구매만, 실제 결제 없음
   일정 간격으로 출입문에서 등장 → 통로 이동(중간중간 멈춤) → 반대편 퇴장 → 재등장.
   가까이 가서 [말걸기]를 눌러야 간식 메뉴가 열립니다.
   ===================================================== */

const VENDOR_GAP = 25; // 판매원이 다시 등장하는 간격(초)
// 간식 메뉴: [이름, 가격(원), 이모지]
const MENU = [['삶은 계란', 1500, '🥚'], ['사이다', 1500, '🥤'], ['과자', 1800, '🍪'], ['커피', 2000, '☕'], ['도시락', 5500, '🍱'], ['쫀드기', 1000, '🍬'], ['말린오징어', 3000, '🦑'], ['소시지', 2000, '🌭']];

// 간식 판매원과 카트(바퀴 포함) 생성. 처음엔 숨겨 두고 vendorTick이 등장시킴
function makeVendor() {
  V = mkActor('vendor', '판매원', { npc: true, label: '간식 판매원', shirt: 0x1a1a2e, hair: 0x2a1a0e, skin: 0xf1c79e, pants: 0x1a1a2e, avatarType: 'vendor' });
  const c = new THREE.Group(); c.position.set(0, 0, 0.8); V.wheels = [];

  const FR = 0x151515; // 프레임 색(거의 검정)
  const W = 0.70, D = 1.16, TH = 0.022; // 카트 폭·깊이·프레임 두께 (깊이를 앞으로 길게)

  // 모서리 기둥 4개
  for (const [sx, sz] of [[-1,1],[1,1],[-1,-1],[1,-1]])
    box(c, TH, 1.04, TH, FR, sx*(W/2-TH/2), 0.52, sz*(D/2-TH/2));

  // 3단 선반 (y = 아래쪽부터 0.13 / 0.43 / 0.73)
  const SY = [0.13, 0.43, 0.73];
  const IH = 0.27; // 선반 내부 높이
  SY.forEach(sy => {
    box(c, W-TH*2, TH, D-TH*2, 0x222222, 0, sy, 0); // 선반 바닥판
    // 앞·뒤 철망: 수직 바 3개 + 상단 가로 레일
    for (const sz of [-(D/2-TH*1.5), D/2-TH*1.5]) {
      for (const bx of [-(W/2-0.10), 0, W/2-0.10])
        box(c, TH*0.8, IH, TH*0.8, FR, bx, sy+IH/2+TH/2, sz);
      box(c, W-TH*2, TH*0.9, TH*0.9, FR, 0, sy+IH+TH/2, sz);
    }
    // 좌·우 측면: 깊이 방향 수직 바 5개 + 가로 레일
    for (const sx of [-(W/2-TH*1.5), W/2-TH*1.5]) {
      for (const bz of [-(D/2-0.10), -(D/2-0.10)+D*0.25, 0, (D/2-0.10)-D*0.25, D/2-0.10])
        box(c, TH*0.8, IH, TH*0.8, FR, sx, sy+IH/2+TH/2, bz);
      box(c, TH*0.9, TH*0.9, D-TH*2, FR, sx, sy+IH+TH/2, 0);
    }
  });

  // 손잡이 (상단 뒷면)
  box(c, W*0.85, TH*1.5, TH*1.5, FR, 0, 1.01, -(D/2-TH));

  // 바퀴 4개 (이동 중 회전)
  for (const [sx, sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]) {
    const w = new THREE.Group(); w.position.set(sx*(W/2-0.07), 0.07, sz*(D/2-0.07));
    const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), mat(0x111111));
    cy.rotation.z = Math.PI/2; w.add(cy); c.add(w); V.wheels.push(w);
  }

  // 아이템 x 위치 3열, z 위치 5행 (앞으로 2칸 더)
  const IX = [-0.22, 0, 0.22];
  const IZ = [0.44, 0.22, 0, -0.22, -0.44];

  // 맨 아래 선반: 핑크·보라 계열 (캔디류) — 3×5=15개
  const botC = [0xe91e8c,0x9c27b0,0x03a9f4, 0xf06292,0x7c4dff,0x40c4ff, 0xe040fb,0xea80fc,0xce93d8, 0xf48fb1,0xb39ddb,0x80deea, 0xff80ab,0xea80fc,0x82b1ff];
  const botH = [0.17,0.20,0.17, 0.17,0.20,0.17, 0.20,0.17,0.20, 0.17,0.20,0.17, 0.20,0.17,0.20];
  IX.forEach((x,xi) => IZ.forEach((z,zi) => { const i=zi*3+xi; box(c,0.13,botH[i],0.13,botC[i],x,SY[0]+TH+botH[i]/2,z); }));

  // 중간 선반: 원색 (과자·음료) — 3×5=15개
  const midC = [0x4caf50,0xffeb3b,0xf44336, 0xff9800,0x8bc34a,0x2196f3, 0xe91e63,0x00bcd4,0xffc107, 0x76ff03,0xffea00,0xff6d00, 0x69f0ae,0xeeff41,0xff4081];
  const midH = [0.21,0.22,0.21, 0.21,0.21,0.22, 0.22,0.21,0.22, 0.21,0.22,0.21, 0.22,0.21,0.22];
  IX.forEach((x,xi) => IZ.forEach((z,zi) => { const i=zi*3+xi; box(c,0.13,midH[i],0.13,midC[i],x,SY[1]+TH+midH[i]/2,z); }));

  // 맨 위 선반: 갈색·크림 계열 (삶은 계란·컵라면 등) — 3×5=15개
  const topC = [0x8d6e63,0xf5deb3,0xd32f2f, 0xa1887f,0xffe0b2,0xf9a825, 0xef9a9a,0xffcc02,0xbcaaa4, 0x8d6e63,0xf5deb3,0xe57373, 0xd7ccc8,0xffcc80,0xa5d6a7];
  const topH = [0.16,0.18,0.16, 0.16,0.18,0.18, 0.16,0.18,0.16, 0.18,0.16,0.18, 0.16,0.18,0.16];
  IX.forEach((x,xi) => IZ.forEach((z,zi) => { const i=zi*3+xi; box(c,0.12,topH[i],0.12,topC[i],x,SY[2]+TH+topH[i]/2,z); }));

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
