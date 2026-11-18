/* =====================================================
   캐릭터 아바타 외형 — 일반 / 승무원 / 판매원 모델 빌더
   makeChar(actor.js)에서 avatarType에 따라 호출됩니다.
   머리·머리카락·얼굴 요소만 담당.
   몸통·팔다리·이름표는 makeChar 내부에서 생성합니다.
   HEAD_Y = 1.25 (목 끝 y=1.00 기준, 머리 반지름 0.27 더해 목에 자연스럽게 연결)
   ===================================================== */

const HEAD_Y = 1.13; // 머리 구체 중심 y (목과 살짝 겹치게: 하단 0.86, 목 상단 0.90에서 0.04 겹침)

// 눈 머티리얼 — 연갈색 동그란 점 (찍은 것처럼 얼굴에 밀착)
function _makeEyeDot() {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 32;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#7a5230";
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite: false,
  });
}

// 볼터치 머티리얼 — 연한 복숭아빛 그라디언트 원 (공통 사용)
function _makeBlushMat() {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 48;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 64, 48);
  const gr = ctx.createRadialGradient(32, 24, 0, 32, 24, 28);
  gr.addColorStop(0, "rgba(255, 148, 120, 0.40)");
  gr.addColorStop(1, "rgba(255, 148, 120, 0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 48);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite: false,
  });
}

// ── 일반 얼굴 (동그란 점 눈 + 코 + 살짝 미소 + 볼터치) ──
function _addFace(g) {
  const H = HEAD_Y;
  const eyeMat = _makeEyeDot();
  // 눈
  for (const ex of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.072), eyeMat);
    eye.position.set(ex, H - 0.01, 0.264);
    eye.castShadow = false;
    g.add(eye);
  }
  // 볼터치
  const blushMat = _makeBlushMat();
  for (const ex of [-0.14, 0.14]) {
    const blush = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.09), blushMat);
    blush.position.set(ex, H - 0.05, 0.228);
    blush.castShadow = false;
    g.add(blush);
  }
  // 코
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 8, 6),
    mat(0xc08868),
  );
  nose.position.set(0, H - 0.03, 0.267);
  nose.castShadow = false;
  g.add(nose);
  // 살짝 미소 (반원보다 완만한 호, 가운데 정렬)
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.007, 4, 10, Math.PI * 0.65),
    mat(0x7a3a2a),
  );
  smile.position.set(0, H - 0.066, 0.265);
  smile.rotation.z = Math.PI * 1.175;
  smile.castShadow = false;
  g.add(smile);
}

// ── 활짝 웃는 얼굴 — 승무원·판매원 전용 ──────────────
function _addSmileFace(g) {
  const H = HEAD_Y;
  const eyeColor = mat(0x3a2210);
  // 반달눈
  for (const ex of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.007, 4, 10, Math.PI),
      eyeColor,
    );
    eye.position.set(ex, H - 0.008, 0.263);
    eye.castShadow = false;
    g.add(eye);
  }
  // 볼터치
  const blushMat = _makeBlushMat();
  for (const ex of [-0.14, 0.14]) {
    const blush = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.09), blushMat);
    blush.position.set(ex, H - 0.05, 0.228);
    blush.castShadow = false;
    g.add(blush);
  }
  // 코
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 8, 6),
    mat(0xc08868),
  );
  nose.position.set(0, H - 0.03, 0.267);
  nose.castShadow = false;
  g.add(nose);
  // 활짝 웃는 입
  const bigSmile = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.009, 4, 14, Math.PI),
    mat(0x7a3a2a),
  );
  bigSmile.position.set(0, H - 0.057, 0.264);
  bigSmile.rotation.z = Math.PI;
  bigSmile.castShadow = false;
  g.add(bigSmile);
}

// ── 머리 + 반구 헤어 공통 베이스 ─────────────────────
function _buildHead(g, o) {
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 12),
    mat(o.skin),
  );
  head.position.set(0, HEAD_Y, 0);
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.283, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    mat(o.hair),
  );
  hair.position.set(0, HEAD_Y, -0.01);
  hair.castShadow = true;
  g.add(hair);
}

// ── 일반 승객 아바타 ──────────────────────────────────
function buildAvatar(g, o) {
  _buildHead(g, o);
  _addFace(g);
}

// 명찰 머티리얼 — 아이보리 배경 + 남색 테두리 + 직함 텍스트
function _makeBadgeMat(text) {
  const W = 96,
    H = 46;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#f8f4ee";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1d2f4f";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = "#1d2f4f";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
}

// ── 승무원 아바타 (네이비 정모 + 활짝 웃는 얼굴 + 명찰) ──
function buildConductorAvatar(g, o) {
  _buildHead(g, o);
  _addSmileFace(g);
  // 모자 크라운 (머리 약간 뒤쪽에 위치)
  const hatCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.262, 0.295, 0.18, 16),
    mat(0x1c3a6b),
  );
  hatCrown.position.set(0, HEAD_Y + 0.27, -0.05);
  hatCrown.castShadow = true;
  g.add(hatCrown);
  // 챙 디스크 (전체 둘레 브림)
  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.022, 20),
    mat(0x1c3a6b),
  );
  hatBrim.position.set(0, HEAD_Y + 0.168, -0.05);
  g.add(hatBrim);
  // 금색 밴드
  const hatBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.026, 16),
    mat(0xc8a010),
  );
  hatBand.position.set(0, HEAD_Y + 0.182, -0.05);
  g.add(hatBand);
  // 앞 챙 — 그룹으로 묶어 뒤 직각 + 앞 곡선 처리
  const peakG = new THREE.Group();
  peakG.position.set(0, HEAD_Y + 0.168, 0.35);
  peakG.rotation.x = -0.07;
  g.add(peakG);
  // 앞 챙 형태: 뒤는 직선, 앞 양 모서리는 라운드인 D형 (ExtrudeGeometry)
  // shape XY → Rx(-π/2) → shape y 가 world -z 로 매핑됨
  // shape y=+0.13 → world z=-0.13(모자쪽), shape y=-0.13 → world z=+0.13(앞쪽)
  const _ps = new THREE.Shape();
  const _HW = 0.20, _PD = 0.13, _PR = 0.09;
  _ps.moveTo(-_HW,  _PD);                                       // 뒤-왼쪽 (직각)
  _ps.lineTo( _HW,  _PD);                                       // 뒤-오른쪽
  _ps.lineTo( _HW, -_PD + _PR);
  _ps.quadraticCurveTo( _HW, -_PD,  _HW - _PR, -_PD);         // 앞-오른쪽 라운드
  _ps.lineTo(-_HW + _PR, -_PD);
  _ps.quadraticCurveTo(-_HW, -_PD, -_HW, -_PD + _PR);         // 앞-왼쪽 라운드
  _ps.closePath();
  const _pgeo = new THREE.ExtrudeGeometry(_ps, { depth: 0.022, bevelEnabled: false });
  _pgeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  _pgeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.011, 0)); // 두께 중앙 정렬
  const peakMesh = new THREE.Mesh(_pgeo, mat(0x0d2244));
  peakMesh.castShadow = true;
  peakG.add(peakMesh);
  // 명찰 — 왼쪽 가슴 (몸통 위치, 머리 이동과 무관)
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.096, 0.046),
    _makeBadgeMat("승무원"),
  );
  badge.position.set(-0.1, 0.74, 0.123);
  badge.castShadow = false;
  g.add(badge);
}

// ── 헤드폰 (아이보리 오버이어) — 이어폰 버튼으로 토글 ──
function buildHeadphones(g) {
  const IVR = 0xf5f0e8,
    CSH = 0xe0d8c8;
  const hp = new THREE.Group();
  hp.position.set(0, HEAD_Y, 0); // 머리 중심 기준
  hp.visible = false;

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.295, 0.028, 8, 22, Math.PI),
    mat(IVR),
  );
  band.position.set(0, 0, -0.02);
  hp.add(band);

  const topPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    mat(CSH),
  );
  topPad.scale.set(1.1, 0.48, 1.7);
  topPad.position.set(0, 0.295, -0.01);
  hp.add(topPad);

  for (const sx of [-1, 1]) {
    const ex = sx * 0.308,
      ey = -0.038;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.09, 0.05),
      mat(IVR),
    );
    arm.position.set(sx * 0.298, ey + 0.005, -0.005);
    hp.add(arm);
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.113, 0.113, 0.072, 20),
      mat(IVR),
    );
    cup.rotation.z = Math.PI / 2;
    cup.position.set(ex, ey, 0.015);
    hp.add(cup);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.076, 0.022, 8, 18),
      mat(CSH),
    );
    ring.rotation.y = (-sx * Math.PI) / 2;
    ring.position.set(sx * (0.308 - 0.022), ey, 0.015);
    hp.add(ring);
  }

  g.add(hp);
  return hp;
}

// ── 판매원 아바타 (흰 위생 모자 + 활짝 웃는 얼굴 + 명찰) ─
function buildVendorAvatar(g, o) {
  _buildHead(g, o);
  _addSmileFace(g);
  // 위생모 크라운 (위로 살짝 넓어지는 원통)
  const vhatCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.308, 0.284, 0.22, 16),
    mat(0xf5f0e8),
  );
  vhatCrown.position.set(0, HEAD_Y + 0.29, 0);
  vhatCrown.castShadow = true;
  g.add(vhatCrown);
  // 하단 접힘 밴드 테두리
  const vhatBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.306, 0.298, 0.055, 16),
    mat(0xe8e0d4),
  );
  vhatBand.position.set(0, HEAD_Y + 0.155, 0);
  g.add(vhatBand);
  // 명찰 — 왼쪽 가슴 (몸통 위치, 머리 이동과 무관)
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.096, 0.046),
    _makeBadgeMat("판매원"),
  );
  badge.position.set(-0.1, 0.74, 0.123);
  badge.castShadow = false;
  g.add(badge);
}
