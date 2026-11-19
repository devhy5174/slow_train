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
  const _wreaths = {};         // 출입문 리스 — ends[e] 연동
  const _bulbs = [];
  const _tmp = new THREE.Color();

  // ── 출입문 창문 리스 1개 생성 ──
  function _makeWreath() {
    const g = new THREE.Group();
    const R = 0.26; // 기존보다 살짝 크게

    const mk = (geo, col, x, y, z) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
      if (x !== undefined) m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    // 솔잎 덩어리 — 링 주변 박스 40개 (더 크고 두껍게)
    const PINE = [0x0f5c1a, 0x1a7a28, 0x0a4a14];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = R + (i % 2 === 0 ? 0.038 : -0.018);
      const needle = mk(
        new THREE.BoxGeometry(0.028 + (i % 3) * 0.008, 0.088, 0.022),
        PINE[i % 3],
        (i % 3 - 1) * 0.034, Math.sin(a) * r, Math.cos(a) * r,
      );
      needle.rotation.x = a + Math.PI / 2;
    }

    // 메인 초록 토러스 (두꺼운 베이스)
    const ring = mk(new THREE.TorusGeometry(R, 0.075, 10, 36), 0x0f5c1a);
    ring.rotation.y = Math.PI / 2;

    // 큰 빨간 볼 8개
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mk(new THREE.SphereGeometry(0.062, 10, 8), 0xbb0a0a,
        (i % 3 - 1) * 0.020, Math.sin(a) * R, Math.cos(a) * R);
    }

    // 실버 볼 8개 (사이사이)
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      mk(new THREE.SphereGeometry(0.048, 10, 8), 0xc8c8d4,
        (i % 2 === 0 ? 0.022 : -0.022), Math.sin(a) * R, Math.cos(a) * R);
    }

    // 소형 골드/와인 볼 12개
    const ACCENTS = [0xc8960a, 0x8b0000, 0xd4af37];
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.3) / 12) * Math.PI * 2;
      const r = R + (i % 2 === 0 ? 0.045 : -0.032);
      mk(new THREE.SphereGeometry(0.033, 8, 6), ACCENTS[i % 3],
        (i % 5 - 2) * 0.018, Math.sin(a) * r, Math.cos(a) * r);
    }

    // 반짝이는 전구 18개 — _bulbs 에 등록해 tick()에서 사라졌다 나왔다
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = R + (i % 3 - 1) * 0.030;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xfffaaa }),
      );
      bulb.position.set((i % 4 - 1.5) * 0.016, Math.sin(a) * r, Math.cos(a) * r);
      bulb.userData = {
        bright: new THREE.Color(0xfffaaa),
        dim:    new THREE.Color(0xfffaaa).multiplyScalar(0.03),
        phase:  (i / 18) * Math.PI * 2, // 균등 분산 → 물결처럼 순차 반짝임
        speed:  2.2 + (i % 5) * 0.35,
      };
      g.add(bulb);
      _bulbs.push(bulb);
    }

    // 빨간 리본
    const BM = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
    const lGeo = new THREE.TorusGeometry(0.044, 0.014, 6, 18);

    const lL = new THREE.Mesh(lGeo, BM);
    lL.position.set(0, R + 0.048, -0.048); lL.rotation.set(0.5, Math.PI / 2, 0); g.add(lL);
    const lR = new THREE.Mesh(lGeo, BM);
    lR.position.set(0, R + 0.048,  0.048); lR.rotation.set(-0.5, Math.PI / 2, 0); g.add(lR);

    mk(new THREE.SphereGeometry(0.032, 8, 6), 0xaa0000, 0, R + 0.044, 0);

    const tG = new THREE.BoxGeometry(0.014, 0.052, 0.014);
    const tL = new THREE.Mesh(tG, BM); tL.position.set(0, R + 0.004, -0.020); tL.rotation.z =  0.28; g.add(tL);
    const tR = new THREE.Mesh(tG, BM); tR.position.set(0, R + 0.004,  0.020); tR.rotation.z = -0.28; g.add(tR);

    return g;
  }

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

        // 전구 — 세로로 긴 뾰족 타원형 (y축 1.5배 스케일)
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.062, 8, 7),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.5, 1);
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

    // 출입문 창문 리스 — ends[e] 에 넣어 끝벽과 함께 가시성 토글
    for (const e of [-1, 1]) {
      const wx = e * (CAR.L / 2 - 0.19); // 창문 안쪽 면 바로 앞
      const wreath = _makeWreath();
      wreath.position.set(wx, 1.62, 0);
      scene.add(wreath);
      ends[e].push(wreath);
      _wreaths[e] = wreath;
    }
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

    // 리스 정리
    for (const e of [-1, 1]) {
      const w = _wreaths[e];
      if (w) {
        w.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
        scene.remove(w);
        const idx = ends[e].indexOf(w);
        if (idx !== -1) ends[e].splice(idx, 1);
        _wreaths[e] = null;
      }
    }
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
