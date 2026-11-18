/* =====================================================
   13. 게임 본체 (game.js)
   매 프레임 갱신(update) → 시작 조립(build) → 반응형 카메라(fit)
   build()는 역할별 작은 함수로 나뉘어 있습니다:
   initRenderer → buildWorld → spawnActors → restoreProfile → initCamera → initInput → startLoop
   ===================================================== */

// ----- 매 프레임 갱신 -----
// 플레이어 이동(키보드/경로) → NPC·판매원·승무원 → 풍경 스크롤 → 충돌 분리 → 말풍선 수명 → 버튼 표시
function update(dt) {
  const f =
    (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const r =
    (keys.KeyD || keys.ArrowRight ? 1 : 0) -
    (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let moving = false;
  const pos = P.g.position;
  if (f || r) {
    // 카메라 기준 이동 + 통로 안으로 제한(좌석/테이블/벽 통과 불가)
    leaveSpot(P);
    P.path = [];
    cancelRes(P);
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    d.y = 0;
    d.normalize();
    const v = new THREE.Vector3(
      d.x * f - d.z * r,
      0,
      d.z * f + d.x * r,
    ).normalize();
    pos.x = Math.max(-XMAX, Math.min(XMAX, pos.x + v.x * P.speed * dt));
    pos.z = Math.max(-AISLE, Math.min(AISLE, pos.z + v.z * P.speed * dt));
    face(P, v.x, v.z);
    moving = true;
  } else moving = stepPath(P, dt);
  if (P.state !== "sit") animate(P, moving, dt);
  for (const n of NPCS) {
    if (!n.g.visible) continue; // 비활성 NPC는 건너뜀
    if (Multi.isHost()) {
      if (!n._retiring) brain(n, dt); // 퇴장 이동 중에는 brain 중단
      const m = stepPath(n, dt);
      if (n.state !== "sit") animate(n, m, dt);
    } else {
      // 비호스트: brain·이동 계산 없이 받은 moving 상태로 애니메이션만 처리
      if (n.state !== "sit") animate(n, n._npcMoving || false, dt);
    }
  }
  if (Multi.isHost()) vendorTick(dt); // 호스트만 판매원 AI 실행 (멀티: 비호스트는 위치 수신)
  updateShop();
  heldTick(dt);
  if (Multi.isHost()) conductorTick(dt); // 호스트만 역무원 AI 실행 (비호스트는 Multi.tick에서 애니메이션)
  kickTick(dt);
  nookTick();
  // 카메라 타겟을 플레이어 위치로 이동(줌·회전 오프셋 유지)
  if (ctl && P) {
    const dx = P.g.position.x - ctl.target.x,
      dz = P.g.position.z - ctl.target.z;
    ctl.target.x += dx;
    ctl.target.z += dz;
    ctl.target.y = 0.6;
    cam.position.x += dx;
    cam.position.z += dz;
  }
  $("bExit").hidden = P.state !== "hide"; // 숨어 있을 때만 '나가기' 버튼 표시
  SCN.forEach((o) => {
    o.m.position.x -= TRAIN * o.k * dt;
    if (o.m.position.x < -48) o.m.position.x += o.p;
  }); // 창밖 풍경 흘러가기 + 반복
  tickWheels(dt); // 바퀴 회전
  Multi.tick(dt); // 멀티플레이 위치 동기화
  separate();
  // 말풍선 페이드 인(처음 0.3초) · 페이드 아웃(마지막 0.4초) · 수명 종료 시 제거
  // 원격 플레이어(피어) 말풍선도 포함해야 상대방 화면에서 보임
  for (const a of [P, ...NPCS, V, C, ...Multi.getPeers()]) {
    if (!a.bub) continue;
    a.bubT -= dt;
    if (a.bubT <= 0) {
      a.g.remove(a.bub);
      a.bub.material.map.dispose();
      a.bub.material.dispose();
      a.bub = null;
    } else {
      const u = a.bub.userData;
      u.fi = Math.min(1, (u.fi || 0) + dt / 0.3);
      a.bub.material.opacity = u.fi * Math.min(1, a.bubT / 0.4);
    }
  }
  $("stand").hidden = P.state !== "sit"; // 앉아 있을 때만 '일어나기' 버튼 표시
}

// 현재 프로필(닉네임·객차·좌석·승차권·위치)을 Repo에 저장
function saveNow() {
  if (!P || GameState.ended) return;
  Repo.saveProfile({
    nickname: P.name,
    carId: GameState.carId,
    seatId: P.seat ? P.seat.id : null,
    ticketSeatId: GameState.ticket ? GameState.ticket.seatId : null,
    x: P.g.position.x,
    z: P.g.position.z,
  });
}

// ----- 시작 조립 -----
// 렌더러·장면·조명·땅 생성
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("game").insertBefore(renderer.domElement, $("game").firstChild); // 캔버스를 #game 맨 앞에 삽입(UI가 위에 오도록)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe8f0);
  scene.add(new THREE.HemisphereLight(0xfff3dc, 0xb8895a, 0.85)); // 하늘/바닥 환경광
  // 햇살(그림자 생성) + 보조광
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.3);
  sun.position.set(-4, 9, -9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff6e8, 0.4);
  fill.position.set(2, 8, 10);
  scene.add(fill);
  // 객차 아래 넓은 풀밭 바닥
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 110),
    mat(0x8fbf6a),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.55;
  ground.receiveShadow = true;
  scene.add(ground);
}

// 객차·창밖 풍경·좌석·테이블·좌석 터치 영역·좌석 번호 레이블 생성
function buildWorld() {
  shell();
  scenery();
  buildBogies();
  buildTrack();
  BENCHES.forEach(bench);
  [-1, 1].forEach((s) => table(s * 1.6));
  // 좌석마다 보이지 않는 터치 영역(마우스를 올리면 노랗게 표시)
  SEATS.forEach((s) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.16, 0.85),
      new THREE.MeshBasicMaterial({
        color: 0xffd36b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    m.position.set(s.x, 0.54, s.z);
    m.userData = s;
    scene.add(m);
    hits.push(m);
  });
  buildSeatLabels(); // 머리받침 뒷면에 번호 Mesh 부착
}

// 플레이어·베타 NPC·판매원·승무원·숨는 곳·UI 생성
// profile: 저장된 프로필 (같은 닉네임일 때 티켓 복구 시도)
function spawnActors(profile) {
  const nick = $("hn").textContent;
  P = mkActor("player", nick, {
    shirt: 0xe8553d,
    hair: 0x4a3426,
    skin: 0xffd9b3,
    pants: 0x3b4a6b,
  });
  P.g.position.set(-6.6, 0, 0);
  P.g.rotation.y = Math.PI / 2;
  // 같은 닉네임으로 재접속하면 저장된 지정석 복구 시도, 다른 닉네임이면 새 배정
  const savedTicketSeatId =
    profile && profile.nickname === nick ? profile.ticketSeatId : null;
  assignTicket(savedTicketSeatId);
  // 베타 승객: 일부(3명)는 앉고 나머지는 통로를 걸음 (플레이어 지정석 제외)
  NPC_DEFS.forEach((d, i) => {
    const n = mkActor("npc" + i, d.name, { ...d, npc: true });
    NPCS.push(n);
    const free = SEATS.filter(
      (s) =>
        !GameState.occ[s.id] &&
        !(GameState.ticket && s.id === GameState.ticket.seatId),
    );
    if (i < 3) sitDown(n, pick(free));
    else {
      n.g.position.set(rnd(-4, 5), 0, rnd(-0.4, 0.4));
      n.g.rotation.y = rnd(0, 6);
    }
  });
  makeVendor();
  makeConductor();
  makeNooks();
  buildUI();
}

// 저장된 프로필 복원(같은 닉네임일 때): 앉아 있던 좌석이 비어 있으면 그 자리에, 아니면 저장된 위치
function restoreProfile(profile) {
  if (!(profile && profile.nickname === P.name)) return;
  const s = SEATS.find((q) => q.id === profile.seatId);
  if (s && !GameState.occ[s.id]) sitDown(P, s);
  else if (typeof profile.x === "number")
    P.g.position.set(
      Math.max(-XMAX, Math.min(XMAX, profile.x)),
      0,
      Math.max(-AISLE, Math.min(AISLE, profile.z || 0)),
    );
}

// 카메라 + 드래그 회전·휠/핀치 확대축소 컨트롤 + 화면 크기 대응
function initCamera() {
  cam = new THREE.PerspectiveCamera(40, 1, 0.1, 250);
  ray = new THREE.Raycaster();
  if (THREE.OrbitControls) {
    ctl = new THREE.OrbitControls(cam, renderer.domElement);
    ctl.target.set(0, 0.6, 0);
    ctl.enablePan = false;
    ctl.enableDamping = true;
    ctl.minDistance = 4;
    ctl.maxDistance = 50;
    ctl.maxPolarAngle = Math.PI * 0.49;
  }
  addEventListener("resize", fit);
  fit();
}

// 입력 연결: 마우스/터치(좌석·판매원·숨는 곳·바닥 이동) + 키보드(WASD/방향키) + 일어나기 버튼
function initInput() {
  const dom = renderer.domElement,
    tip = $("tip");
  // 화면 좌표를 레이캐스트해 가장 가까운 좌석 터치 영역을 반환
  const pickSeat = (e) => {
    const r = dom.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      ),
      cam,
    );
    return ray.intersectObjects(hits)[0];
  };
  // 마우스 호버: 빈 좌석을 노랗게 + 좌석 번호·상태 툴팁 표시(터치 기기에서는 생략)
  dom.addEventListener("pointermove", (e) => {
    hits.forEach((m) => (m.material.opacity = 0));
    tip.style.display = "none";
    if (e.pointerType !== "mouse" || e.buttons) return;
    const h = pickSeat(e);
    if (!h) return;
    const s = h.object.userData;
    const isOcc = !!GameState.occ[s.id];
    if (!isOcc) h.object.material.opacity = 0.6; // 빈 자리만 노랗게
    // 좌석 번호와 상태 조합 (내 자리 / 내 자리 착석 중 / 착석 중 / 비어 있음)
    const isMyTicketSeat = !!(
      GameState.ticket && GameState.ticket.seatId === s.id
    );
    let tipText = s.seatType === "free" ? "자유석" : `${s.displayNum}번석`;
    if (isMyTicketSeat && isOcc) tipText += " · 내 자리 (클릭해서 비워달라기)";
    else if (isMyTicketSeat) tipText += " · 내 자리";
    else if (isOcc) tipText += " · 착석 중";
    tip.textContent = tipText;
    tip.style.left = e.clientX + "px";
    tip.style.top = e.clientY + "px";
    tip.style.display = "block";
  });
  // 클릭/탭 판정: 누른 위치와 뗀 위치가 거의 같을 때만 '클릭'(드래그 회전과 구분)
  let down = null;
  dom.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  dom.addEventListener("pointerup", (e) => {
    if (
      GameState.inspecting ||
      !down ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6
    )
      return;
    down = null;
    const h = pickSeat(e);
    if (V.active && ray.intersectObject(V.g, true)[0]) return openShop(); // 판매원 클릭
    const nk = ray.intersectObjects(nookHits)[0]; // 의자 등받이 사이 빈 공간(숨는 곳) 터치
    if (nk && (!h || nk.distance < h.distance))
      return void askNook(nk.object.userData);
    if (h) {
      // 내 지정석에 베타 NPC가 앉아 있으면 자리 반환 요청
      if (
        GameState.ticket &&
        h.object.userData.id === GameState.ticket.seatId &&
        GameState.occ[h.object.userData.id]
      ) {
        requestSeatYield();
        return;
      }
      return void goSeat(P, h.object.userData); // 그 외 빈 좌석 착석 / 다른 사람 좌석은 거부
    }
    const p = new THREE.Vector3(); // 그 외: 바닥 터치 이동
    if (
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)
    )
      goFloor(P, p.x, p.z);
  });
  $("stand").onclick = () => standUp(P);
  addEventListener("keydown", (e) => {
    keys[e.code] = !GameState.inspecting;
    /* 검표 중에는 이동 입력 무시 */ if (e.code.startsWith("Arrow"))
      e.preventDefault();
  });
  addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
}

// 자동 저장: 4초마다 + 페이지를 떠나거나 탭이 숨겨질 때
function initAutoSave() {
  setInterval(saveNow, 4000);
  addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveNow();
  });
}

// 렌더 루프 시작: 갱신 → 벽 가림 처리 → 렌더
function startLoop() {
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (GameState.ended) return; // 강제 퇴장 후에는 더 이상 갱신/렌더하지 않음
    update(Math.min(clock.getDelta(), 0.05));
    if (ctl) ctl.update();
    // 카메라 거리에 따라 지붕 표시
    updateRoof(cam.position.distanceTo(ctl.target));
    const distance = cam.position.distanceTo(ctl.target);
    // 카메라가 멀어지면 객차 앞뒤 벽 표시
    for (const e of [-1, 1]) {
      ends[e].forEach((m) => {
        m.visible = distance > 25 || !(e * cam.position.x > CAR.L / 2 + 0.2);
      });
    }

    // 가까이에서는 내부가 보이도록 벽 숨김
    // 멀리에서는 외관이 보이도록 벽 표시
    for (const s of [-1, 1]) {
      walls[s].visible =
        distance > 25 || !(s * cam.position.z > CAR.W / 2 + 0.3);
    }
    renderer.render(scene, cam);
  })();
}

// 게임 시작(입장 직후 1회 호출): 위 단계들을 순서대로 실행
function build(profile) {
  initRenderer();
  buildWorld();
  spawnActors(profile);
  restoreProfile(profile);
  initCamera();
  initInput();
  initAutoSave();
  startLoop();
}

// 화면 크기에 맞춰 렌더러/카메라 조정(가로·세로가 바뀔 때만 시점 재설정)
function fit() {
  const w = innerWidth,
    h = innerHeight,
    a = w / h,
    portrait = a < 1;
  renderer.setSize(w, h);
  cam.aspect = a;
  cam.updateProjectionMatrix();
  if (portrait === lastPortrait) return;
  lastPortrait = portrait;
  const t = 0.728,
    dir = portrait
      ? new THREE.Vector3(9.4, 17.7, 0)
      : new THREE.Vector3(0, 11, 13.8); // 세로(모바일)=위에서 / 가로(PC)=비스듬히
  const d =
    (portrait ? Math.max(17.5, 8.0 / a) : Math.max(8.5, 14 / (t * a))) * 1.0;
  cam.position.copy(
    dir
      .normalize()
      .multiplyScalar(d)
      .add(new THREE.Vector3(0, 0.6, 0)),
  );
  cam.lookAt(0, 0.6, 0);
  if (ctl) ctl.update();
}
