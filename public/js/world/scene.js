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
// 등받이 서브그룹 참조 맵 — 번호 스티커 부착용, 키: `${benchId}:${0|1}`
const seatBrgGroups = {};

// 2인용 파란 좌석(벤치) 1개 생성 — BENCHES 데이터 기준으로 배치
function bench(b) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.side * 1.6);
  g.rotation.y = b.yaw;
  benchGroups[b.id] = g; // 번호판 추가를 위해 저장

  // 받침대 (두 좌석 공통 하부 프레임)
  box(g, 0.62, 0.36, 1.78, NAVY, 0, 0.18, 0);

  const SEAT_HI = 0x3a6abd; // 쿠션 하이라이트 색

  for (const z of [-0.45, 0.45]) {
    // ── 방석 ──
    box(g, 0.63, 0.08, 0.82, NAVY, 0.02, 0.41, z); // 방석 테두리 프레임
    box(g, 0.59, 0.12, 0.78, BLUE, 0.02, 0.44, z); // 방석 메인 패드
    box(g, 0.53, 0.03, 0.68, SEAT_HI, 0.02, 0.51, z); // 쿠션 볼록 하이라이트

    // ── 등받이 (서브그룹으로 한꺼번에 기울임) ──
    const brg = new THREE.Group();
    brg.position.set(-0.3, 0.9, z);
    brg.rotation.z = 0.1;
    g.add(brg);
    box(brg, 0.12, 0.76, 0.8, NAVY, 0, 0, 0); // 뒷 구조 패널
    box(brg, 0.08, 0.72, 0.76, BLUE, 0.03, 0, 0); // 앞 쿠션 패딩
    // 등받이 상단 둥근 에지 (실린더 Z축 방향)
    const tc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.76, 8),
      mat(BLUE),
    );
    tc.rotation.x = Math.PI / 2;
    tc.position.set(0.03, 0.38, 0);
    tc.castShadow = true;
    brg.add(tc);

    // 번호 스티커 부착용으로 등받이 그룹 저장
    seatBrgGroups[`${b.id}:${z > 0 ? 1 : 0}`] = brg;

    // 내 자리 강조 로직용 더미 메쉬 (headrestMeshes 참조만 보관, 쿠션 내부에 숨김)
    const hr = new THREE.Mesh(
      new THREE.BoxGeometry(0.001, 0.001, 0.001),
      mat(0xf4efe3),
    );
    hr.position.set(0, 0.44, z);
    hr.castShadow = false;
    g.add(hr);
    headrestMeshes[`${b.id}:${z > 0 ? 1 : 0}`] = hr;
  }

  // ── 중앙 팔걸이 ──
  box(g, 0.52, 0.1, 0.08, NAVY, 0, 0.6, 0);

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

  const L = CAR.L;
  const W = CAR.W;
  const archR = 10; // 완만한 아치용 대반지름
  const halfW = W / 2 + 0.22; // 처마 돌출 너비

  const arcHalf = Math.asin(halfW / archR); // 아치 반각도
  const arcAngle = arcHalf * 2;
  const edgeY = archR * Math.cos(arcHalf); // 엣지에서 원통 중심까지 y 거리

  const eaveY = 2.55; // 처마 높이 (벽 상단에 맞춤)
  const cylCY = eaveY - edgeY; // 원통 중심 y

  // 아치형 메인 지붕 (부분 원통, 8분할 저폴리)
  const geo = new THREE.CylinderGeometry(
    archR,
    archR,
    L + 0.4,
    8,
    1,
    true,
    Math.PI / 2 - arcHalf,
    arcAngle,
  );
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const roofMesh = new THREE.Mesh(geo, mat(0xf0ede4));
  roofMesh.position.y = cylCY;
  roofMesh.castShadow = true;
  trainRoof.add(roofMesh);

  // 양끝 아치 단면 마감 (DoubleSide → 안팎 모두 보임)
  const capShape = new THREE.Shape();
  for (let i = 0; i <= 4; i++) {
    const th = Math.PI / 2 - arcHalf + (arcAngle * i) / 4;
    const py = archR * Math.sin(th);
    const px = -archR * Math.cos(th); // rotation.y=π/2 적용 시 world.z = -px
    if (i === 0) capShape.moveTo(px, py);
    else capShape.lineTo(px, py);
  }
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xf0ede4,
    side: THREE.DoubleSide,
  });
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
  buildEndWallDecor(); // 끝벽 인테리어 장식
}

// ----- 좌석 번호 레이블 -----
// seatId → Mesh 맵. refreshSeatLabels()에서 황금색 갱신에 사용
const seatLabelMeshes = {};

// 좌석 번호 스티커 머티리얼 생성 (캔버스 텍스처 — 둥근 모서리 배경 + 숫자)
// style: 'reserved'(크림 배경+남색 숫자), 'free'(초록 배경), 'mine'(코랄 레드 배경+흰 숫자)
function makeSeatLabelMat(text, style) {
  const W = 128,
    H = 80;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // 스타일별 배경색·글자색
  const bg =
    style === "mine" ? "#c94c3a" : style === "free" ? "#2a6b4e" : "#dcd7bf"; // 크림
  const fg =
    style === "mine" ? "#ffffff" : style === "free" ? "#c8f0dc" : "#1d2f4f"; // 짙은 남색

  // 둥근 직사각형 배경
  const p = 5,
    r = 14;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(p + r, p);
  ctx.lineTo(W - p - r, p);
  ctx.quadraticCurveTo(W - p, p, W - p, p + r);
  ctx.lineTo(W - p, H - p - r);
  ctx.quadraticCurveTo(W - p, H - p, W - p - r, H - p);
  ctx.lineTo(p + r, H - p);
  ctx.quadraticCurveTo(p, H - p, p, H - p - r);
  ctx.lineTo(p, p + r);
  ctx.quadraticCurveTo(p, p, p + r, p);
  ctx.closePath();
  ctx.fill();

  // 숫자 텍스트
  ctx.fillStyle = fg;
  ctx.font = `bold ${style === "free" ? 26 : 36}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2);

  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite: false,
  });
}

// 등받이 앞면 상단에 번호 스티커 Mesh 를 등받이 서브그룹(brg) 자식으로 추가
// brg 로컬 좌표 기준: 앞 쿠션 패딩 앞면 x≈0.07, 상단부 y=0.26, z=0(중앙)
// rotation.y = +π/2 → brg 로컬 +x 방향(등받이 앞면)을 바라봄
function buildSeatLabels() {
  SEATS.forEach((s) => {
    const benchId = s.id.replace(/-\d+$/, "");
    const g = benchGroups[benchId];
    if (!g) return;
    const zLocal = s.z - g.position.z;
    const sideIdx = zLocal > 0 ? 1 : 0;
    const brg = seatBrgGroups[`${benchId}:${sideIdx}`];
    if (!brg) return;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.15),
      makeSeatLabelMat(
        s.seatType === "free" ? "자유" : String(s.displayNum),
        s.seatType === "free" ? "free" : "reserved",
      ),
    );
    // 등받이 앞 쿠션 앞면(brg 로컬 x≈0.07)에서 1mm 띄워 z-fighting 방지
    // y=0.26: 등받이 상단 근처 (top y=0.38), 캐릭터 착석 시에도 보이는 위치
    plane.position.set(0.076, 0.26, 0);
    plane.rotation.y = Math.PI / 2;
    plane.userData.isSeatLabel = true;
    plane.raycast = () => {};
    brg.add(plane);
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
  const FRAME_Y = _WHEEL_Y_L + 0.28; // 프레임 중심: 바퀴 중심에서 위쪽

  // 바퀴 색상
  const C_DISC = 0x1e1e1e; // 휠 디스크 본체
  const C_SPOKE = 0x363636; // 스포크
  const C_HUB = 0x686868; // 허브 원통
  const C_HUBCAP = 0xb0b0b0; // 허브캡 (밝은 금속)
  const C_FLANGE = 0x0f0f0f; // 플랜지 (레일 접촉 테두리)

  // 바퀴 치수
  const HUB_R = 0.13;
  const RIM_IN = _WHEEL_R - 0.07;
  const SP_MID = (HUB_R + RIM_IN) / 2;
  const SP_LEN = RIM_IN - HUB_R;

  for (const bx of [-5.0, 5.0]) {
    const bg = new THREE.Group();
    bg.position.set(bx, _BOGIE_Y, 0);
    scene.add(bg);

    // 대차 본체 가로 프레임 (Z 방향으로 양쪽 바퀴를 잇는 보)
    box(bg, 2.2, 0.18, 4.4, bogieColor, 0, FRAME_Y, 0);
    // 좌우 사이드빔 (X 방향 보 — 앞뒤 바퀴 사이)
    for (const bz of [-1.9, 1.9])
      box(bg, 2.2, 0.12, 0.2, bogieColor, 0, FRAME_Y + 0.1, bz);

    // 바퀴 4개: (앞뒤 ±0.85) × (좌우 ±2.0) — 스포크 열차 바퀴 디자인
    for (const wx of [-0.85, 0.85]) {
      for (const wz of [-2.0, 2.0]) {
        const rg = new THREE.Group();
        rg.position.set(wx, _WHEEL_Y_L, wz);
        bg.add(rg);
        _wheelAxles.push(rg);

        // 메인 디스크 (어두운 배경 원통)
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R, _WHEEL_R, 0.2, 24),
          mat(C_DISC),
        );
        disc.rotation.x = Math.PI / 2;
        disc.castShadow = true;
        rg.add(disc);

        // 외륜 테두리 토러스 (Three.js TorusGeometry 기본 방향 = XY 평면, 휠 페이스와 일치)
        rg.add(
          new THREE.Mesh(
            new THREE.TorusGeometry(_WHEEL_R - 0.035, 0.07, 6, 24),
            mat(C_DISC),
          ),
        );

        // 스포크 8개 — 허브에서 외륜까지 방사형
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const sp = new THREE.Mesh(
            new THREE.BoxGeometry(0.065, SP_LEN, 0.26),
            mat(C_SPOKE),
          );
          sp.position.set(Math.sin(a) * SP_MID, Math.cos(a) * SP_MID, 0);
          sp.rotation.z = -a;
          rg.add(sp);
        }

        // 허브 원통 (스포크 중심부)
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(HUB_R, HUB_R, 0.3, 12),
          mat(C_HUB),
        );
        hub.rotation.x = Math.PI / 2;
        rg.add(hub);

        // 허브캡 (양쪽 면 돌출하는 밝은 금속 원반)
        for (const cz of [-0.14, 0.14]) {
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10),
            mat(C_HUBCAP),
          );
          cap.rotation.x = Math.PI / 2;
          cap.position.z = cz;
          rg.add(cap);
        }

        // 플랜지 (레일 이탈 방지 내측 테두리)
        const fl = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R + 0.06, _WHEEL_R + 0.06, 0.1, 24),
          mat(C_FLANGE),
        );
        fl.rotation.x = Math.PI / 2;
        rg.add(fl);
      }
    }

    // 커넥팅 로드 — 앞뒤 바퀴를 잇는 측면 연결봉 (실제 증기기관차 스타일)
    for (const wz of [-2.0, 2.0]) {
      const rodZ = wz + (wz > 0 ? 0.14 : -0.14);
      const rod = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.07, 0.08),
        mat(0x444444),
      );
      rod.position.set(0, _WHEEL_Y_L, rodZ);
      bg.add(rod);
      // 크랭크핀 (연결봉 양 끝 고정점)
      for (const rx of [-0.85, 0.85]) {
        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8),
          mat(0x888888),
        );
        pin.rotation.x = Math.PI / 2;
        pin.position.set(rx, _WHEEL_Y_L, rodZ);
        bg.add(pin);
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

// ----- 굴뚝 연기 파티클 -----
// _buildLoco 에서 _smokeOrigin 설정 후 _initSmoke() 호출, game.js update 에서 tickSmoke(dt) 호출

const _smokeOrigin = new THREE.Vector3();
const _smokeParticles = [];

function _makeSmokeSprite() {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 32;
  const ctx = cv.getContext("2d");
  const grd = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
  grd.addColorStop(0, "rgba(205,205,205,0.9)");
  grd.addColorStop(1, "rgba(205,205,205,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

function _initSmoke() {
  const tex = _makeSmokeSprite();
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const maxAge = 1.8 + Math.random() * 0.8;
    const age = Math.random() * maxAge;
    const bs = 0.5 + Math.random() * 0.14; // 기본 크기
    sp.scale.setScalar(bs * (1 + (age / maxAge) * 1.5));
    sp.position.set(
      _smokeOrigin.x + (Math.random() - 0.5) * 0.15,
      _smokeOrigin.y + age * 0.5,
      _smokeOrigin.z + (Math.random() - 0.5) * 0.15,
    );
    scene.add(sp);
    _smokeParticles.push({
      sp,
      age,
      maxAge,
      bs,
      vx: (Math.random() - 0.5) * 0.1,
      vz: (Math.random() - 0.5) * 0.1,
      vy: 0.5 + Math.random() * 0.25,
    });
  }
}

function tickSmoke(dt) {
  for (const p of _smokeParticles) {
    p.age += dt;
    if (p.age >= p.maxAge) {
      p.age = 0;
      p.sp.position.copy(_smokeOrigin);
      p.vx = (Math.random() - 0.5) * 0.1;
      p.vz = (Math.random() - 0.5) * 0.1;
      p.vy = 0.5 + Math.random() * 0.25;
    }
    const t = p.age / p.maxAge;
    p.sp.position.x += p.vx * dt;
    p.sp.position.y += p.vy * dt * (1 - t * 0.3);
    p.sp.position.z += p.vz * dt;
    const fade = t < 0.15 ? t / 0.15 : t > 0.68 ? (1 - t) / 0.32 : 1;
    p.sp.material.opacity = fade * 0.58;
    p.sp.scale.setScalar(p.bs * (1 + t * 1.5));
  }
}

// ----- 앞뒤 배경 객차 -----
// 플레이 공간(x=0 중심) 앞에 기관차, 뒤에 일반 객차 외관 생성
// 좌석·NPC·충돌 없음 / castShadow=false 로 모바일 성능 최적화

// 아치형 지붕 그룹 생성 (배경 객차 전용, 주 객차 buildRoof와 동일 방식)
function _makeArchRoof(length, color) {
  const W = CAR.W;
  const archR = 10;
  const halfW = W / 2 + 0.22;
  const arcHalf = Math.asin(halfW / archR);
  const arcAngle = arcHalf * 2;
  const cylCY = 2.55 - archR * Math.cos(arcHalf);
  const rg = new THREE.Group();

  const geo = new THREE.CylinderGeometry(
    archR,
    archR,
    length + 0.4,
    6,
    1,
    true,
    Math.PI / 2 - arcHalf,
    arcAngle,
  );
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.y = cylCY;
  rg.add(mesh);

  // 양끝 아치 단면 마감
  const capShape = new THREE.Shape();
  for (let i = 0; i <= 4; i++) {
    const th = Math.PI / 2 - arcHalf + (arcAngle * i) / 4;
    if (i === 0) capShape.moveTo(-archR * Math.cos(th), archR * Math.sin(th));
    else capShape.lineTo(-archR * Math.cos(th), archR * Math.sin(th));
  }
  capShape.closePath();
  const capMat = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
  });
  for (const ex of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(capShape), capMat);
    cap.rotation.y = Math.PI / 2;
    cap.position.set(ex * (length / 2 + 0.2), cylCY, 0);
    rg.add(cap);
  }
  return rg;
}

// 배경 객차용 대차·바퀴 (주 객차 _wheelAxles 에 추가해 함께 회전)
function _buildDecoBogies(parent, L) {
  for (const bx of [-L * 0.3, L * 0.3]) {
    const bg = new THREE.Group();
    bg.position.set(bx, _BOGIE_Y, 0);
    parent.add(bg);
    box(bg, 2.2, 0.18, 4.4, 0x34383f, 0, _WHEEL_Y_L + 0.28, 0, false);
    for (const wx of [-0.85, 0.85]) {
      for (const wz of [-2.0, 2.0]) {
        const rg = new THREE.Group();
        rg.position.set(wx, _WHEEL_Y_L, wz);
        bg.add(rg);
        _wheelAxles.push(rg); // 메인 객차와 함께 회전

        // 메인 디스크
        const dg = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R, _WHEEL_R, 0.2, 20),
          mat(0x1e1e1e),
        );
        dg.rotation.x = Math.PI / 2;
        rg.add(dg);

        // 외륜 토러스
        rg.add(
          new THREE.Mesh(
            new THREE.TorusGeometry(_WHEEL_R - 0.035, 0.07, 5, 20),
            mat(0x1e1e1e),
          ),
        );

        // 스포크 6개 (배경 객차 — 간략화)
        const hR = 0.13,
          rI = _WHEEL_R - 0.07;
        const sMid = (hR + rI) / 2,
          sLen = rI - hR;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = new THREE.Mesh(
            new THREE.BoxGeometry(0.065, sLen, 0.24),
            mat(0x363636),
          );
          sp.position.set(Math.sin(a) * sMid, Math.cos(a) * sMid, 0);
          sp.rotation.z = -a;
          rg.add(sp);
        }

        // 허브
        const hb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.28, 10),
          mat(0x686868),
        );
        hb.rotation.x = Math.PI / 2;
        rg.add(hb);

        // 플랜지
        const fl = new THREE.Mesh(
          new THREE.CylinderGeometry(_WHEEL_R + 0.06, _WHEEL_R + 0.06, 0.1, 20),
          mat(0x0f0f0f),
        );
        fl.rotation.x = Math.PI / 2;
        rg.add(fl);
      }
    }
  }
}

// 뒤쪽 배경 일반 객차 (주 객차와 동일 외관 색, 내부 없음)
function _buildRearCar(cx, L) {
  const W = CAR.W,
    H = CAR.H;
  const g = new THREE.Group();
  g.position.x = cx;
  scene.add(g);

  box(g, L, 0.2, W, 0xd9b48a, 0, -0.1, 0, false);
  box(g, L + 0.2, 0.4, W + 0.2, 0x34383f, 0, -0.4, 0, false);

  for (const sg of [-1, 1]) {
    const zw = (sg * W) / 2,
      pitch = 1.9;
    // 외관 색 띠 (주 객차와 동일)
    box(g, L, 0.65, 0.035, 0x5b8fc5, 0, 0.42, zw + sg * 0.095, false);
    box(g, L, 0.07, 0.04, 0xf8f4e9, 0, 0.79, zw + sg * 0.12, false);
    box(g, L, 0.18, 0.04, 0x315c8e, 0, 0.08, zw + sg * 0.12, false);
    box(g, L, 0.12, 0.04, 0xf7f0df, 0, 1.96, zw + sg * 0.12, false);
    // 벽 본체 + 창 사이 기둥
    box(g, L, 0.9, 0.15, CREAM, 0, 0.45, zw, false);
    box(g, L, 0.7, 0.15, CREAM, 0, 2.25, zw, false);
    for (let i = 0; i < 7; i++)
      box(g, 0.7, 1.0, 0.15, CREAM, (i - 3) * pitch, 1.4, zw, false);
    box(g, 0.55, 1.0, 0.15, CREAM, -7.525, 1.4, zw, false);
    box(g, 0.55, 1.0, 0.15, CREAM, 7.525, 1.4, zw, false);
    // 창문 (약간 불투명 파랑으로 외관 표현)
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.0, 0.02),
        new THREE.MeshBasicMaterial({
          color: 0x7aaec8,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      p.position.set((i - 3.5) * pitch, 1.4, zw);
      g.add(p);
    }
  }
  // 양 끝 벽
  for (const e of [-1, 1]) {
    box(g, 0.15, H, 1.95, CREAM, (e * L) / 2, H / 2, -1.625, false);
    box(g, 0.15, H, 1.95, CREAM, (e * L) / 2, H / 2, 1.625, false);
    box(g, 0.15, 0.6, 1.3, CREAM, (e * L) / 2, 2.3, 0, false);
  }
  g.add(_makeArchRoof(L, 0xf0ede4));
  _buildDecoBogies(g, L);
}

// 앞쪽 기관차 (KORAIL 디젤 — 운전실+엔진룸 분리 구조, 25~30% 증고)
function _buildLoco(cx, L) {
  const W = CAR.W; // 5.2
  const g = new THREE.Group();
  g.position.x = cx;
  scene.add(g);

  // === 공통 하부 (바퀴/레일 접지 위치 유지) ===
  box(g, L + 0.2, 0.4, W + 0.2, 0x34383f, 0, -0.4, 0, false); // 하부 프레임
  box(g, L, 0.52, W, 0x1e4080, 0, 0.17, 0, false); // 하단 파랑 발판
  for (const sg of [-1, 1]) // 발판 측면 돌출
    box(g, L - 0.4, 0.07, 0.28, 0x192e62, 0, 0.46, sg * (W / 2 + 0.1), false);

  const baseY = 0.44; // 차체 주요 부분 시작 y

  // === 운전실 (앞, +x) — 빨간색, 아치 지붕 ===
  const cabL = 3.4;
  const cabX = L / 2 - cabL / 2; // 4.3 (local)
  const cabH = 2.5; // 운전실 차체 높이 (지붕 제외)
  const cabTop = baseY + cabH; // ≈ 2.94

  box(g, cabL, cabH, W, 0xcc2222, cabX, baseY + cabH / 2, 0, false); // 운전실 본체
  box(g, cabL + 0.04, 0.13, W + 0.08, 0xf5f5f0, cabX, baseY + 0.065, 0, false); // 하단 흰 띠
  box(g, cabL + 0.06, 0.15, W + 0.1, 0xaa1818, cabX, cabTop - 0.04, 0, false); // 처마 띠

  // 운전실 완만한 아치 지붕 (archR=8 → 부드러운 곡선)
  const _archR = 8,
    _archHalfW = W / 2 + 0.12;
  const _arcHalf = Math.asin(_archHalfW / _archR);
  const _arcAngle = _arcHalf * 2;
  const _archCylCY = cabTop - _archR * Math.cos(_arcHalf);
  const archCrown = _archCylCY + _archR; // ≈ 3.42 (상단 층 기준점)
  {
    const geo = new THREE.CylinderGeometry(
      _archR,
      _archR,
      cabL + 0.12,
      6,
      1,
      true,
      Math.PI / 2 - _arcHalf,
      _arcAngle,
    );
    geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    const rm = new THREE.Mesh(geo, mat(0xaa1818));
    rm.position.set(cabX, _archCylCY, 0);
    g.add(rm);
    const sh = new THREE.Shape();
    for (let i = 0; i <= 4; i++) {
      const th = Math.PI / 2 - _arcHalf + (_arcAngle * i) / 4;
      if (i === 0) sh.moveTo(-_archR * Math.cos(th), _archR * Math.sin(th));
      else sh.lineTo(-_archR * Math.cos(th), _archR * Math.sin(th));
    }
    sh.closePath();
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xaa1818,
      side: THREE.DoubleSide,
    });
    for (const ex of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), capMat);
      cap.rotation.y = Math.PI / 2;
      cap.position.set(cabX + ex * (cabL / 2 + 0.06), _archCylCY, 0);
      g.add(cap);
    }
  }

  // === 운전실 상단 증축층 (아치형 — 하층 아치와 동일 실린더 중심 공유, 퍼즐 맞물림) ===
  // 내부 반지름 = _archR(하층과 동일) → 하층 곡면과 경계 없이 맞물림
  // 외부 반지름 = _archR + topH → 상단 곡면
  const topH = 0.72;
  const topHalfW = (W - 1.1) / 2; // = 2.05 (상단 아치 반폭)
  const topOuterR = _archR + topH; // = 8.72
  const topArcHalf_i = Math.asin(topHalfW / _archR); // 내부 호 반각 ≈ 0.259 rad
  const topArcHalf_o = Math.asin(topHalfW / topOuterR); // 외부 호 반각 ≈ 0.237 rad
  const topArcAngle_o = topArcHalf_o * 2;

  // 외부 곡면 (상단 표면)
  const topGeo = new THREE.CylinderGeometry(
    topOuterR,
    topOuterR,
    cabL + 0.12,
    6,
    1,
    true,
    Math.PI / 2 - topArcHalf_o,
    topArcAngle_o,
  );
  topGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const topMesh = new THREE.Mesh(topGeo, mat(0xaa1818));
  topMesh.position.set(cabX, _archCylCY, 0);
  g.add(topMesh);

  // 양끝 환형 단면 (내부 R=8 ~ 외부 R=8.72 사이 고리 모양)
  const topCapShape = new THREE.Shape();
  for (let i = 0; i <= 4; i++) {
    // 외부 호 (순방향)
    const th = Math.PI / 2 - topArcHalf_o + (topArcAngle_o * i) / 4;
    if (i === 0)
      topCapShape.moveTo(-topOuterR * Math.cos(th), topOuterR * Math.sin(th));
    else
      topCapShape.lineTo(-topOuterR * Math.cos(th), topOuterR * Math.sin(th));
  }
  for (let i = 4; i >= 0; i--) {
    // 내부 호 (역방향)
    const th = Math.PI / 2 - topArcHalf_i + (topArcHalf_i * 2 * i) / 4;
    topCapShape.lineTo(-_archR * Math.cos(th), _archR * Math.sin(th));
  }
  topCapShape.closePath();
  const topCapMat = new THREE.MeshStandardMaterial({
    color: 0xaa1818,
    side: THREE.DoubleSide,
  });
  for (const ex of [-1, 1]) {
    const topCap = new THREE.Mesh(
      new THREE.ShapeGeometry(topCapShape),
      topCapMat,
    );
    topCap.rotation.y = Math.PI / 2;
    topCap.position.set(cabX + ex * (cabL / 2 + 0.06), _archCylCY, 0);
    g.add(topCap);
  }

  // 측면 Z 엣지 패널 + 창문 (z=±topHalfW 의 열린 단면 커버)
  const sideY_i = _archCylCY + Math.sqrt(_archR * _archR - topHalfW * topHalfW);
  const sideY_o =
    _archCylCY + Math.sqrt(topOuterR * topOuterR - topHalfW * topHalfW);
  const sideH = sideY_o - sideY_i;
  const sideCY = (sideY_i + sideY_o) / 2;
  for (const sg of [-1, 1]) {
    box(
      g,
      cabL + 0.12,
      sideH,
      0.09,
      0xaa1818,
      cabX,
      sideCY,
      sg * topHalfW,
      false,
    );
    const uc = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, sideH * 0.52, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x1a3550,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    uc.position.set(cabX + 0.25, sideCY, sg * (topHalfW + 0.05));
    g.add(uc);
  }

  // === 굴뚝 (운전실 앞쪽 상단) ===
  const topCrown = _archCylCY + topOuterR; // 상단 아치 최정점 y ≈ 4.14
  const chLX = cabX; // 굴뚝 로컬 x (운전실 정중앙)
  const chBase = topCrown + 0.05;
  // 하단 플랜지
  const ch1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8),
    mat(0x333338),
  );
  ch1.position.set(chLX, chBase + 0.06, 0);
  g.add(ch1);
  // 굴뚝 본체 (약간 테이퍼)
  const ch2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    mat(0x2a2a2e),
  );
  ch2.position.set(chLX, chBase + 0.12 + 0.22, 0);
  g.add(ch2);
  // 굴뚝 테두리 (위쪽이 살짝 넓게 — 귀여운 증기기관차 스타일)
  const ch3 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.11, 0.1, 8),
    mat(0x222228),
  );
  ch3.position.set(chLX, chBase + 0.12 + 0.44 + 0.05, 0);
  g.add(ch3);
  // 연기 발생 월드 좌표 → _initSmoke 에서 초기 파티클 배치에 사용
  _smokeOrigin.set(cx + chLX, chBase + 0.12 + 0.44 + 0.1 + 0.05, 0);
  _initSmoke();

  // === 전면 볼록 아치형 면 (Y축 실린더 — 열차 앞부분처럼 전방으로 볼록) ===
  const faceR = 6.0,
    faceHalfZ = W / 2 + 0.08;
  const faceAH = Math.asin(faceHalfZ / faceR);
  const faceCX = L / 2 - Math.sqrt(faceR * faceR - faceHalfZ * faceHalfZ);
  const facePeak = faceCX + faceR; // 볼록 최정점 x (≈ L/2 + 0.59)
  const frontFace = new THREE.Mesh(
    new THREE.CylinderGeometry(
      faceR,
      faceR,
      cabH,
      8,
      1,
      true,
      Math.PI / 2 - faceAH,
      faceAH * 2,
    ),
    mat(0xcc2222),
  );
  frontFace.position.set(faceCX, baseY + cabH / 2, 0);
  g.add(frontFace);
  // 아치 단면 마감 헬퍼: D형 ShapeGeometry (arch curve + straight back edge)
  function _makeArchCapShape(cxOff, r, hZ) {
    const sh = new THREE.Shape();
    sh.moveTo(L / 2, -hZ);
    sh.lineTo(L / 2, hZ);
    for (let i = 0; i <= 10; i++) {
      const sy = hZ - i * ((2 * hZ) / 10);
      sh.lineTo(cxOff + Math.sqrt(r * r - sy * sy), sy);
    }
    sh.closePath();
    return sh;
  }
  const capMat2 = new THREE.MeshStandardMaterial({
    color: 0xcc2222,
    side: THREE.DoubleSide,
  });

  // 하단 마감 (아치 곡선에 맞는 D형, 아래 방향)
  const botCap = new THREE.Mesh(
    new THREE.ShapeGeometry(_makeArchCapShape(faceCX, faceR, faceHalfZ)),
    capMat2,
  );
  botCap.rotation.x = Math.PI / 2; // shape Y → world +Z, 아랫면
  botCap.position.set(0, baseY, 0);
  g.add(botCap);

  // 상단 마감 (D형, 위 방향)
  const topCapSh = new THREE.Shape();
  topCapSh.moveTo(L / 2, faceHalfZ);
  topCapSh.lineTo(L / 2, -faceHalfZ);
  for (let i = 0; i <= 10; i++) {
    const sy = -faceHalfZ + i * ((2 * faceHalfZ) / 10);
    topCapSh.lineTo(faceCX + Math.sqrt(faceR * faceR - sy * sy), sy);
  }
  topCapSh.closePath();
  const topCap2 = new THREE.Mesh(new THREE.ShapeGeometry(topCapSh), capMat2);
  topCap2.rotation.x = -Math.PI / 2; // shape Y → world -Z, 윗면
  topCap2.position.set(0, baseY + cabH, 0);
  g.add(topCap2);

  // 전면 창문 (아치 면에 완전히 붙임 — 두께 최소화, 뒷면이 아치 표면과 일치)
  for (const wz of [-0.95, 0.95]) {
    const wx = faceCX + Math.sqrt(faceR * faceR - wz * wz);
    const yr = Math.asin(wz / faceR);
    // 창틀 (얇게, 뒷면=아치 표면)
    const wf = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.73, 1.2),
      mat(0x0d1520),
    );
    wf.position.set(wx + 0.013, baseY + cabH * 0.65, wz);
    wf.rotation.y = yr;
    g.add(wf);
    // 유리 (창틀 바로 위)
    const wp = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.62, 1.06),
      new THREE.MeshBasicMaterial({
        color: 0x1a3550,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    wp.position.set(wx + 0.026, baseY + cabH * 0.65, wz);
    wp.rotation.y = yr;
    g.add(wp);
  }

  // 측면 창문 (각 2개)
  for (const sg of [-1, 1]) {
    const zw = (sg * W) / 2;
    const c1 = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.62, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x1a3550,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    c1.position.set(cabX + 0.5, baseY + cabH * 0.65, zw);
    g.add(c1);
    const c2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.5, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x1a3550,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    c2.position.set(cabX - cabL * 0.28, baseY + cabH * 0.65, zw);
    g.add(c2);
  }

  // 전조등 (아치 곡면 위)
  for (const wz of [-1.1, 1.1]) {
    const hx = faceCX + Math.sqrt(faceR * faceR - wz * wz);
    const hl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffcc }),
    );
    hl.rotation.z = Math.PI / 2;
    hl.position.set(hx + 0.04, baseY + 0.5, wz);
    g.add(hl);
  }
  // 전면 하단 범퍼 (아치 곡선에 맞게 — 옆으로 튀어나오지 않음)
  const bumpMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      faceR + 0.04,
      faceR + 0.04,
      0.32,
      8,
      1,
      true,
      Math.PI / 2 - faceAH,
      faceAH * 2,
    ),
    mat(0x333338),
  );
  bumpMesh.position.set(faceCX, baseY + 0.16, 0);
  g.add(bumpMesh);

  // === 엔진룸 (뒤) — 파랑 하단 + 흰색 상단 덮개 ===
  const engL = L - cabL - 0.14; // ≈ 8.46
  const engX = -L / 2 + engL / 2; // ≈ -1.77 (local)
  const engH = 2.3; // 엔진룸 높이
  const engTop = baseY + engH; // ≈ 2.74

  box(g, engL, 1.1, W, 0x2b5aa0, engX, baseY + 0.55, 0, false); // 하단 파랑 차체
  box(g, engL + 0.06, 0.1, W + 0.04, 0x1a3568, engX, baseY + 1.1, 0, false); // 경계선
  box(
    g,
    engL,
    engH - 1.1,
    W - 0.4,
    0xf0ede4,
    engX,
    baseY + 1.1 + (engH - 1.1) / 2,
    0,
    false,
  ); // 흰색 상단
  box(g, engL + 0.04, 0.14, W - 0.36, 0x2b5aa0, engX, engTop - 0.04, 0, false); // 상단 파랑 띠
  for (const sg of [-1, 1]) // 측면 하단 파랑 패널 (두께감)
    box(g, engL, 1.08, 0.18, 0x2458a0, engX, baseY + 0.54, (sg * W) / 2, false);

  // 상단 환기구 블록 3개
  for (let i = 0; i < 3; i++)
    box(
      g,
      engL * 0.24,
      0.3,
      W * 0.5,
      0x44484e,
      engX - engL * 0.3 + i * (engL * 0.3),
      engTop + 0.15,
      0,
      false,
    );
  // 환기 루버 가로줄
  for (let r = 0; r < 3; r++)
    box(
      g,
      engL * 0.72,
      0.04,
      W - 0.38,
      0x555560,
      engX,
      baseY + 1.3 + r * 0.38,
      0,
      false,
    );

  // 측면 환기 루버 패널
  for (const sg of [-1, 1]) {
    const zw = (sg * W) / 2;
    for (const ex of [-engL * 0.28, 0, engL * 0.28]) {
      const vp = new THREE.Mesh(
        new THREE.BoxGeometry(engL * 0.21, 0.88, 0.05),
        new THREE.MeshBasicMaterial({
          color: 0x222228,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      vp.position.set(engX + ex, baseY + 1.5, zw);
      g.add(vp);
    }
  }

  // 운전실·엔진룸 경계 띠 + 뒷면 연결기
  box(
    g,
    0.14,
    cabH + 0.1,
    W + 0.12,
    0x1a1a22,
    cabX - cabL / 2 - 0.07,
    baseY + cabH / 2,
    0,
    false,
  );
  box(g, 0.26, 0.3, W * 0.6, 0x444449, -L / 2 - 0.07, baseY + 0.14, 0, false);

  _buildDecoBogies(g, L);
}

// 연결통로 (두 객차 사이 — 고무 아코디언 형태)
function _buildConnector(x, gap, W) {
  const g = new THREE.Group();
  g.position.x = x;
  scene.add(g);
  // 연결부 외피
  box(g, gap, 2.4, W * 0.72, 0x444449, 0, 1.1, 0, false);
  // 측면 금속 프레임
  for (const sg of [-1, 1])
    box(g, gap + 0.08, 2.5, 0.1, 0x555560, 0, 1.1, sg * W * 0.36, false);
  // 하단 연결기 범퍼
  box(g, gap + 0.3, 0.26, W * 0.5, 0x33383f, 0, -0.27, 0, false);
  box(g, gap + 0.4, 0.18, 0.28, 0x888890, 0, -0.1, 0, false);
}

// buildWorld 에서 호출 — 뒤 일반객차 + 앞 기관차 + 연결통로 2개
function buildAdjacentCars() {
  const GAP = 1.0; // 연결부 간격
  const L_REAR = 15.6,
    L_LOCO = 9.2;
  _buildRearCar(-(CAR.L / 2 + GAP + L_REAR / 2), L_REAR);
  _buildLoco(CAR.L / 2 + GAP + L_LOCO / 2, L_LOCO);
  _buildConnector(-(CAR.L / 2 + GAP / 2), GAP, CAR.W);
  _buildConnector(CAR.L / 2 + GAP / 2, GAP, CAR.W);
}

/* =====================================================
   끝벽(앞뒤) 인테리어 장식
   구성: 짐칸 선반 / 광고판 / 호차 번호 안내판 / 출입문 패널
   ===================================================== */

// 광고판 설정 — src에 이미지 경로를 넣으면 자동 교체
// END_WALL_ADS[eIdx][si]: eIdx 0=뒤(e=-1) / 1=앞(e=+1), si 0=z음수쪽 / 1=z양수쪽
// src에 이미지 경로를 넣으면 이미지로, type:'whiteboard'/'korea' 로 특수 판 그림
const END_WALL_ADS = [
  // ── 뒤쪽 벽 (가족사진 유지) ──
  [
    { label: "느린 기차와\n더 느린 여행", sub: "The Slow Journey", emoji: "🌾",
      src: "images/family.png", bg: "#f0e6d0", fg: "#2a1a0e" },
    { label: "기차 간식\n모음전", sub: "따뜻한 커피 한 잔", emoji: "☕",
      src: "images/family.png", bg: "#f5e8d8", fg: "#3a1a06" },
  ],
  // ── 앞쪽 벽: 흰보드 + 대한민국 지도 ──
  [
    { type: "whiteboard", bg: "#f6f6f6", fg: "#555555" },
    { type: "korea",      bg: "#d4e8f8", fg: "#1a3a6b" },
  ],
];

// 광고 캔버스 텍스처 생성 (src 있으면 이미지 로드)
function _makeAdTex(ad, cb) {
  const W = 256,
    H = 192;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");

  function draw(img) {
    ctx.fillStyle = ad.bg;
    ctx.fillRect(0, 0, W, H);

    if (ad.type === "whiteboard") {
      // 화이트보드: 흰 배경 + 연한 가로선 + 알루미늄 테두리
      ctx.fillStyle = "#f9f9f9";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#b0b0b0";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1;
      for (let ly = 32; ly < H - 10; ly += 26) {
        ctx.beginPath(); ctx.moveTo(16, ly); ctx.lineTo(W - 16, ly); ctx.stroke();
      }
      ctx.fillStyle = "#c0c0c0";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("White Board", W / 2, H - 8);

    } else if (ad.type === "korea") {
      // 대한민국 지도: 바다 + 한반도 아웃라인 + 제주도
      ctx.fillStyle = "#b8d8f0";
      ctx.fillRect(0, 0, W, H);
      // 한반도 간략 폴리곤 (256×192 기준)
      ctx.fillStyle = "#8db870";
      ctx.strokeStyle = "#4a7040";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const pts = [
        [96,20],[110,16],[130,16],[148,20],[162,30],[172,48],[176,70],
        [174,92],[168,114],[160,132],[150,150],[138,164],[126,170],
        [112,168],[96,158],[80,144],[68,126],[62,104],[64,78],[72,52],[82,34]
      ];
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([x,y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 제주도
      ctx.beginPath();
      ctx.ellipse(116, 182, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // 라벨
      ctx.fillStyle = "#1a3a6b";
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("대한민국", W / 2, H - 6);

    } else if (img) {
      ctx.drawImage(img, 12, 12, W - 24, H - 24);
      // 외부 테두리
      ctx.strokeStyle = "#c8a870";
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, W - 8, H - 8);
    } else {
      // 외부 테두리
      ctx.strokeStyle = "#c8a870";
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.strokeStyle = "#e0c090";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 10, W - 20, H - 20);
      const lines = ad.label.split("\n");
      ctx.fillStyle = ad.fg;
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lineH = 36;
      const startY = H / 2 - ((lines.length - 1) * lineH) / 2 - 16;
      lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineH));
      if (ad.sub) {
        ctx.fillStyle = ad.fg + "88";
        ctx.font = "14px sans-serif";
        ctx.fillText(ad.sub, W / 2, H - 36);
      }
      ctx.font = "26px sans-serif";
      ctx.fillStyle = ad.fg;
      ctx.fillText(ad.emoji, W / 2, H - 16);
    }
    cb(new THREE.CanvasTexture(cv));
  }

  if (ad.src) {
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = ad.src;
  } else {
    draw(null);
  }
}

// 호차 번호 안내판 텍스처
function _makeCarNumTex() {
  const W = 320,
    H = 72;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#1d2f4f";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(242,182,50,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // 호차 번호
  ctx.fillStyle = "#f2b632";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🚃  1호차", W * 0.3, H / 2);
  // 구분선
  ctx.strokeStyle = "rgba(242,182,50,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.54, 10);
  ctx.lineTo(W * 0.54, H - 10);
  ctx.stroke();
  // 객실 타입
  ctx.fillStyle = "#c8d8e8";
  ctx.font = "15px sans-serif";
  ctx.fillText("일반실 (자유석)", W * 0.77, H / 2);
  return new THREE.CanvasTexture(cv);
}

// 앞뒤 끝벽 인테리어 장식 본체
function buildEndWallDecor() {
  const L = CAR.L;
  const carNumTex = _makeCarNumTex();

  for (const e of [-1, 1]) {
    const g = new THREE.Group();
    scene.add(g);
    ends[e].push(g); // 끝벽과 함께 가시성 토글

    const inX = e * (L / 2 - 0.08); // 벽 안쪽 면 x
    const ry = (-e * Math.PI) / 2; // 패널이 내부를 향하는 y 회전

    // ── 짐칸 선반 (왼쪽·오른쪽 패널 각 1개) ──
    for (const pz of [-1.625, 1.625]) {
      // 선반 판
      box(g, 0.34, 0.05, 1.7, 0xd4c8b0, inX - e * 0.17, 2.3, pz);
      // 선반 앞쪽 가로 봉
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.68, 8),
        mat(0x9a8a7a),
      );
      rod.rotation.x = Math.PI / 2;
      rod.position.set(inX - e * 0.33, 2.33, pz);
      g.add(rod);
      // 지지 브라켓 2개
      for (const bz of [pz - 0.6, pz + 0.6])
        box(g, 0.34, 0.025, 0.025, 0x9a8a7a, inX - e * 0.17, 2.19, bz);
    }

    // ── 짐 소품 ──
    box(g, 0.26, 0.2, 0.42, 0xa05030, inX - e * 0.17, 2.43, -2.0); // 갈색 가방
    box(g, 0.22, 0.17, 0.52, 0x506080, inX - e * 0.17, 2.41, 1.3); // 파란 가방
    box(g, 0.24, 0.26, 0.36, 0xc09060, inX - e * 0.17, 2.47, -1.1); // 베이지 가방

    // ── 광고판 ── (eIdx: 0=뒤쪽, 1=앞쪽)
    const eIdx = e < 0 ? 0 : 1;
    for (let si = 0; si < 2; si++) {
      const pz = si === 0 ? -1.625 : 1.625;
      _makeAdTex(END_WALL_ADS[eIdx][si], (tex) => {
        const p = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 1.05),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
          }),
        );
        p.position.set(inX, 1.2, pz);
        p.rotation.y = ry;
        g.add(p);
      });
    }

    // ── 호차 번호 안내판 (출입문 위) ──
    const numP = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.34),
      new THREE.MeshBasicMaterial({
        map: carNumTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    numP.position.set(inX, 2.22, 0);
    numP.rotation.y = ry;
    g.add(numP);

    // ── 출입문 패널 ──
    // 문 본체 (크림/목재색 패널)
    box(g, 0.04, 2.0, 1.26, 0xddd0b8, inX - e * 0.02, 1.0, 0);
    // 문틀 테두리 (어두운 선)
    box(g, 0.07, 2.04, 0.07, 0x2a3f60, inX, 1.0, -0.635); // 왼쪽 세로틀
    box(g, 0.07, 2.04, 0.07, 0x2a3f60, inX, 1.0, 0.635); // 오른쪽 세로틀
    box(g, 0.07, 0.07, 1.42, 0x2a3f60, inX, 2.02, 0); // 상단 가로틀
    // 문 창문 (반투명 파랑)
    const dwin = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.55),
      new THREE.MeshBasicMaterial({
        color: 0x7aaec8,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    dwin.position.set(inX - e * 0.055, 1.62, 0);
    g.add(dwin);
    // 창문 프레임 4변
    box(g, 0.05, 0.42, 0.04, 0x2a3f60, inX - e * 0.055, 1.62, -0.275);
    box(g, 0.05, 0.42, 0.04, 0x2a3f60, inX - e * 0.055, 1.62, 0.275);
    box(g, 0.05, 0.04, 0.57, 0x2a3f60, inX - e * 0.055, 1.84, 0);
    box(g, 0.05, 0.04, 0.57, 0x2a3f60, inX - e * 0.055, 1.4, 0);
    // 손잡이 (양쪽)
    box(g, 0.07, 0.06, 0.13, 0x888890, inX - e * 0.07, 1.08, 0.28);
    box(g, 0.07, 0.06, 0.13, 0x888890, inX - e * 0.07, 1.08, -0.28);

    // ── 천장 조명 (패널 위) ──
    for (const lz of [-1.625, 1.625]) {
      box(g, 0.3, 0.05, 0.14, 0xe8e0d0, inX - e * 0.08, 2.56, lz);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.02, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xfffde8 }),
      );
      lamp.position.set(inX - e * 0.08, 2.535, lz);
      g.add(lamp);
    }
  }
}
