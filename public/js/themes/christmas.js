/* =====================================================
   크리스마스 테마 (christmas.js)
   - 양쪽 벽면 상단: 흰 전선 + 여러 색 반짝이는 전구 스트링
   - 4인석 테이블 중앙: 미니 크리스마스 트리
   ===================================================== */

const ChristmasTheme = (() => {
  // 전구 색상 (빨/노/파/초/주황)
  const COLORS = [0xff1111, 0xffee00, 0x0055ff, 0x11cc33, 0xff6600];

  const WIRE_Y = 2.4;
  const BULB_Y = 2.3;
  const PITCH  = 0.92;

  // 4인석 테이블 위치: game.js에서 [-1,1].forEach(s=>table(s*1.6)) 으로 생성
  const TABLE_Z   = [-1.6, 1.6];
  const TABLE_SURFACE_Y = 0.815; // 테이블 상판 윗면 y

  let _group = null;           // 트리만 담는 그룹 (scene에 직접)
  const _sideGroups = {};      // 벽면 전구 — walls[sg] 자식으로
  const _bulbs = [];
  const _tmp = new THREE.Color();

  // ── 미니 크리스마스 트리 1개 생성 (그룹 반환) ──
  function _makeTree(wx, wy, wz) {
    const g = new THREE.Group();
    g.position.set(wx, wy, wz);

    const mk = (geo, col, px, py, pz) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(px || 0, py || 0, pz || 0);
      g.add(m);
      return m;
    };

    // 화분 (테라코타 갈색)
    mk(new THREE.CylinderGeometry(0.05, 0.065, 0.07, 8), 0x9b5523, 0, 0.035);
    // 흙
    const soil = mk(new THREE.CircleGeometry(0.049, 8), 0x3a2210, 0, 0.071);
    soil.rotation.x = -Math.PI / 2;

    // 나무 몸통 — 3단 콘
    const GREEN = 0x1a7a28;
    mk(new THREE.ConeGeometry(0.090, 0.135, 8), GREEN, 0, 0.138);
    mk(new THREE.ConeGeometry(0.070, 0.108, 8), GREEN, 0, 0.228);
    mk(new THREE.ConeGeometry(0.050, 0.088, 8), GREEN, 0, 0.308);

    // 꼭대기 별
    mk(new THREE.SphereGeometry(0.022, 8, 6), 0xffd700, 0, 0.360);

    // 작은 장식구 2개
    mk(new THREE.SphereGeometry(0.014, 6, 5), 0xff2222, -0.03, 0.195,  0.07);
    mk(new THREE.SphereGeometry(0.014, 6, 5), 0xff2222,  0.04, 0.270, -0.06);

    return g;
  }

  // ── 빌드 ──
  function build() {
    if (_group) dispose();
    _group = new THREE.Group();
    _bulbs.length = 0;

    // 양쪽 벽면 전구 스트링 — walls[sg] 자식으로 등록해 벽과 함께 가시성 토글
    for (const sg of [-1, 1]) {
      const sg_group = new THREE.Group();
      _sideGroups[sg] = sg_group;
      walls[sg].add(sg_group);

      const zw = sg * (CAR.W / 2 - 0.12);

      // 흰 전선
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(CAR.L - 1.0, 0.016, 0.016),
        new THREE.MeshBasicMaterial({ color: 0xf0f0f0 }),
      );
      wire.position.set(0, WIRE_Y, zw);
      sg_group.add(wire);

      let ci = sg < 0 ? 0 : 2;
      for (let x = -7.1; x <= 7.15; x += PITCH) {
        const col = COLORS[ci % COLORS.length];
        ci++;

        // 흰 소켓
        const socket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.019, 0.015, 0.06, 6),
          new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }),
        );
        socket.position.set(x, WIRE_Y - 0.045, zw);
        sg_group.add(socket);

        // 전구
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.052, 8, 6),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.position.set(x, BULB_Y, zw);
        const bright = new THREE.Color(col);
        const dim    = new THREE.Color(col).multiplyScalar(0.06);
        bulb.userData = {
          bright,
          dim,
          phase: (ci % 2 === 0) ? 0 : Math.PI,
          speed: 2.2,
        };
        sg_group.add(bulb);
        _bulbs.push(bulb);
      }
    }

    // 4인석 테이블 미니 트리 — 벽과 무관하므로 scene에 직접
    for (const tz of TABLE_Z) {
      _group.add(_makeTree(0, TABLE_SURFACE_Y, tz));
    }
    scene.add(_group);
  }

  // ── 테마 해제 ──
  function dispose() {
    if (!_group) return;
    // 벽면 서브그룹 정리
    for (const sg of [-1, 1]) {
      const sg_group = _sideGroups[sg];
      if (sg_group) {
        sg_group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        walls[sg].remove(sg_group);
        _sideGroups[sg] = null;
      }
    }
    // 트리 정리
    _group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    scene.remove(_group);
    _group = null;
    _bulbs.length = 0;
  }

  // ── 매 프레임: 홀짝 교차 반짝임 ──
  function tick(dt) {
    for (const b of _bulbs) {
      const u = b.userData;
      u.phase += dt * u.speed;
      b.material.color.copy(Math.sin(u.phase) > 0 ? u.bright : u.dim);
    }
  }

  return { build, dispose, tick };
})();

// 테마 관리자에 등록
Theme.register('christmas', ChristmasTheme);
