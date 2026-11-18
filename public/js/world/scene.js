/* =====================================================
   4. 장면 (scene.js) — 객차·좌석·창문·창밖 풍경 3D 생성
   모든 모델은 외부 에셋 없이 코드로 만든 도형입니다.
   ===================================================== */

// 색상 상수: 좌석 파랑 / 짙은 남색 / 크림색(벽)
const BLUE = 0x2f62b0,
  NAVY = 0x1c3a6b,
  CREAM = 0xefe4cc;

// 박스 메쉬를 만들어 parent에 추가하는 공용 헬퍼(색·위치·그림자 설정)
function box(parent, w, h, d, color, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// 벤치 그룹 참조 저장 맵 (buildSeatLabels에서 자식 번호판 추가용)
const benchGroups = {};
// 머리받침 메쉬 저장 맵 — 키: `${benchId}:${0|1}` (0=z<0, 1=z>0)
const headrestMeshes = {};

// 2인용 파란 좌석(벤치) 1개 생성 — BENCHES 데이터 기준으로 배치
function bench(b) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.side * 1.6);
  g.rotation.y = b.yaw;
  benchGroups[b.id] = g; // 번호판 추가를 위해 저장
  box(g, 0.62, 0.36, 1.78, NAVY, 0, 0.18, 0); // 좌석 받침
  for (const z of [-0.45, 0.45]) {
    box(g, 0.66, 0.16, 0.84, BLUE, 0.02, 0.44, z); // 방석
    box(g, 0.16, 0.9, 0.84, BLUE, -0.3, 0.95, z).rotation.z = 0.1; // 등받이(살짝 기울임)
    const hr = box(g, 0.18, 0.28, 0.55, 0xf4efe3, -0.36, 1.5, z); // 머리받침 흰 덮개
    headrestMeshes[`${b.id}:${z > 0 ? 1 : 0}`] = hr; // 내 자리 강조용으로 참조 보관
  }
  box(g, 0.5, 0.1, 0.08, NAVY, 0, 0.62, 0); // 두 좌석 사이 팔걸이
  scene.add(g);
}

// 4인석 중앙 테이블 1개 생성(상판+다리+받침)
function table(z) {
  const g = new THREE.Group();
  g.position.set(0, 0, z);
  box(g, 0.9, 0.07, 1.7, 0xb07a45, 0, 0.78, 0); // 상판
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.78, 12),
    mat(0x6b4a2b),
  );
  leg.position.y = 0.39;
  leg.castShadow = true;
  g.add(leg); // 다리
  box(g, 0.5, 0.04, 0.5, 0x6b4a2b, 0, 0.02, 0); // 바닥 받침
  scene.add(g);
}

// ===== 무궁화호 지붕 =====
let trainRoof;

function buildRoof() {
  trainRoof = new THREE.Group();
  scene.add(trainRoof);

  const L     = CAR.L;
  const W     = CAR.W;
  const archR = 10;             // 완만한 아치용 대반지름
  const halfW = W / 2 + 0.22;  // 처마 돌출 너비

  const arcHalf  = Math.asin(halfW / archR);  // 아치 반각도
  const arcAngle = arcHalf * 2;
  const edgeY    = archR * Math.cos(arcHalf); // 엣지에서 원통 중심까지 y 거리

  const eaveY = 2.55;            // 처마 높이 (벽 상단에 맞춤)
  const cylCY = eaveY - edgeY;   // 원통 중심 y

  // 아치형 메인 지붕 (부분 원통, 8분할 저폴리)
  const geo = new THREE.CylinderGeometry(
    archR, archR, L + 0.4,
    8, 1, true,
    Math.PI / 2 - arcHalf, arcAngle,
  );
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const roofMesh = new THREE.Mesh(geo, mat(0xf0ede4));
  roofMesh.position.y = cylCY;
  roofMesh.castShadow = true;
  trainRoof.add(roofMesh);

  // 양끝 아치 단면 마감 (DoubleSide → 안팎 모두 보임)
  const capShape = new THREE.Shape();
  for (let i = 0; i <= 4; i++) {
    const th = (Math.PI / 2 - arcHalf) + (arcAngle * i / 4);
    const py = archR * Math.sin(th);
    const px = -archR * Math.cos(th); // rotation.y=π/2 적용 시 world.z = -px
    if (i === 0) capShape.moveTo(px, py);
    else capShape.lineTo(px, py);
  }
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf0ede4, side: THREE.DoubleSide });
  for (const ex of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.rotation.y = Math.PI / 2;
    cap.position.set(ex * (L / 2 + 0.2), cylCY, 0);
    trainRoof.add(cap);
  }

  trainRoof.visible = false;
}

//지붕 상태를 변경하는 함수
function updateRoof(distance) {
  if (trainRoof) {
    trainRoof.visible = distance > 25;
  }
}

// 객차 한쪽 창가 벽 생성(창문 8개 + 무늬 띠). sg: -1 왼쪽 / +1 오른쪽
// 카메라가 그쪽 바깥에 있으면 game.js 루프에서 숨겨 내부가 보이게 함
function wallSide(sg) {
  const L = CAR.L,
    zw = (sg * CAR.W) / 2,
    pitch = 1.9,
    g = new THREE.Group();
  scene.add(g);
  walls[sg] = g;

  // ===== 무궁화호 외관 =====
  box(g, L, 0.65, 0.035, 0x5b8fc5, 0, 0.42, zw + sg * 0.095);
  box(g, L, 0.07, 0.04, 0xf8f4e9, 0, 0.79, zw + sg * 0.12);
  box(g, L, 0.18, 0.04, 0x315c8e, 0, 0.08, zw + sg * 0.12);
  box(g, L, 0.12, 0.04, 0xf7f0df, 0, 1.96, zw + sg * 0.12);

  // ===== 기존 객차 벽과 창문 =====

  box(g, L, 0.9, 0.15, CREAM, 0, 0.45, zw);

  box(g, L, 0.9, 0.15, CREAM, 0, 0.45, zw);
  box(g, L, 0.7, 0.15, CREAM, 0, 2.25, zw); // 창 아래/위 벽
  for (let i = 0; i < 7; i++)
    box(g, 0.7, 1.0, 0.15, CREAM, (i - 3) * pitch, 1.4, zw); // 창 사이 기둥
  box(g, 0.55, 1.0, 0.15, CREAM, -7.525, 1.4, zw);
  box(g, 0.55, 1.0, 0.15, CREAM, 7.525, 1.4, zw); // 양 끝 기둥
  // 안쪽 벽면의 빨강/노랑 장식 띠
  box(g, L, 0.1, 0.02, 0xe8553d, 0, 0.75, zw - sg * 0.09, false);
  box(g, L, 0.05, 0.02, 0xf2b632, 0, 0.62, zw - sg * 0.09, false);
  // 창문 유리(반투명 흰색) 8장
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 0.02),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    p.position.set((i - 3.5) * pitch, 1.4, zw);
    g.add(p);
  }
}

// 객차 뼈대 생성: 바닥·차체·통로 카펫·양쪽 창가 벽·양 끝 벽과 출입문
function shell() {
  const L = CAR.L,
    W = CAR.W,
    H = CAR.H;
  box(scene, L, 0.2, W, 0xd9b48a, 0, -0.1, 0); // 바닥
  box(scene, L + 0.2, 0.4, W + 0.2, 0x34383f, 0, -0.4, 0); // 차체 하부
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.3), mat(0xa8473a)); // 통로 카펫
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.y = 0.006;
  aisle.receiveShadow = true;
  scene.add(aisle);
  wallSide(-1);
  wallSide(1);
  for (const e of [-1, 1])
    ends[e].push(
      // 양 끝 벽 + 출입문 위 벽
      box(scene, 0.15, H, 1.95, CREAM, (e * L) / 2, H / 2, -1.625),
      box(scene, 0.15, H, 1.95, CREAM, (e * L) / 2, H / 2, 1.625),
      box(scene, 0.15, 0.6, 1.3, CREAM, (e * L) / 2, 2.3, 0),
    );
  buildRoof();
}

// ----- 좌석 번호 레이블 -----
// seatId → Mesh 맵. refreshSeatLabels()에서 황금색 갱신에 사용
const seatLabelMeshes = {};

// 좌석 번호 레이블용 캔버스 머티리얼 생성 (MeshBasicMaterial)
// style: 'reserved'(짙은 남색), 'free'(짙은 초록), 'mine'(황금)
// 투명 배경 + 텍스트만 → 머리받침 아이보리 면에 직접 프린트된 느낌
function makeSeatLabelMat(text, style) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 128, 64);
  if (style === "mine") ctx.fillStyle = "#c8a010";
  else if (style === "free") ctx.fillStyle = "#1a5244";
  else ctx.fillStyle = "#1d2f4f";
  ctx.font = `bold ${style === "free" ? 30 : 40}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 32);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite: false,
  });
}

// 모든 좌석 머리받침 뒷면(-x 면)에 번호 Mesh 를 벤치 자식으로 추가 (buildWorld 에서 호출)
// 벤치 로컬 좌표 기준: 머리받침 중심 (-0.36, 1.5, zLocal), 뒷면 x = -0.45
// rotation.y = +π/2 → 벤치 로컬 +x 방향을 바라봄(머리받침 앞면)
// 텍스트 방향: yaw=0 → 세계 +x, yaw=π → 세계 -x (각각 앞에서 보는 플레이어 기준 정면)
function buildSeatLabels() {
  SEATS.forEach((s) => {
    const benchId = s.id.replace(/-\d+$/, "");
    const g = benchGroups[benchId];
    if (!g) return;
    const zLocal = s.z - g.position.z; // 벤치 그룹 로컬 z 오프셋
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.14),
      makeSeatLabelMat(
        s.seatType === "free" ? "자유" : String(s.displayNum),
        s.seatType === "free" ? "free" : "reserved",
      ),
    );
    // 머리받침 앞면(x=-0.27)에서 2mm 바깥에 부착하여 z-fighting 방지
    plane.position.set(-0.268, 1.5, zLocal);
    plane.rotation.y = Math.PI / 2; // 벤치 로컬 +x 방향을 바라봄(머리받침 앞면)
    plane.userData.isSeatLabel = true;
    plane.raycast = () => {}; // 좌석 클릭 레이캐스트에 간섭 방지
    g.add(plane);
    seatLabelMeshes[s.id] = plane;
  });
}

// 플레이어 지정석 레이블 황금색 + 머리받침 강조색으로 갱신 (assignTicket 후 호출)
function refreshSeatLabels() {
  if (!GameState.ticket) return;
  // 번호 레이블 황금색
  const plane = seatLabelMeshes[GameState.ticket.seatId];
  if (plane) {
    const old = plane.material;
    plane.material = makeSeatLabelMat(
      String(GameState.ticket.displayNum),
      "mine",
    );
    old.map.dispose();
    old.dispose();
  }
  // 머리받침 색상 강조 — 무궁화호 카펫 느낌의 따뜻한 적색
  const s = SEATS.find((seat) => seat.id === GameState.ticket.seatId);
  if (!s) return;
  const benchId = s.id.replace(/-\d+$/, "");
  const g = benchGroups[benchId];
  if (!g) return;
  const zLocal = s.z - g.position.z;
  const hr = headrestMeshes[`${benchId}:${zLocal > 0 ? 1 : 0}`];
  if (hr) hr.material = mat(0xc44433); // 내 자리만 따뜻한 적색
}

// ----- 하부 구조: 대차·바퀴·철로 -----

// 높이 기준: 레일 중심 y=-0.48(높이 0.1 → 윗면 y=-0.43), 바퀴 중심 y=-0.43+0.32=-0.11
// 차체 하부(underframe) 아랫면 y=-0.6 → 보기 그룹 기준점
const _BOGIE_Y = -0.85; // 대차 그룹 월드 y
const _WHEEL_Y_L = 0; // 대차 로컬 y: 바퀴 중심 (-0.11 - (-0.6) = 0.49)
const _WHEEL_R = 0.5; // 바퀴 반경

// 바퀴 rollGroup 배열 — tickWheels 에서 traverse 없이 직접 순회
const _wheelAxles = [];

// 객차 하부에 대차 2개(앞/뒤) 생성. 각 대차에 바퀴 4개씩 부착
function buildBogies() {
  const bogieColor = 0x34383f;
  const wheelColor = 0x2a2a2a;
  const flangeColor = 0x1a1a1a;
  const FRAME_Y = _WHEEL_Y_L + 0.28; // 프레임 중심: 바퀴 중심에서 위쪽

  for (const bx of [-5.0, 5.0]) {
    const bg = new THREE.Group();
    bg.position.set(bx, _BOGIE_Y, 0);
    scene.add(bg);

    // 대차 본체 가로 프레임 (Z 방향으로 양쪽 바퀴를 잇는 보)
    box(bg, 2.2, 0.18, 4.4, bogieColor, 0, FRAME_Y, 0);
    // 좌우 사이드빔 (X 방향 보 — 앞뒤 바퀴 사이)
    for (const bz of [-1.9, 1.9])
      box(bg, 2.2, 0.12, 0.2, bogieColor, 0, FRAME_Y + 0.1, bz);

    // 바퀴 4개: (앞뒤 ±0.85) × (좌우 ±2.0)
    for (const wx of [-0.85, 0.85]) {
      for (const wz of [-2.0, 2.0]) {
        // rollGroup: 위치 담당. rotation.x 갱신으로 굴림 구현
        const rg = new THREE.Group();
        rg.position.set(wx, _WHEEL_Y_L, wz);
        bg.add(rg);
        _wheelAxles.push(rg);

        // 바퀴 본체: CylinderGeometry(Y축) → rotation.z=PI/2로 X축 원통화
        const wh = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R, _WHEEL_R, 0.22, 16),
          mat(wheelColor),
        );
        wh.rotation.x = Math.PI / 2;
        wh.castShadow = true;
        rg.add(wh);

        // 플랜지(레일 이탈 방지 테두리 — 바퀴보다 반경 0.06 더 큼)
        const fl = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R + 0.06, _WHEEL_R + 0.06, 0.1, 16),
          mat(flangeColor),
        );
        fl.rotation.x = Math.PI / 2;
        rg.add(fl);
      }
    }
  }
}

// 철로(레일 2줄 + 침목 + 자갈) — 타일 3개로 무한 루프, SCN 시스템 활용
// PERIOD = 33, 타일 3개 간격 = PERIOD → 가시 범위 항상 커버
function buildTrack() {
  const railColor = 0x8a8a8a;
  const tieColor = 0x5a3e28;
  const ballastColor = 0x9a9080;
  const PITCH = 1.5;
  const COUNT = 22;
  const PERIOD = COUNT * PITCH; // ≈ 33

  // 레일 y=-0.48(중심), 높이 0.1 → 윗면 y=-0.43 (바퀴 중심 계산 기준)
  // 침목 y=-0.59, 높이 0.1 → 윗면 y=-0.54 (레일 아래에 깔림)
  // 자갈면 y=-0.63 (지면과 거의 맞닿음)

  for (let tile = -1; tile <= 1; tile++) {
    const ox = tile * PERIOD; // 타일 초기 x 오프셋

    // 자갈 판 (레일·침목 폭 5.2 커버)
    const ballast = new THREE.Mesh(
      new THREE.PlaneGeometry(PERIOD, 5.2),
      mat(ballastColor),
    );
    ballast.rotation.x = -Math.PI / 2;
    ballast.position.set(ox, -1.49, 0);
    ballast.receiveShadow = true;
    sc(ballast, 1, PERIOD * 3);

    // 레일 2줄: z=±2.0 (바퀴 wz=±2.0 과 일치)
    for (const rz of [-2.0, 2.0]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(PERIOD, 0.1, 0.12),
        mat(railColor),
      );
      rail.position.set(ox, -1.32, rz);
      rail.castShadow = true;
      sc(rail, 1, PERIOD * 3);
    }

    // 침목 (z폭 5.0으로 레일 너머까지)
    for (let i = 0; i < COUNT; i++) {
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.1, 5.0),
        mat(tieColor),
      );
      tie.position.set(ox - PERIOD / 2 + i * PITCH + PITCH / 2, -1.49, 0);
      tie.castShadow = true;
      sc(tie, 1, PERIOD * 3);
    }
  }
}

// 바퀴 굴림 처리 — rollGroup.rotation.x 갱신 (레일 위 굴림 = X축 회전)
// CylinderGeometry를 rotation.z=PI/2로 X축 원통화했으므로 X축 회전이 올바른 굴림
let _wheelAngle = 0;
function tickWheels(dt) {
  _wheelAngle += (TRAIN / _WHEEL_R) * dt;
  for (const rg of _wheelAxles) rg.rotation.z = _wheelAngle;
}

// ----- 창밖 풍경 -----
const TRAIN = 3; // 열차 속도(풍경이 지나가는 속도): 천천히

// 움직이는 풍경 오브젝트 등록 헬퍼. k: 시차(멀수록 느리게), p: 반복 주기
function sc(m, k, p) {
  scene.add(m);
  SCN.push({ m, k, p });
  return m;
}

// 창밖 풍경 생성(언덕·산·논밭·나무·집). game.js update()에서 -x 방향으로 흘러가며 반복
function scenery() {
  const sph = (c) =>
    new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat(c)); // 언덕용 구
  for (const sg of [-1, 1]) {
    // 가까운 언덕
    [-40, -24, -8, 8, 24, 40].forEach((x, i) => {
      const m = sph([0x6fa05a, 0x5d9150, 0x7aad63][i % 3]);
      m.scale.set(8 + (i % 3) * 2, 3 + (i % 2) * 1.2, 6);
      m.position.set(x, -0.62, sg * (22 + (i % 3) * 3));
      sc(m, 0.5, 96);
    });
    // 먼 산(가장 느리게 움직임)
    [-36, -12, 12, 36].forEach((x, i) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(11, 13, 6),
        mat(i % 2 ? 0x7d98ae : 0x8aa3b8),
      );
      m.position.set(x, 5.8, sg * 42);
      sc(m, 0.15, 96);
    });
    // 논밭(두 줄, 색이 번갈아)
    [5.5, 9].forEach((z, row) => {
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(7.8, 2.6),
          mat((i + row) % 2 ? 0xc9c26a : 0xa8c25a),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(-45 + i * 8, -0.6, sg * z);
        sc(m, 1, 96);
      }
    });
    // 나무(줄기 + 잎)
    for (let i = 0; i < 25; i++) {
      const x = -45 + i * 3.6,
        z = sg * (12 + (i % 4) * 2.4);
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8),
        mat(0x6b4a2b),
      );
      t.position.set(x, -0.02, z);
      const c = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 2.2, 8),
        mat(0x3f7d46),
      );
      c.position.set(x, 1.5, z);
      t.castShadow = c.castShadow = true;
      sc(t, 1, 90);
      sc(c, 1, 90);
    }
    // 작은 마을(집 몸체 + 지붕)
    for (let i = 0; i < 4; i++) {
      const x = -36 + i * 24,
        z = sg * (9 + (i % 2) * 1.5);
      const w = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.4, 1.8),
        mat([0xf2e6d0, 0xe8c9a0][i % 2]),
      );
      w.position.set(x, 0.1, z);
      const r = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 1.0, 4),
        mat(0xb5523b),
      );
      r.rotation.y = Math.PI / 4;
      r.position.set(x, 1.3, z);
      w.castShadow = r.castShadow = true;
      sc(w, 1, 96);
      sc(r, 1, 96);
    }
  }
}
