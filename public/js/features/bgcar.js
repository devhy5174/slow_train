/* =====================================================
   배경 객차 인테리어 (bgcar.js)
   뒤쪽 배경 객차 내부 — 간략 의자·테이블 + 장식용 손님 10명
   좌석 배치는 메인 객차(data.js)와 동일:
     NORMAL_X 6열 × 양쪽 (12벤치) + TABLE_B 2위치 × 양쪽 (4벤치) = 32석
   Supabase·멀티플레이 연결 없음. 순수 장식용.
   buildWorld() 에서 BgCar.init() 호출,
   update()     에서 BgCar.tick(dt) 호출
   ===================================================== */

const BgCar = (() => {
  // 뒤 객차 중심 X (buildAdjacentCars 의 _buildRearCar 계산과 동일)
  // CAR.L=15.6, GAP=1.0, L_REAR=15.6 → -(7.8 + 1.0 + 7.8) = -16.6
  const OX = -(CAR.L / 2 + 1.0 + 15.6 / 2);

  // 보행 애니메이션이 필요한 장식 NPC 목록 (tick 에서 처리)
  const _actors = [];

  // 간략 2인석 벤치 — 받침대 + 방석 + 등받이 + 팔걸이 (labels·클릭 없음)
  // yaw: 0 = +X 방향(앞쪽), Math.PI = -X 방향(뒤쪽, 테이블 마주보기)
  function _bench(g, lx, side, yaw) {
    const bg = new THREE.Group();
    bg.position.set(lx, 0, side * 1.6);
    bg.rotation.y = yaw;
    g.add(bg);
    box(bg, 0.62, 0.36, 1.78, NAVY, 0, 0.18, 0);        // 받침대
    for (const dz of [-0.45, 0.45]) {
      box(bg, 0.59, 0.12, 0.78, BLUE, 0.02, 0.44, dz);  // 방석
      box(bg, 0.08, 0.72, 0.76, BLUE, -0.3, 0.9, dz);   // 등받이
    }
    box(bg, 0.52, 0.1, 0.08, NAVY, 0, 0.6, 0);           // 팔걸이
  }

  // 간략 테이블 (local z 기준, main car 의 table() 와 동일 구조)
  function _table(g, lz) {
    const tg = new THREE.Group();
    tg.position.set(0, 0, lz);
    g.add(tg);
    box(tg, 0.9, 0.07, 1.7, 0xb07a45, 0, 0.78, 0);  // 상판
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.78, 10),
      mat(0x6b4a2b),
    );
    leg.position.y = 0.39;
    leg.castShadow = true;
    tg.add(leg);
    box(tg, 0.5, 0.04, 0.5, 0x6b4a2b, 0, 0.02, 0);  // 바닥 받침
  }

  // 장식 NPC 1명 생성 — makeChar + 최소 actor 래퍼 (GameState 등록 없음)
  function _spawnNpc(def) {
    const a = {
      id: 'bg_' + def.name,
      name: def.name,
      npc: true,
      g: makeChar(def.shirt, def.name, { ...def, npc: true }),
      state: 'idle',
      t: Math.random() * 6, // 위상 오프셋 — 각자 다른 타이밍으로 걸음
      held: null,
      bub: null,
      bubT: 0,
    };

    if (def.sit) {
      // 앉힘 — sitDown 없이 직접 위치·포즈 설정 (좌석 점유 등록 안 함)
      // def.sit.ry: yaw=0 → PI/2(+X앞쪽), yaw=PI → -PI/2(-X 테이블 마주보기)
      a.state = 'sit';
      a.g.position.set(OX + def.sit.lx, 0.15, def.sit.z);
      a.g.rotation.y = def.sit.ry !== undefined ? def.sit.ry : Math.PI / 2;
      animate(a, false, 0);
    } else {
      // 보행 초기 위치
      a.g.position.set(OX + def.startX, 0, def.wz);
      a.g.rotation.y = def.wdir > 0 ? Math.PI / 2 : -Math.PI / 2;
      a._wx0 = OX + def.wx0;   // 왕복 범위 (월드 좌표)
      a._wx1 = OX + def.wx1;
      a._wspd = def.wspd;
      a._wdir = def.wdir;
    }

    // 헤드셋 착용 (헤드폰 그룹 생성 후 visible = true)
    if (def.headphones) {
      const hp = buildHeadphones(a.g);
      hp.visible = true;
    }

    _actors.push(a);
  }

  // ── 장식 NPC 10명 정의 ──────────────────────────────
  // sit.lx : 뒤 객차 로컬 X — data.js 의 NORMAL_X / TABLE_B.x 와 동일 값 사용
  // sit.z  : 월드 Z — side*(1.15 or 2.05) 로 메인 객차와 동일
  // sit.ry : 앉은 방향 (기본 PI/2 = +X 앞방향 / -PI/2 = -X 테이블 마주보기)
  // wx0/wx1: 보행 범위 (로컬 오프셋, OX 기준)
  const DEFS = [
    // 헤드셋 착용 + 창가 앉은 손님 (4명)
    { name: '창가무드',    shirt: 0x4a7bbf, hair: 0x1a1a1a, skin: 0xffd9b3, pants: 0x2a3a5a,
      sit: { lx: -6.2, z: -1.15 }, headphones: true },
    { name: '졸음여행자',  shirt: 0xc47a3a, hair: 0x4a3020, skin: 0xf0c89a, pants: 0x3a3028,
      sit: { lx: -6.2, z:  1.15 }, headphones: true },
    { name: '이어폰러버',  shirt: 0x8878c8, hair: 0x1e1e1e, skin: 0xffd9b3, pants: 0x3a3858,
      sit: { lx: -1.45, z: -1.15 }, headphones: true },        // 테이블석 (yaw=0, +X)
    { name: '기차멍마니아', shirt: 0x58a8a8, hair: 0x2a1a0a, skin: 0xffd9b3, pants: 0x2a4848,
      sit: { lx:  6.2, z:  1.15 }, headphones: true },
    // 헤드셋 없는 앉은 손님 (4명)
    { name: '도시락손님',  shirt: 0x6aaa6a, hair: 0x2a1a0a, skin: 0xffe0c0, pants: 0x2a4a2a,
      sit: { lx: -4.8, z: -1.15 } },
    { name: '느긋한여행자', shirt: 0xd48ab0, hair: 0x1a1a1a, skin: 0xffd9b3, pants: 0x5a3a5a,
      sit: { lx: -3.4, z:  2.05 } },
    { name: '창밖구경꾼',  shirt: 0xa0785a, hair: 0x5a3a1a, skin: 0xe8b880, pants: 0x4a3828,
      // 테이블석 (yaw=PI, -X 방향으로 마주보기)
      sit: { lx:  1.45, z: -1.15, ry: -Math.PI / 2 } },
    { name: '간식탐험가',  shirt: 0xe08848, hair: 0x6a4a2a, skin: 0xf0c090, pants: 0x403828,
      sit: { lx:  4.8, z: -2.05 } },
    // 통로 왕복 보행 손님 (2명, 서로 반대 방향 출발)
    { name: '통로서성이',  shirt: 0xc8a040, hair: 0x3a2a1a, skin: 0xf8d0a8, pants: 0x383028,
      wx0: -6.0, wx1: 5.5, wz:  0.0,  wspd: 0.65, startX:  1.0, wdir:  1 },
    { name: '느린승객',    shirt: 0x9898c8, hair: 0x1a1a28, skin: 0xffd9b3, pants: 0x2a2a48,
      wx0: -5.5, wx1: 5.0, wz:  0.15, wspd: 0.50, startX: -2.0, wdir: -1 },
  ];

  // 뒤 객차 인테리어 초기화 (buildWorld 에서 1회 호출)
  function init() {
    // 가구 그룹 — 모든 로컬 좌표가 이 그룹 안에서 처리됨
    const g = new THREE.Group();
    g.position.x = OX;
    scene.add(g);

    // 일반 2인석 — data.js NORMAL_X × 양쪽 (12벤치, yaw=0)
    for (const side of [-1, 1]) {
      for (const lx of [-6.2, -4.8, -3.4, 3.4, 4.8, 6.2]) {
        _bench(g, lx, side, 0);
      }
    }

    // 중앙 테이블석 — data.js TABLE_B 와 동일 위치·방향 (4벤치)
    for (const side of [-1, 1]) {
      _bench(g, -1.45, side, 0);            // yaw=0  (+X 바라봄)
      _bench(g,  1.45, side, Math.PI);      // yaw=PI (-X 바라봄, 마주보기)
    }

    // 중앙 테이블 2개 — data.js table(z) 와 동일 위치
    _table(g, -1.6);
    _table(g,  1.6);

    // 장식 손님 10명 생성
    DEFS.forEach(_spawnNpc);

    // ── 천장 조명 — 메인 객차와 동일한 주기 배치, DayNight에 등록 ──
    for (const lx of [-6, -3, 0, 3, 6]) {
      // PointLight — 초기 intensity=0, DayNight이 낮밤에 따라 제어
      const light = new THREE.PointLight(0xfffde8, 0, 5.5, 2);
      light.position.set(OX + lx, 2.4, 0);
      light.visible = false;
      scene.add(light);
      DayNight.addInteriorLight(light);

      // 발광 패널 (장식) — 천장에 붙어있는 형광등 플레이트
      for (const lz of [-1.625, 1.625]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.02, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xfffde8 }),
        );
        panel.position.set(OX + lx, 2.535, lz);
        scene.add(panel);
      }
    }
  }

  // 매 프레임 애니메이션 (update 에서 호출)
  function tick(dt) {
    for (const a of _actors) {
      if (a.state === 'sit') continue;  // 앉은 NPC는 애니메이션 갱신 불필요
      // 직선 왕복 보행 — 방향 전환 시 회전 갱신
      a.g.position.x += a._wdir * a._wspd * dt;
      if (a.g.position.x > a._wx1) {
        a._wdir = -1;
        a.g.rotation.y = -Math.PI / 2;
      }
      if (a.g.position.x < a._wx0) {
        a._wdir = 1;
        a.g.rotation.y = Math.PI / 2;
      }
      animate(a, true, dt);
    }
  }

  return { init, tick };
})();
