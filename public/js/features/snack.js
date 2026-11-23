/* =====================================================
   8. 손에 든 간식 (snack.js)
   판매원에게서 산 간식(가상 구매)을 오른손에 쥐여 주고, 40초 뒤 자동으로 없앱니다.
   ===================================================== */

// 간식 이름별 작은 3D 모델(간단한 도형). 오른손 좌표계 기준으로 만들어 세워서 보이게 함
function makeSnack(name) {
  const g = new THREE.Group(), cy = (r, h, c) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(c)); // 원기둥 헬퍼
  if (name === '삶은 계란') {
    // 흰자 계란 몸통
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), mat(0xfdf7ea));
    e.scale.set(0.82, 1.12, 0.82); g.add(e);
    // 노른자 (위쪽에 살짝 보임)
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mat(0xf5c030));
    y.position.set(0, 0.068, 0.038); g.add(y);
    // 껍질 조각 하나 (귀여운 포인트)
    box(g, 0.03, 0.025, 0.012, 0xf0dfc0, 0.038, -0.038, 0.058, false);
  }
  else if (name === '사이다') {
    // 초록 캔 몸통 (칠성사이다 느낌)
    const can = cy(0.044, 0.19, 0x3cb96a); can.position.y = 0.005; g.add(can);
    // 흰 라벨 띠
    const lbl = cy(0.046, 0.075, 0xffffff); lbl.position.y = 0.005; g.add(lbl);
    // 은색 상단 뚜껑
    const lid = cy(0.043, 0.018, 0xc8d4d8); lid.position.y = 0.104; g.add(lid);
    // 뚜껑 탭 (납작한 작은 사각형)
    box(g, 0.028, 0.008, 0.022, 0xa8b8be, 0.012, 0.115, 0, false);
    // 하단 테두리
    const bot = cy(0.043, 0.012, 0xc8d4d8); bot.position.y = -0.089; g.add(bot);
  }
  else if (name === '과자') {
    // 노란 과자봉지 몸통
    box(g, 0.14, 0.21, 0.055, 0xf2b632, 0, 0, 0, false);
    // 가운데 볼록한 부분 (내용물)
    box(g, 0.12, 0.13, 0.065, 0xf5c430, 0, 0, 0, false);
    // 상단 실링 (빨강)
    box(g, 0.13, 0.026, 0.058, 0xe8553d, 0,  0.118, 0, false);
    // 하단 실링
    box(g, 0.13, 0.026, 0.058, 0xe8553d, 0, -0.118, 0, false);
    // 라벨 흰 선 (귀여운 디테일)
    box(g, 0.11, 0.008, 0.066, 0xfff8e0, 0, 0.03, 0, false);
    // 봉지 앞면 🍪 이모티콘
    const ec = document.createElement('canvas'); ec.width = 128; ec.height = 160;
    const ex = ec.getContext('2d'); ex.font = '100px serif';
    ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText('🍪', 64, 80);
    const ep = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ec), transparent: true, depthWrite: false }));
    ep.position.set(0, -0.01, 0.034); g.add(ep);
  }
  else if (name === '커피') {
    // 종이컵 몸통 (약간 위가 넓은 테이퍼 형태 근사)
    const cup = cy(0.048, 0.12, 0xf4efe3); cup.position.y = 0.0; g.add(cup);
    // 커피 슬리브 (갈색 종이 띠)
    const slv = cy(0.051, 0.058, 0x8b5e3c); slv.position.y = -0.012; g.add(slv);
    // 슬리브 위아래 테두리선
    box(g, 0.108, 0.006, 0.108, 0x6a4228, 0,  0.019, 0, false);
    box(g, 0.108, 0.006, 0.108, 0x6a4228, 0, -0.043, 0, false);
    // 검정 뚜껑
    const lid = cy(0.051, 0.018, 0x1c1c1c); lid.position.y = 0.069; g.add(lid);
    // 뚜껑 음료구멍 (작은 타원 돌출)
    box(g, 0.022, 0.008, 0.016, 0x0a0a0a, 0.018, 0.079, 0, false);
  }
  else if (name === '쫀드기') {
    // 길쭉한 주황색 쫀드기 봉지
    box(g, 0.07, 0.24, 0.025, 0xf47c20, 0, 0, 0, false);        // 봉지 몸체 (주황)
    box(g, 0.07, 0.03,  0.027, 0xd45a08, 0,  0.115, 0, false);  // 상단 열접착 실링 (짙은 주황)
    box(g, 0.07, 0.03,  0.027, 0xd45a08, 0, -0.115, 0, false);  // 하단 열접착 실링
    box(g, 0.065, 0.10, 0.028, 0xffa040, 0, 0, 0, false);        // 가운데 볼록한 내용물 영역 (밝은 주황)
    box(g, 0.063, 0.01, 0.029, 0xffe0a0, 0, 0.02, 0, false);     // 라벨 하이라이트 선
  }
  else if (name === '말린오징어') {
    // 투명 비닐 봉지
    const bm = new THREE.MeshLambertMaterial({ color: 0xc8dff0, transparent: true, opacity: 0.28 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.022), bm); g.add(bag);
    box(g, 0.16, 0.022, 0.024, 0x90b8cc, 0,  0.11, 0, false); // 상단 실링
    box(g, 0.16, 0.022, 0.024, 0x90b8cc, 0, -0.11, 0, false); // 하단 실링
    // 납작한 오징어 몸통
    box(g, 0.11, 0.08, 0.012, 0xd4a060, 0, 0.03, 0, false);
    // 오징어 다리 5개
    [-0.04, -0.02, 0, 0.02, 0.04].forEach(x => box(g, 0.016, 0.075, 0.011, 0xb88040, x, -0.055, 0, false));
    // 봉지 앞면 🦑 이모티콘
    // 봉지 앞면 🦑 이모티콘 (봉지 가득)
    const ec = document.createElement('canvas'); ec.width = 128; ec.height = 160;
    const ex = ec.getContext('2d'); ex.font = '110px serif';
    ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText('🦑', 64, 80);
    const ep = new THREE.Mesh(new THREE.PlaneGeometry(0.148, 0.185),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ec), transparent: true, depthWrite: false }));
    ep.position.set(0, 0.01, 0.013); g.add(ep);
  }
  else if (name === '소시지') {
    // 나무 막대 (손 아래로 쭉 뻗음)
    const stk = cy(0.012, 0.20, 0xc8a060); stk.position.y = -0.07; g.add(stk);
    // 빨간 소시지 몸통
    const sau = cy(0.055, 0.13, 0xe02828); sau.position.y = 0.07; g.add(sau);
    // 소시지 위아래 끝마감 (살짝 짙은 색)
    const ct = cy(0.054, 0.014, 0xb81c1c); ct.position.y = 0.137; g.add(ct);
    const cb = cy(0.054, 0.014, 0xb81c1c); cb.position.y = 0.004; g.add(cb);
    // 소시지 표면 주름 선 2개
    const w1 = cy(0.057, 0.008, 0xd02222); w1.position.y = 0.055; g.add(w1);
    const w2 = cy(0.057, 0.008, 0xd02222); w2.position.y = 0.095; g.add(w2);
  }
  else if (name === '도시락') {
    box(g, 0.26, 0.06, 0.18, 0xe8553d, 0, 0, 0, false);    // 도시락 용기
    box(g, 0.24, 0.02, 0.16, 0xf4efe3, 0, 0.04, 0, false); // 뚜껑
    // 느린기차 상표 라벨 (뚜껑 위 캔버스 텍스처)
    const lc = document.createElement('canvas'); lc.width = 160; lc.height = 100;
    const lx = lc.getContext('2d');
    lx.fillStyle = '#1d2f4f'; lx.roundRect(2, 2, 156, 96, 10); lx.fill();
    lx.fillStyle = '#f2b632'; lx.font = 'bold 32px sans-serif';
    lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('느린기차', 80, 42);
    lx.fillStyle = '#f4efe3'; lx.font = '18px sans-serif'; lx.fillText('🚂 도시락', 80, 76);
    const lp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.14),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }),
    );
    lp.rotation.x = -Math.PI / 2; lp.position.set(0, 0.052, 0); g.add(lp);
  }
  g.rotation.x = 1.0; // 팔이 앞으로 기울어진 만큼 되돌려 똑바로 보이게
  return g;
}

// 행위자의 오른손에 간식을 쥐여 줌(기존 것은 교체). 40초 뒤 자동으로 사라짐(다 먹음)
function setHeld(a, name) {
  a.heldName = name; // 간식 이름 보존 (멀티 동기화용)
  const arm = a.g.userData.aR; if (a.held) arm.remove(a.held);
  const m = makeSnack(name); m.position.set(0, -0.3, 0.05); arm.add(m); a.held = m; a.heldT = 40;
}

// 매 프레임: 플레이어가 든 간식의 남은 시간 계산, 끝나면 제거
function heldTick(dt) {
  $('bDrop').hidden = !P.held; // 들고 있을 때만 '간식 버리기' 버튼 표시
  if (P.held && (P.heldT -= dt) <= 0) { P.g.userData.aR.remove(P.held); P.held = null; toast('다 먹었어요 😋'); }
}

// '간식 버리기' 버튼: 손에 든 간식을 바로 없앰
function dropHeld() {
  if (!P.held) return;
  P.g.userData.aR.remove(P.held); P.held = null; toast('간식을 버렸어요.');
}
