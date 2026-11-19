/* =====================================================
   5. 캐릭터 / 행위자 (actor.js)
   플레이어·NPC·판매원·승무원이 같은 Actor 구조를 공유합니다.
   state = idle | sit | hide, path(이동 경로), pend(좌석 예약), pendNook(숨는 곳 예약), held(손에 든 간식)
   행동 로직(brain)은 npc.js에 분리 → 나중에 실제 접속자로 교체하기 쉬움

   좌석 점유는 GameState.occ(state.js)에서 관리합니다.
   actorSnapshot / applyActorSnapshot: Supabase 연결 시 상태 동기화에 사용합니다.
   ===================================================== */

// 캐릭터 3D 모델 생성(몸·머리·머리카락·눈·팔다리·이름표).
// o = {skin, hair, pants, cap, npc, avatarType}
// avatarType: 'male'(기본) | 'female' — avatar.js의 빌더 함수로 외형 분기
function makeChar(shirt, label, o) {
  const g = new THREE.Group();
  // 몸통·팔다리 생성용 내부 헬퍼
  const add = (geo, c, x, y, z, p = g) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    p.add(m);
    return m;
  };
  // 몸통 — LatheGeometry 곡선 실루엣 (상단 좁고 하단으로 갈수록 완만하게 넓어짐)
  const _bp = [
    new THREE.Vector2(0.13,  0.20),  // 상단 (가장 좁음)
    new THREE.Vector2(0.142, 0.13),
    new THREE.Vector2(0.158, 0.05),
    new THREE.Vector2(0.178,-0.04),
    new THREE.Vector2(0.200,-0.13),
    new THREE.Vector2(0.215,-0.20),  // 하단 (가장 넓음)
  ];
  // DoubleSide: 카메라 각도 무관하게 안쪽 면도 렌더링 → 속 안 보임
  const _bm = add(new THREE.LatheGeometry(_bp, 16), shirt, 0, 0.64, 0);
  _bm.material.side = THREE.DoubleSide;
  // 상단·하단 뚜껑 (구멍 막기)
  const _tc = add(new THREE.CircleGeometry(0.13, 16), shirt, 0, 0.84, 0);
  _tc.rotation.x = -Math.PI / 2;
  const _bc = add(new THREE.CircleGeometry(0.215, 16), shirt, 0, 0.44, 0);
  _bc.rotation.x = Math.PI / 2;
  // 하단 허리 밴드
  add(new THREE.CylinderGeometry(0.22, 0.215, 0.06, 16), o.pants, 0, 0.415, 0);
  // 어깨 범프 (세로 납작, 몸통 곡선과 어울리게)
  for (const sx of [-1, 1]) {
    const _sb = add(new THREE.SphereGeometry(0.085, 12, 10), shirt, sx * 0.185, 0.835, 0);
    _sb.scale.set(1.0, 0.70, 0.88);
  }
  // 후드티 디테일 — 승무원·판매원 제외, 일반 승객만
  if (o.avatarType !== "conductor" && o.avatarType !== "vendor") {
    const shirtDark = new THREE.Color(shirt).multiplyScalar(0.76).getHex();

    // 후드 (뒷머리·어깨 위 볼록한 부분)
    const hd = add(new THREE.SphereGeometry(0.19, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), shirt, 0, 0.84, -0.09);
    hd.scale.set(1.08, 0.88, 0.80);
    hd.rotation.x = 0.28;

    // 후드 칼라 (반원 토러스 — 목 앞쪽에서 보이는 후드 개구부)
    const hc = add(new THREE.TorusGeometry(0.096, 0.021, 6, 14, Math.PI), shirtDark, 0, 0.875, 0.045);
    hc.rotation.x = -0.52;

    // 드로우스트링 2개
    for (const sx of [-0.038, 0.038]) {
      const ds = add(new THREE.CylinderGeometry(0.007, 0.006, 0.11, 5), shirtDark, sx, 0.762, 0.128);
      ds.rotation.x = 0.14;
    }

    // 캥거루 포켓 (하단 앞면)
    add(new THREE.BoxGeometry(0.24, 0.082, 0.013), shirtDark, 0, 0.526, 0.187);

    // 가슴 프린트 — 몸통 커브에 밀착하는 실린더 패치
    const _ic = document.createElement("canvas");
    _ic.width = 80; _ic.height = 80;
    const _tex = new THREE.CanvasTexture(_ic);
    const _patchArc = Math.PI * 0.44; // 약 79°
    const _patchR   = 0.159;          // 몸통 반지름(y=0.695 ≈ 0.157) + 미세 오프셋
    const _patchGeo = new THREE.CylinderGeometry(
      _patchR, _patchR, 0.096, 10, 1, true,
      Math.PI * 0.5 - _patchArc * 0.5, _patchArc, // 앞면 중심(+z)에 정렬
    );
    const _im = new THREE.Mesh(
      _patchGeo,
      new THREE.MeshBasicMaterial({ map: _tex, transparent: true, depthWrite: false }),
    );
    _im.position.set(0, 0.695, 0);
    g.add(_im);
    // SVG → canvas 비동기 (data URI는 즉시 로드)
    const _svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"'
      + ' stroke="#1d2f4f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>'
      + '<path d="m9 15-1-1"/><path d="m15 15 1-1"/>'
      + '<path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>'
      + '<path d="m8 19-2 3"/><path d="m16 19 2 3"/>'
      + '<circle cx="12" cy="11" r="1"/><path d="M9 11h1"/><path d="M14 11h1"/>'
      + '</svg>';
    const _simg = new Image();
    _simg.onload = () => {
      _ic.getContext("2d").drawImage(_simg, 4, 4, 72, 72);
      _tex.needsUpdate = true;
    };
    _simg.src = "data:image/svg+xml," + encodeURIComponent(_svg);
  }

  // 목 (얼굴 바로 아래 — 몸통 상단 y=0.84 ~ 턱 y=1.00 사이)
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), o.skin, 0, 0.87, 0); // 목 하단=몸통상단(0.84), 목 상단=0.90
  // 머리·머리카락·얼굴 — avatarType에 따라 외형 분기 (avatar.js)
  if (o.avatarType === "conductor") buildConductorAvatar(g, o);
  else if (o.avatarType === "vendor") buildVendorAvatar(g, o);
  else buildAvatar(g, o); // 기본: 일반 승객
  // 팔: 원기둥 + 주먹 구체 / 다리: 원기둥 + 신발 구체 (관절 그룹으로 애니메이션 유지)
  const armG = (x, y) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    add(
      new THREE.CylinderGeometry(0.055, 0.055, 0.34, 10),
      shirt,
      0,
      -0.13,
      0,
      p,
    );
    add(new THREE.SphereGeometry(0.07, 10, 8), o.skin, 0, -0.3, 0, p);
    g.add(p);
    return p;
  };
  const legG = (x, y) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    add(
      new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10),
      o.pants,
      0,
      -0.16,
      0,
      p,
    );
    add(new THREE.SphereGeometry(0.082, 10, 8), 0x1c1c1c, 0, -0.36, 0, p);
    g.add(p);
    return p;
  };
  g.userData = {
    aL: armG(-0.21, 0.82),
    aR: armG(0.21, 0.82),
    lL: legG(-0.09, 0.44),
    lR: legG(0.09, 0.44),
  };
  // 이름표: 텍스트 너비에 맞춘 최소 크기 캔버스, 둥근 모서리, 아이보리 글씨
  // NPC는 남색, 플레이어는 따뜻한 적갈색으로 명확히 구분
  const _mc = document.createElement("canvas").getContext("2d");
  _mc.font = "bold 20px sans-serif";
  const _nlw = Math.min(Math.ceil(_mc.measureText(label).width) + 26, 210),
    _nlh = 36;
  const cv = document.createElement("canvas");
  cv.width = _nlw;
  cv.height = _nlh;
  const nc = cv.getContext("2d");
  nc.fillStyle = o.npc ? "rgba(55,75,110,0.78)" : "rgba(140,55,30,0.92)";
  nc.beginPath();
  nc.roundRect(2, 2, _nlw - 4, _nlh - 4, 9);
  nc.fill();
  nc.fillStyle = "#f0e8d8";
  nc.font = "bold 20px sans-serif";
  nc.textAlign = "center";
  nc.textBaseline = "middle";
  nc.fillText(label, _nlw / 2, _nlh / 2);
  const _spSy = 0.14,
    _spSx = (_nlw / 256) * 0.9; // 스프라이트 크기: 텍스트 길이 비례, 최대 약 0.74
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      transparent: true,
    }),
  );
  sp.scale.set(_spSx, _spSy, 1);
  sp.position.y = 1.8;
  sp.userData.baseScaleY = _spSy;
  g.add(sp);
  g.userData.label = sp;
  scene.add(g);
  return g;
}

// 행위자(Actor) 상태 객체 생성 — 플레이어와 NPC가 같은 구조를 사용
function mkActor(id, name, o) {
  const label = o.label || (o.npc ? `베타 ${name}` : name); // NPC는 이름표에 '베타'를 붙여 실제 이용자와 구분
  return {
    id,
    name,
    npc: !!o.npc,
    g: makeChar(o.shirt, label, o),
    state: "idle",
    path: [],
    pend: null,
    seat: null,
    res: null,
    t: 0,
    speed: o.npc ? 1.1 : 2.2,
    timer: rnd(2, 6),
    say: rnd(3, 9),
    bub: null,
    bubT: 0,
  };
}

// 걷기/앉기/숨기에 맞춰 팔다리 포즈 갱신(간식을 들고 있으면 오른팔 고정)
function animate(a, moving, dt) {
  const u = a.g.userData,
    sit = a.state === "sit",
    hide = a.state === "hide" || a.state === "squat"; // squat도 웅크린 포즈 공유
  // 숨기: 몸을 낮춰 웅크린 자세(이름표는 납작해지지 않게 보정)
  const sy = hide ? 0.62 : 1;
  a.g.scale.y = sy;
  u.label.scale.y = (u.label.userData.baseScaleY || 0.3) / sy;
  u.label.position.y = 1.8 / sy;
  if (moving) a.t += dt * 9;
  const sw = moving ? Math.sin(a.t) * 0.7 : 0; // 걸을 때 팔다리 흔들림 각도
  u.lL.rotation.x = sit ? -1.45 : sw;
  u.lR.rotation.x = sit ? -1.45 : -sw;
  u.aL.rotation.x = sit ? -0.6 : -sw * 0.8;
  u.aR.rotation.x = sit ? -0.6 : sw * 0.8;
  if (a.held) u.aR.rotation.x = sit ? -0.9 : -1.0; // 간식을 들고 있으면 오른팔을 앞으로 고정
  if (hide) {
    u.aL.rotation.x = u.aR.rotation.x = -1.3;
    u.lL.rotation.x = u.lR.rotation.x = -1.2;
  } // 웅크려 무릎을 감싼 자세
}

// 행위자가 (dx,dz) 방향을 바라보게 회전
const face = (a, dx, dz) => {
  a.g.rotation.y = Math.atan2(dx, dz);
};

// 행위자를 좌석에 앉힘: 점유 등록, 좌석 방향·높이 맞춤 (플레이어면 저장)
function sitDown(a, s) {
  a.seat = s;
  a.res = null;
  a.pend = null;
  a.path = [];
  a.state = "sit";
  GameState.occ[s.id] = a.id;
  const dx = Math.cos(s.yaw),
    dz = -Math.sin(s.yaw);
  a.g.position.set(s.x - dx * 0.08, 0.15, s.z - dz * 0.08);
  face(a, dx, dz);
  animate(a, false, 0);
  if (a.npc) a.timer = rnd(8, 22);
  else saveNow();
}

// 신문지로 걸어가서 쭈그려 앉기 (goSeat 방식)
function goSquat(a, pos) {
  if (a.npc) return;
  if (GameState.occ[pos.id] && GameState.occ[pos.id] !== a.id) {
    toast("이미 누군가 앉아 있어요."); return;
  }
  cancelRes(a);
  leaveSpot(a);
  GameState.occ[pos.id] = a.id;
  a.pendSq = pos;
  a.path = [
    { x: pos.x, z: Math.sign(pos.z) * AISLE }, // 통로까지
    { x: pos.x, z: pos.z },                      // 신문지 위로
  ];
}

// 신문지 위 도착 후 쭈그려 앉기 (stepPath에서 호출)
function squatDown(a, pos) {
  if (a.npc) return;
  a.pendSq = null;
  a.state = "squat";
  a.sqPos = pos;
  if (!GameState.occ[pos.id]) GameState.occ[pos.id] = a.id;
  a.g.position.set(pos.x, 0, pos.z);
  face(a, Math.cos(pos.yaw), -Math.sin(pos.yaw));
  animate(a, false, 0);
  if (!a.npc) saveNow();
}

// 쭈그려 앉기 해제
function squatUp(a) {
  if (a.state !== "squat") return;
  const pos = a.sqPos;
  if (pos && GameState.occ[pos.id] === a.id) delete GameState.occ[pos.id];
  a.sqPos = null;
  a.state = "idle";
  a.g.position.set(a.g.position.x, 0, Math.sign(a.g.position.z) * AISLE);
  animate(a, false, 0);
  if (!a.npc) saveNow();
}

// 앉은 상태에서 일어나 통로 가장자리로 나옴(점유 해제)
function standUp(a) {
  if (a.state === "squat") return squatUp(a);
  if (a.state !== "sit") return;
  const s = a.seat;
  if (GameState.occ[s.id] === a.id) delete GameState.occ[s.id];
  a.seat = null;
  a.state = "idle";
  a.g.position.set(s.x, 0, Math.sign(s.z) * AISLE);
  animate(a, false, 0);
  if (a.npc) a.timer = rnd(1, 3);
  else saveNow();
}

// 좌석 예약 취소(이동 중 목적지를 바꿀 때)
function cancelRes(a) {
  if (a.res) {
    if (GameState.occ[a.res.id] === a.id) delete GameState.occ[a.res.id];
    a.res = null;
  }
  a.pend = null;
  a.pendNook = null;
  if (a.pendSq) {
    if (GameState.occ[a.pendSq.id] === a.id) delete GameState.occ[a.pendSq.id];
    a.pendSq = null;
  }
}

// 좌석으로 이동 명령: 예약 후 통로를 지나 착석. 이미 점유된 좌석이면 거부(false)
function goSeat(a, s) {
  if (GameState.occ[s.id] && GameState.occ[s.id] !== a.id) return false; // 같은 좌석에 둘이 앉지 못함
  cancelRes(a);
  if (a.state === "hide") exitNook(a);
  if (a.state === "sit") {
    const x = a.g.position.x;
    standUp(a);
    a.g.position.set(x, 0, 0);
  }
  GameState.occ[s.id] = a.id;
  a.res = s;
  a.pend = s;
  a.path = [
    { x: s.x, z: 0 },
    { x: s.x, z: s.z },
  ];
  return true;
}

// 통로 위 지점으로 이동 명령(통로 밖으로는 못 나가게 제한)
function goFloor(a, x, z) {
  leaveSpot(a);
  cancelRes(a);
  a.path = [
    {
      x: Math.max(-XMAX, Math.min(XMAX, x)),
      z: Math.max(-AISLE, Math.min(AISLE, z)),
    },
  ];
}

// 경로를 따라 한 프레임만큼 이동. 반환값: 이동 중인지 여부. 도착 시 착석/숨기 처리
function stepPath(a, dt) {
  if (!a.path.length) return false;
  const pos = a.g.position,
    t = a.path[0],
    dx = t.x - pos.x,
    dz = t.z - pos.z,
    dist = Math.hypot(dx, dz),
    st = a.speed * dt;
  if (dist <= st) {
    pos.x = t.x;
    pos.z = t.z;
    a.path.shift();
    if (!a.path.length && a.pend) sitDown(a, a.pend);
    else if (!a.path.length && a.pendNook) hideIn(a, a.pendNook);
    else if (!a.path.length && a.pendSq) squatDown(a, a.pendSq);
    return false;
  }
  pos.x += (dx / dist) * st;
  pos.z += (dz / dist) * st;
  face(a, dx, dz);
  return true;
}

// ----- 상태 직렬화 (Supabase 동기화 준비) -----

// 행위자의 현재 상태를 네트워크로 전송 가능한 순수 객체로 추출합니다.
// Supabase 연결 시: actorSnapshot(P) → channel.send(snapshot)
function actorSnapshot(a) {
  return {
    id: a.id,
    name: a.name,
    carId: GameState.carId,
    x: a.g.position.x,
    z: a.g.position.z,
    ry: a.g.rotation.y, // 바라보는 방향 (Y축 회전)
    state: a.state, // 'idle' | 'sit' | 'hide' | 'squat'
    seatId: a.seat ? a.seat.id : null,
    nookId: a.nook ? a.nook.id : null,
    sqPosId: a.sqPos ? a.sqPos.id : null,
    headphones: a.headphones ? a.headphones.visible : false, // 헤드폰 착용 여부
  };
}

// 서버에서 받은 스냅샷을 행위자에 적용합니다.
// 원격 이용자 행위자는 npc: true로 생성해야 saveNow()가 호출되지 않습니다.
// (sitDown 내부: a.npc === true 이면 저장 생략)
// Supabase 연결 시: channel.on(snap => applyActorSnapshot(remoteActor, snap))
function applyActorSnapshot(a, snap) {
  // 위치·방향 갱신
  a.g.position.x = snap.x;
  a.g.position.z = snap.z;
  a.g.rotation.y = snap.ry ?? a.g.rotation.y;

  // 헤드폰 착용 상태 반영 (원격 플레이어 actor 생성 시 buildHeadphones(a.g) 호출 필요)
  if (snap.headphones !== undefined && a.headphones)
    a.headphones.visible = snap.headphones;

  // 착석 상태 반영
  if (snap.state === "sit" && snap.seatId) {
    if (a.state !== "sit") {
      const s = SEATS.find((q) => q.id === snap.seatId);
      if (s) sitDown(a, s);
    }
  } else if (snap.state === "hide" && snap.nookId) {
    // 숨기 상태 반영 (NOOKS, hideIn은 nook.js에서 선언 — 호출 시점에 존재)
    if (a.state !== "hide") {
      const n = NOOKS.find((q) => q.id === snap.nookId);
      if (n) hideIn(a, n);
    }
  } else if (snap.state === "squat" && snap.sqPosId) {
    if (a.state !== "squat") {
      const pos = typeof SQUAT_SPOTS !== 'undefined'
        ? SQUAT_SPOTS.find(q => q.id === snap.sqPosId) : null;
      if (pos) {
        a.state = "squat"; a.sqPos = pos;
        a.g.position.set(pos.x, 0, pos.z);
        face(a, Math.cos(pos.yaw), -Math.sin(pos.yaw));
        animate(a, false, 0);
      }
    }
  } else {
    // 이동 중 / 서 있는 상태
    if (a.state === "sit") standUp(a);
    else if (a.state === "hide") exitNook(a);
    else if (a.state === "squat") squatUp(a);
  }
}
