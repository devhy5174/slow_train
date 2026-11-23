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
  const c = new THREE.Group(); c.position.set(0, 0, 0.92); V.wheels = []; // 얼굴 겹침 방지: 0.8→0.92

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

  // 손잡이: 카트 뒷면에서 판매원 쪽으로 뻗어 나오는 U자형
  const HZ = -(D/2 + 0.08); // 카트 뒷면 너머 판매원 방향으로 돌출
  for (const sx of [-(W/2*0.70), W/2*0.70])
    box(c, TH*1.5, 0.20, TH*1.5, FR, sx, 0.72, HZ); // 세로 기둥 2개
  box(c, W*0.70, TH*1.8, TH*1.8, FR, 0, 0.82, HZ);  // 가로 그립 바

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

  // 맨 위 선반: 메뉴 미니어처 8종 랜덤으로 5열×7행=35개 빼곡히
  const TY = SY[2] + TH;
  const msph = (r,col,x,y,z,sx=1,sy=1) => { const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),mat(col)); m.scale.set(sx,sy,sx); m.position.set(x,y,z); c.add(m); };
  const mcyl = (r,h,col,x,y,z) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),mat(col)); m.position.set(x,y,z); c.add(m); };
  const MI = [
    (x,y,z)=>{ msph(0.095,0xfdf7ea,x,y+0.108,z,0.82,1.1); msph(0.026,0xf5c030,x,y+0.185,z+0.062); }, // 삶은 계란
    (x,y,z)=>{ mcyl(0.065,0.270,0x3cb96a,x,y+0.144,z); mcyl(0.068,0.096,0xffffff,x,y+0.144,z); mcyl(0.063,0.022,0xc8d4d8,x,y+0.267,z); }, // 사이다
    (x,y,z)=>{ box(c,0.174,0.274,0.068,0xf2b632,x,y+0.153,z); box(c,0.155,0.060,0.074,0xe8553d,x,y+0.274,z); box(c,0.155,0.060,0.074,0xe8553d,x,y+0.028,z); const ec=document.createElement('canvas'); ec.width=128; ec.height=160; const ex=ec.getContext('2d'); ex.font='100px serif'; ex.textAlign='center'; ex.textBaseline='middle'; ex.fillText('🍪',64,80); const ep=new THREE.Mesh(new THREE.PlaneGeometry(0.155,0.195),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ec),transparent:true,depthWrite:false})); ep.position.set(x,y+0.153,z+0.036); c.add(ep); }, // 과자
    (x,y,z)=>{ mcyl(0.063,0.158,0xf4efe3,x,y+0.087,z); mcyl(0.067,0.070,0x8b5e3c,x,y+0.061,z); mcyl(0.065,0.020,0x1c1c1c,x,y+0.163,z); }, // 커피
    (x,y,z)=>{ box(c,0.190,0.095,0.128,0xe8553d,x,y+0.051,z); box(c,0.174,0.028,0.112,0xf4efe3,x,y+0.093,z); }, // 도시락
    (x,y,z)=>{ box(c,0.088,0.282,0.026,0xf47c20,x,y+0.151,z); box(c,0.088,0.038,0.030,0xd45a08,x,y+0.282,z); box(c,0.088,0.038,0.030,0xd45a08,x,y+0.020,z); }, // 쫀드기
    (x,y,z)=>{ const bm=new THREE.MeshLambertMaterial({color:0xc8dff0,transparent:true,opacity:0.30}); const bg=new THREE.Mesh(new THREE.BoxGeometry(0.168,0.248,0.028),bm); bg.position.set(x,y+0.133,z); c.add(bg); box(c,0.128,0.108,0.018,0xd4a373,x,y+0.115,z); const ec=document.createElement('canvas'); ec.width=128; ec.height=160; const ex=ec.getContext('2d'); ex.font='110px serif'; ex.textAlign='center'; ex.textBaseline='middle'; ex.fillText('🦑',64,80); const ep=new THREE.Mesh(new THREE.PlaneGeometry(0.155,0.230),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ec),transparent:true,depthWrite:false})); ep.position.set(x,y+0.133,z+0.015); c.add(ep); }, // 말린오징어
    (x,y,z)=>{ mcyl(0.013,0.228,0xc8a060,x,y+0.098,z); mcyl(0.067,0.142,0xe02828,x,y+0.157,z); }, // 소시지
  ];
  // 4열(0.17 간격) × 5행(0.19 간격) — 위치 기반 결정론적 배치 (모든 클라이언트 동일)
  const TX5 = [-0.255,-0.085,0.085,0.255];
  const TZ7 = [0.40,0.21,0.02,-0.17,-0.36];
  const Y_OFFS = [0,0.015,0.008,0.022,0.005,0.018,0.011,0.003,0.020,0.013,0.025,0.007,0.016,0.002,0.019,0.010,0.023,0.006,0.014,0.021];
  TX5.forEach((x,xi) => TZ7.forEach((z,zi) => {
    const i = xi*5+zi;
    MI[(xi*7+zi*3) % MI.length](x, TY+Y_OFFS[i], z);
  }));

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
