/* =====================================================
   크리스마스 테마 (christmas.js)
   - 양쪽 벽면 상단: 흰 전선 + 여러 색 반짝이는 전구 스트링
   - 4인석 테이블 중앙: 미니 크리스마스 트리
   ===================================================== */

const ChristmasTheme = (() => {
  // 전구 색상 (빨/노/파/초/주황)
  const COLORS = [0xff1111, 0xffee00, 0x0055ff, 0x11cc33, 0xff6600];

  const WIRE_Y = 2.21;  // 짐칸 앞 레일 y (SY + 0.13)
  const BULB_Y = 2.12;  // 전구 y (레일 아래로 살짝)
  const PITCH  = 0.92;

  // 4인석 테이블 위치: game.js에서 [-1,1].forEach(s=>table(s*1.6)) 으로 생성
  const TABLE_Z   = [-1.6, 1.6];
  const TABLE_SURFACE_Y = 0.815; // 테이블 상판 윗면 y

  let _group = null;           // 트리만 담는 그룹 (scene에 직접)
  const _sideGroups = {};      // 벽면 전구 — walls[sg] 자식으로
  const _wreaths = {};         // 출입문 리스 — ends[e] 연동
  const _lanternGroups = {};   // 크리스마스 랜턴 — 훅 대신 표시
  const _signs       = [];     // 전광판 애니메이션 데이터
  const _signGroups  = {};     // ends[e] 연동
  const _bulbs = [];
  const _tmp = new THREE.Color();

  // ── 외부 장식 추가 상태 ──
  const _extLightGroups = {};   // 주 객차 외부 전구 (walls[sg] 자식)
  const _rearCarLightGroups = []; // 뒤 객차 외부 전구 그룹 (scene 직접)
  const _roofLightGroups = [];    // 지붕 전구 그룹 (scene 직접)
  let _locoDecorGroup = null;     // 기관차 크리스마스 장식 그룹 (scene 직접)
  // 산타 썰매
  let _santa = null;        // 산타 그룹
  let _santaOn = false;     // 현재 비행 중 여부
  let _santaTimer = 5;      // 첫 등장까지 대기 시간(초)
  let _santaDir = 1;        // 이동 방향 (+1 오른쪽, -1 왼쪽)
  let _santaBaseY = 4.0;    // 기준 고도 (지붕 바로 위)
  let _santaElapsed = 0;    // 등장 후 경과 시간 (보빙용)
  // 반짝이 파티클
  const _sparkles = [];
  const _SPKCOLS = [0xffd700, 0xfffde8, 0xff6600, 0xffee00, 0xffffff, 0xff8888, 0x88ff88];
  let _spkTimer = 0;
  const _hpDecorMeshes = [];      // 헤드셋 장식 메쉬 (P.headphones 자식)
  let _hpDecorDone = false;       // 헤드셋 장식 1회 적용 여부
  const _xscMeshes = [];          // SCN 에 추가한 나무 전구 메쉬 (해제 시 제거용)

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

  // ── 크리스마스 랜턴 그룹 생성 (한쪽 벽 전체) ──
  // 이미지 참고: 황금 랜턴 + 솔가지 + 빨간 리본 + 호랑가시 열매, 은은한 촛불 글로우
  function _makeLanternGroup(sg) {
    const HY   = 1.72;
    const zi   = sg * (CAR.W / 2 - 0.076);
    const dir  = -sg;  // 실내 방향

    const GOLD  = 0xb86a08, GOLD_L = 0xd48210;
    const RED   = 0xaa0808, RED_L  = 0xcc1010;
    const PINE_D = 0x0d4a14, PINE_L = 0x1a7020;
    const HOLLY = 0x1a5c1a, BERRY  = 0xcc0a0a;
    const METAL = 0x3a2810;

    const outerG = new THREE.Group();

    [-5.7, -3.8, -1.9, 0, 1.9, 3.8, 5.7].forEach((hx, idx) => {
      const g = new THREE.Group();
      g.position.set(hx, HY, zi + dir * 0.07); // 랜턴 중심: 벽면에서 실내 쪽으로

      const mk = (geo, col, x, y, z) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
        m.position.set(x || 0, y || 0, z || 0);
        g.add(m);
        return m;
      };

      const wd = -dir; // 벽 방향 (솔가지를 벽쪽에 붙임)

      // 걸이 고리 (최상단)
      mk(new THREE.CylinderGeometry(0.007, 0.007, 0.052, 6), METAL, 0, 0.165);
      const ring = mk(new THREE.TorusGeometry(0.013, 0.005, 6, 12), METAL, 0, 0.192);
      ring.rotation.x = Math.PI / 2;

      // 솔가지 클러스터 (랜턴 뒤 = 벽 방향으로 살짝 붙음)
      [
        [-0.090,  0.040, wd*0.020,  0.5, PINE_D],
        [ 0.090,  0.040, wd*0.020, -0.5, PINE_D],
        [-0.070, -0.040, wd*0.018,  0.3, PINE_L],
        [ 0.070, -0.040, wd*0.018, -0.3, PINE_L],
        [ 0.000,  0.075, wd*0.028,  0.0, PINE_D],
        [-0.080, -0.090, wd*0.015,  0.5, PINE_L],
        [ 0.080, -0.090, wd*0.015, -0.5, PINE_L],
      ].forEach(([x, y, z, rz, col]) => {
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 7, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        s.scale.set(0.55, 0.36, 0.30);
        s.position.set(x, y, z);
        s.rotation.z = rz;
        g.add(s);
      });

      // 랜턴 프레임 (4모서리 기둥 + 상하판 + 지붕)
      const FH = 0.170, FW = 0.044;
      for (const [fx, fz] of [[-FW,-FW],[-FW,FW],[FW,-FW],[FW,FW]])
        mk(new THREE.BoxGeometry(0.009, FH, 0.009), GOLD, fx, 0, fz);
      mk(new THREE.BoxGeometry(0.100, 0.011, 0.100), GOLD_L, 0,  FH/2 + 0.005);
      mk(new THREE.BoxGeometry(0.100, 0.011, 0.100), GOLD,   0, -FH/2 - 0.005);
      const roof = mk(new THREE.ConeGeometry(0.056, 0.038, 4), GOLD_L, 0, FH/2 + 0.028);
      roof.rotation.y = Math.PI / 4;

      // 유리 본체 (반투명)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.090, FH - 0.015, 0.090),
        new THREE.MeshBasicMaterial({ color: 0xfffff0, transparent: true, opacity: 0.22, depthWrite: false }),
      );
      g.add(glass);

      // 촛불 글로우 — _bulbs에 등록해 은은하게 흔들림
      const candle = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 7, 6),
        new THREE.MeshBasicMaterial({ color: 0xffee88 }),
      );
      candle.position.y = -0.022;
      candle.userData = {
        bright: new THREE.Color(0xffee88),
        dim:    new THREE.Color(0xffee88).multiplyScalar(0.28),
        phase:  (idx / 7) * Math.PI * 2,
        speed:  0.55 + (idx % 4) * 0.18,
      };
      g.add(candle);
      _bulbs.push(candle);

      // 빨간 리본 (랜턴 위)
      const BM = new THREE.MeshBasicMaterial({ color: RED });
      const lG  = new THREE.TorusGeometry(0.030, 0.011, 6, 14);
      const ll = new THREE.Mesh(lG, BM); ll.position.set(-0.028, FH/2+0.012, 0); ll.rotation.z = -0.5; g.add(ll);
      const lr = new THREE.Mesh(lG, BM); lr.position.set( 0.028, FH/2+0.012, 0); lr.rotation.z =  0.5; g.add(lr);
      mk(new THREE.SphereGeometry(0.016, 8, 6), RED_L, 0, FH/2+0.016);         // 중앙 매듭
      const t1 = mk(new THREE.BoxGeometry(0.010, 0.034, 0.009), RED, -0.018, FH/2-0.008); t1.rotation.z =  0.25;
      const t2 = mk(new THREE.BoxGeometry(0.010, 0.034, 0.009), RED,  0.018, FH/2-0.008); t2.rotation.z = -0.25;

      // 호랑가시 잎 (하단)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const lf = new THREE.Mesh(
          new THREE.BoxGeometry(0.034, 0.013, 0.022),
          new THREE.MeshBasicMaterial({ color: HOLLY }),
        );
        lf.position.set(Math.cos(a)*0.038, -FH/2-0.013, Math.sin(a)*0.038);
        lf.rotation.y = a;
        g.add(lf);
      }
      // 빨간 열매 3개
      for (let i = 0; i < 3; i++) {
        const a = ((i + 0.5) / 3) * Math.PI * 2;
        mk(new THREE.SphereGeometry(0.011, 7, 5), BERRY,
           Math.cos(a)*0.020, -FH/2-0.010, Math.sin(a)*0.020);
      }

      outerG.add(g);
    });
    return outerG;
  }

  // ── 전광판 캔버스 갱신 ──
  const SIGN_BRIGHT = ['#ff2244','#ff7700','#ffdd00','#44ee44','#00bbff','#ff44cc'];
  function _drawSign(s) {
    const { cv, letters, litCount } = s;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const lw = W / letters.length;

    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, W, H);

    letters.forEach((ch, i) => {
      const lit = i < litCount;
      ctx.font = `bold ${Math.floor(H * 0.72)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lit) {
        const col = SIGN_BRIGHT[i % SIGN_BRIGHT.length];
        // 글자 뒤 은은한 glow 배경
        ctx.fillStyle = col + '28';
        ctx.fillRect(lw * i + 1, 2, lw - 2, H - 4);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 7;
      } else {
        ctx.fillStyle = '#1a0a0a';
        ctx.shadowBlur = 0;
      }
      ctx.fillText(ch, lw * i + lw / 2, H / 2);
      ctx.shadowBlur = 0;
    });
    s.tex.needsUpdate = true;
  }

  // ── 전광판 메쉬 생성 ──
  function _makeSignMesh(text, inX, y, z, ry) {
    const letters = text.split('');
    const CW = 38, CH = 66;
    const W = letters.length * CW, H = CH;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;

    const tex = new THREE.CanvasTexture(cv);
    const pw = letters.length * 0.098; // 메쉬 너비
    const ph = 0.19;                   // 메쉬 높이

    const g = new THREE.Group();
    g.position.set(inX, y, z);
    g.rotation.y = ry;

    // 테두리 프레임
    g.add(Object.assign(
      new THREE.Mesh(new THREE.BoxGeometry(pw + 0.022, ph + 0.022, 0.012),
        new THREE.MeshBasicMaterial({ color: 0x0a0a1a })),
    ));
    // 디스플레이 패널
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    panel.position.z = 0.007;
    g.add(panel);

    const s = { cv, tex, letters, litCount: 0, timer: 0 };
    _signs.push(s);
    _drawSign(s);
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

  // ── sc() 래퍼: 추가한 메쉬를 _xscMeshes 에 등록해 dispose 시 제거 ──
  function _xsc(m, k, p) {
    sc(m, k, p);
    _xscMeshes.push(m);
  }

  // ── 기존 창밖 나무에 크리스마스 전구 조명 달기 ──
  // 나무(k=1, p=90)의 현재 스크롤 위치를 기준으로 전구를 배치해
  // 테마를 늦게 켜도 나무 위치와 완벽히 싱크됨
  function _buildTreeLights() {
    const BC = [0xff1111, 0xffee00, 0x0055ff, 0x11cc33, 0xff6600, 0xff44cc];

    // scenery()에서 첫 번째 추가된 나무 trunk (k=1, p=90, sg=-1 i=0, 초기 x=-45)
    // 현재 position.x 를 기준점으로 삼아 wrap 오프셋을 반영
    const refItem = SCN.find(o => o.k === 1 && o.p === 90);
    const refX = refItem ? refItem.m.position.x : -45;

    // i번째 나무의 현재 x (wrap 주기 90 적용)
    function treeX(i) {
      const v = refX + i * 3.6;
      return ((v + 48) % 90 + 90) % 90 - 48;
    }

    for (const sg of [-1, 1]) {
      for (let i = 0; i < 25; i++) {
        const tx = treeX(i);                          // 현재 실제 x (wrap 반영)
        const tz = sg * (12 + (i % 4) * 2.4);
        for (let j = 0; j < 4; j++) {
          const angle = (j / 4) * Math.PI * 2 + i * 1.1;
          const hy  = 0.85 + j * 0.42;
          const r   = 0.70 - j * 0.10;
          const col = BC[(i * 4 + j) % BC.length];
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 5, 4),
            new THREE.MeshBasicMaterial({ color: col }),
          );
          bulb.position.set(
            tx + Math.cos(angle) * r,
            hy,
            tz + Math.sin(angle) * r,
          );
          bulb.userData = {
            bright: new THREE.Color(col),
            dim:    new THREE.Color(col).multiplyScalar(0.06),
            phase:  (i * 4 + j) * 0.52,
            speed:  1.8 + (j % 5) * 0.38,
          };
          _xsc(bulb, 1, 90); // 나무와 동일한 scroll 파라미터 → 이후 완벽 동기화
          _bulbs.push(bulb);
        }
      }
    }
  }

  // ── 외부 전구 스트링 (기차 양쪽 외벽) ──
  function _buildExteriorLights() {
    for (const sg of [-1, 1]) {
      const sg_grp = new THREE.Group();
      _extLightGroups[sg] = sg_grp;
      walls[sg].add(sg_grp);

      const zOut = sg * (CAR.W / 2 + 0.13); // 외벽 바깥 면

      // 얇은 전선 2줄 (상단·하단)
      for (const wy of [0.87, 1.97]) {
        const wire = new THREE.Mesh(
          new THREE.BoxGeometry(CAR.L - 0.1, 0.009, 0.009),
          new THREE.MeshBasicMaterial({ color: 0x0a0808 }),
        );
        wire.position.set(0, wy, zOut);
        sg_grp.add(wire);
      }

      // 하단 전선 — 다색 전구
      let ci = sg < 0 ? 0 : 2;
      for (let x = -(CAR.L / 2 - 0.5); x <= CAR.L / 2 - 0.4; x += 0.95) {
        const col = COLORS[ci % COLORS.length];
        ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 6, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.4, 1);
        bulb.position.set(x, 0.81, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim: new THREE.Color(col).multiplyScalar(0.05),
          phase: ci * 0.4 + (sg < 0 ? 0 : Math.PI),
          speed: 2.0 + (ci % 5) * 0.3,
        };
        sg_grp.add(bulb);
        _bulbs.push(bulb);
      }

      // 상단 전선 — 황금 전구
      ci = sg < 0 ? 1 : 3;
      for (let x = -(CAR.L / 2 - 0.5); x <= CAR.L / 2 - 0.4; x += 0.95) {
        const col = ci % 2 === 0 ? 0xffd700 : 0xffee44;
        ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.040, 6, 4),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.3, 1);
        bulb.position.set(x, 2.01, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim: new THREE.Color(col).multiplyScalar(0.04),
          phase: ci * 0.3,
          speed: 1.8 + (ci % 6) * 0.25,
        };
        sg_grp.add(bulb);
        _bulbs.push(bulb);
      }

      // 창문 기둥마다 빨간 리본 보우
      for (let i = 0; i < 7; i++) {
        const bx = (i - 3) * 1.9;
        const BM = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        const lG = new THREE.TorusGeometry(0.025, 0.009, 5, 12);
        const ll = new THREE.Mesh(lG, BM); ll.position.set(bx, 1.42, zOut - sg * 0.012); ll.rotation.set(0.4, 0, 0); sg_grp.add(ll);
        const lr = new THREE.Mesh(lG, BM); lr.position.set(bx, 1.42, zOut + sg * 0.012); lr.rotation.set(-0.4, 0, 0); sg_grp.add(lr);
        const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        ctr.position.set(bx, 1.42, zOut); sg_grp.add(ctr);
      }
    }
  }

  // ── 헤드셋용 미니 사슴뿔 1개 (sg: ±1) ──
  function _makeHPAntler(sg) {
    const g = new THREE.Group();
    const COL = 0x5a2808;
    const mk = (w, h, d, x, y, z, rz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: COL }));
      m.position.set(x, y, z);
      if (rz) m.rotation.z = rz;
      g.add(m);
    };
    mk(0.018, 0.13, 0.018,   0,       0.065,  0,       sg * 0.22); // 메인 줄기
    mk(0.014, 0.09, 0.014,   sg*0.018, 0.12,  0.028,  sg * 0.52); // 앞 갈래
    mk(0.014, 0.09, 0.014,   sg*0.018, 0.12, -0.028,  sg * 0.52); // 뒤 갈래
    mk(0.012, 0.06, 0.012,   sg*0.012, 0.085, 0.015,  sg * 0.80); // 중간 가지
    return g;
  }

  // ── 헤드셋 크리스마스 장식 추가 (P.headphones 자식으로) ──
  function _decorateHeadphones(hp) {
    // 사슴뿔 (밴드 양쪽 상단)
    for (const sg of [-1, 1]) {
      const a = _makeHPAntler(sg);
      a.position.set(sg * 0.14, 0.32, 0);
      hp.add(a);
      _hpDecorMeshes.push(a);
    }

    // 빨간 코 (밴드 앞면 중앙, 천천히 반짝)
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff1111 }),
    );
    nose.position.set(0, 0.295, 0.082);
    nose.userData = { bright: new THREE.Color(0xff2222), dim: new THREE.Color(0xbb0000), phase: 0, speed: 1.1 };
    hp.add(nose);
    _hpDecorMeshes.push(nose);
    _bulbs.push(nose);

    // 귀 컵 반짝이 보석 (각 컵에 3개)
    const GC = [0xff1111, 0xffee00, 0x0055ff, 0x11cc33, 0xff6600];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const col = GC[i % GC.length];
        const gem = new THREE.Mesh(
          new THREE.SphereGeometry(0.013, 6, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        gem.position.set(sx * 0.344, -0.038 + Math.sin(a) * 0.052, 0.015 + Math.cos(a) * 0.052);
        gem.userData = { bright: new THREE.Color(col), dim: new THREE.Color(col).multiplyScalar(0.05), phase: i * 1.1 + (sx < 0 ? 0 : Math.PI), speed: 2.2 + i * 0.4 };
        hp.add(gem);
        _hpDecorMeshes.push(gem);
        _bulbs.push(gem);
      }
    }

    _hpDecorDone = true;
  }

  // ── 루돌프 뿔 1개 생성 (sg: +1=오른쪽, -1=왼쪽) ──
  function _makeLocoAntler(sg) {
    const g = new THREE.Group();
    const COL = 0x5a2808;
    const mk = (w, h, d, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: COL }),
      );
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (ry) m.rotation.y = ry;
      if (rz) m.rotation.z = rz;
      g.add(m);
    };
    // 메인 줄기 (바깥으로 살짝 기울어짐)
    mk(0.085, 0.80, 0.085,  0,    0.40,  0,       0, 0, sg * 0.30);
    // 위쪽 두 갈래 (앞·뒤로 넓게 벌어짐)
    mk(0.072, 0.52, 0.072,  sg * 0.12, 0.76,  0.22,  0, 0, sg * 0.58);
    mk(0.072, 0.52, 0.072,  sg * 0.12, 0.76, -0.22,  0, 0, sg * 0.58);
    // 각 갈래 끝 작은 포인트
    mk(0.058, 0.26, 0.058,  sg * 0.20, 0.98,  0.34,  0, 0, sg * 0.45);
    mk(0.058, 0.26, 0.058,  sg * 0.20, 0.98, -0.34,  0, 0, sg * 0.45);
    // 중간 작은 가지
    mk(0.062, 0.36, 0.062,  sg * 0.08, 0.48,  0.12,  0, 0, sg * 0.80);
    return g;
  }

  // ── 기관차 크리스마스 장식 (전구·뿔·빨간코) ──
  function _buildLocoDecor() {
    const GAP    = 1.0, L_LOCO = 9.2;
    const LOCO_CX = CAR.L / 2 + GAP + L_LOCO / 2; // 13.4 (월드 x)
    const W      = CAR.W;
    const baseY  = 0.44;
    const cabL   = 3.4;
    const cabX   = L_LOCO / 2 - cabL / 2; // 2.9 (기관차 로컬 x)

    // 전면 볼록 최정점 (로컬 x)
    const faceR     = 6.0, faceHalfZ = W / 2 + 0.08;
    const facePeak  = L_LOCO / 2 - Math.sqrt(faceR * faceR - faceHalfZ * faceHalfZ) + faceR; // ≈ 5.23

    const g = new THREE.Group();
    g.position.x = LOCO_CX;
    scene.add(g);
    _locoDecorGroup = g;

    // ── 외부 전구 (엔진룸+운전실 양쪽) ──
    for (const sg of [-1, 1]) {
      const zOut = sg * (W / 2 + 0.13);

      // 전선
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(L_LOCO - 0.2, 0.009, 0.009),
        new THREE.MeshBasicMaterial({ color: 0x0a0808 }),
      );
      wire.position.set(0, 0.87, zOut);
      g.add(wire);

      // 다색 전구 (1m 간격)
      let ci = sg < 0 ? 2 : 4;
      for (let lx = -(L_LOCO / 2 - 0.5); lx <= L_LOCO / 2 - 0.4; lx += 1.0) {
        const col = COLORS[ci % COLORS.length]; ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 6, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.4, 1);
        bulb.position.set(lx, 0.81, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim:    new THREE.Color(col).multiplyScalar(0.05),
          phase:  ci * 0.4 + (sg < 0 ? 0 : Math.PI),
          speed:  2.0 + (ci % 5) * 0.3,
        };
        g.add(bulb);
        _bulbs.push(bulb);
      }

      // 운전실 창가 위 황금 전구
      ci = sg < 0 ? 0 : 2;
      for (let lx = cabX - cabL / 2 + 0.4; lx <= cabX + cabL / 2 - 0.3; lx += 0.9) {
        const col = ci % 2 === 0 ? 0xffd700 : 0xffee44; ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 4),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.3, 1);
        bulb.position.set(lx, 2.00, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim:    new THREE.Color(col).multiplyScalar(0.04),
          phase:  ci * 0.35,
          speed:  1.8 + (ci % 6) * 0.28,
        };
        g.add(bulb);
        _bulbs.push(bulb);
      }
    }

    // ── 루돌프 뿔 (운전실 꼭대기 양쪽) ──
    for (const sg of [-1, 1]) {
      const antler = _makeLocoAntler(sg);
      antler.position.set(cabX, 4.05, sg * 1.2);
      g.add(antler);
    }

    // ── 루돌프 빨간 코 (전면 최정점, 천천히 반짝) ──
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff1111 }),
    );
    nose.position.set(facePeak + 0.14, baseY + 1.28, 0);
    nose.userData = {
      bright: new THREE.Color(0xff2222),
      dim:    new THREE.Color(0xaa0000),
      phase:  0,
      speed:  1.1,
    };
    g.add(nose);
    _bulbs.push(nose);
  }

  // ── 뒤 객차 외부 전구 (주 객차와 동일 패턴, scene 직접 등록) ──
  function _buildRearCarLights() {
    const GAP    = 1.0;
    const L_REAR = 15.6;
    const CX     = -(CAR.L / 2 + GAP + L_REAR / 2); // ≈ -16.6

    for (const sg of [-1, 1]) {
      const sg_grp = new THREE.Group();
      sg_grp.position.x = CX;
      scene.add(sg_grp);
      _rearCarLightGroups.push(sg_grp);

      const zOut = sg * (CAR.W / 2 + 0.13);

      // 전선 2줄
      for (const wy of [0.87, 1.97]) {
        const wire = new THREE.Mesh(
          new THREE.BoxGeometry(L_REAR - 0.1, 0.009, 0.009),
          new THREE.MeshBasicMaterial({ color: 0x0a0808 }),
        );
        wire.position.set(0, wy, zOut);
        sg_grp.add(wire);
      }

      // 하단 — 다색 전구
      let ci = sg < 0 ? 1 : 3;
      for (let x = -(L_REAR / 2 - 0.5); x <= L_REAR / 2 - 0.4; x += 0.95) {
        const col = COLORS[ci % COLORS.length];
        ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 6, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.4, 1);
        bulb.position.set(x, 0.81, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim:    new THREE.Color(col).multiplyScalar(0.05),
          phase:  ci * 0.4 + (sg < 0 ? 0 : Math.PI),
          speed:  2.0 + (ci % 5) * 0.3,
        };
        sg_grp.add(bulb);
        _bulbs.push(bulb);
      }

      // 상단 — 황금 전구
      ci = sg < 0 ? 0 : 2;
      for (let x = -(L_REAR / 2 - 0.5); x <= L_REAR / 2 - 0.4; x += 0.95) {
        const col = ci % 2 === 0 ? 0xffd700 : 0xffee44;
        ci++;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.040, 6, 4),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.3, 1);
        bulb.position.set(x, 2.01, zOut);
        bulb.userData = {
          bright: new THREE.Color(col),
          dim:    new THREE.Color(col).multiplyScalar(0.04),
          phase:  ci * 0.3,
          speed:  1.8 + (ci % 6) * 0.25,
        };
        sg_grp.add(bulb);
        _bulbs.push(bulb);
      }

      // 창문 기둥마다 리본 보우 (뒤 객차 창 간격 동일 1.9)
      for (let i = 0; i < 7; i++) {
        const bx = (i - 3) * 1.9;
        const BM = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        const lG = new THREE.TorusGeometry(0.025, 0.009, 5, 12);
        const ll = new THREE.Mesh(lG, BM); ll.position.set(bx, 1.42, zOut - sg * 0.012); ll.rotation.set(0.4, 0, 0); sg_grp.add(ll);
        const lr = new THREE.Mesh(lG, BM); lr.position.set(bx, 1.42, zOut + sg * 0.012); lr.rotation.set(-0.4, 0, 0); sg_grp.add(lr);
        const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        ctr.position.set(bx, 1.42, zOut); sg_grp.add(ctr);
      }
    }
  }

  // ── 지붕 전구 (바글바글 덮기) ──
  function _buildRoofLights() {
    // 아치 지붕 y 위치 계산
    const archR = 10;
    const arcHalf = Math.asin((CAR.W / 2 + 0.22) / archR);
    const cylCY = 2.55 - archR * Math.cos(arcHalf);
    const roofY = (z) => cylCY + Math.sqrt(Math.max(0, archR * archR - z * z)) + 0.04;

    const _fill = (cx, carLen) => {
      const grp = new THREE.Group();
      grp.position.x = cx;
      let ci = Math.round(Math.abs(cx)) % COLORS.length;
      for (let lx = -(carLen / 2 - 0.3); lx <= carLen / 2 - 0.3; lx += 0.44) {
        for (let lz = -(CAR.W / 2 - 0.3); lz <= CAR.W / 2 - 0.3; lz += 0.44) {
          const col = COLORS[ci % COLORS.length]; ci++;
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.030, 5, 4),
            new THREE.MeshBasicMaterial({ color: col }),
          );
          bulb.position.set(lx, roofY(lz), lz);
          bulb.userData = {
            bright: new THREE.Color(col),
            dim:    new THREE.Color(col).multiplyScalar(0.04),
            phase:  ci * 0.41,
            speed:  1.6 + (ci % 9) * 0.22,
          };
          grp.add(bulb);
          _bulbs.push(bulb);
        }
      }
      scene.add(grp);
      _roofLightGroups.push(grp);
    };

    _fill(0, CAR.L); // 주 객차
    _fill(-(CAR.L / 2 + 1.0 + 15.6 / 2), 15.6); // 뒤 객차
  }

  // ── 산타 썰매 3D 모델 생성 ──
  function _buildSantaGroup() {
    const g = new THREE.Group();
    const bm  = (col) => new THREE.MeshBasicMaterial({ color: col });

    // 썰매 본체 (빨강)
    const sledge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.55), bm(0xcc1111));
    sledge.position.set(-0.1, 0.14, 0); g.add(sledge);
    // 썰매 등받이
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.55), bm(0xee2222));
    back.position.set(-0.55, 0.37, 0); g.add(back);
    // 황금 러너 2개
    for (const sz of [-0.30, 0.30]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.055, 0.05), bm(0xd4a017));
      r.position.set(0, -0.02, sz); g.add(r);
    }

    // 산타 (썰매 안)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.32), bm(0xdd1111));
    body.position.set(-0.22, 0.42, 0); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), bm(0xf5c89a));
    head.position.set(-0.22, 0.75, 0); g.add(head);
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.055, 8), bm(0xffffff));
    hatBrim.position.set(-0.22, 0.87, 0); g.add(hatBrim);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.26, 8), bm(0xdd1111));
    hat.position.set(-0.22, 1.03, 0); g.add(hat);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), bm(0xffffff));
    beard.scale.set(1, 0.55, 0.9); beard.position.set(-0.14, 0.67, 0.08); g.add(beard);

    // 순록 3마리 (루돌프 맨 앞)
    [1.5, 2.65, 3.8].forEach((rx, ri) => {
      const dg = new THREE.Group();
      dg.position.set(rx, 0.1, 0);
      const brownCol = ri === 0 ? 0x7a3c10 : 0x8b4513;
      // 몸
      const db = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.22), bm(brownCol));
      db.position.y = 0.28; dg.add(db);
      // 머리
      const dh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.17, 0.17), bm(brownCol));
      dh.position.set(0.33, 0.40, 0); dg.add(dh);
      // 코 (루돌프: 빨간 반짝이)
      const noseCol = ri === 0 ? 0xff2222 : 0x5a3010;
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.050, 6, 5), bm(noseCol));
      nose.position.set(0.44, 0.39, 0); dg.add(nose);
      if (ri === 0) {
        nose.userData = { bright: new THREE.Color(0xff2222), dim: new THREE.Color(0x880000), phase: 0, speed: 1.8 };
        _bulbs.push(nose);
      }
      // 뿔 2개
      for (const az of [-0.07, 0.07]) {
        const ant = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.035), bm(0x6b3a1f));
        ant.position.set(0.26, 0.54, az); ant.rotation.z = az > 0 ? -0.35 : 0.35; dg.add(ant);
      }
      // 다리 4개
      [[-0.15,-0.07],[-0.15,0.07],[0.15,-0.07],[0.15,0.07]].forEach(([lx,lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.20, 0.055), bm(brownCol));
        leg.position.set(lx, 0.08, lz); dg.add(leg);
      });
      // 고삐
      const reinLen = ri === 0 ? 1.4 : 1.1;
      const rein = new THREE.Mesh(new THREE.BoxGeometry(reinLen, 0.018, 0.018), bm(0x4a2a0a));
      rein.position.set(rx - reinLen / 2 - 0.5, 0.28, 0); g.add(rein);
      g.add(dg);
    });

    g.visible = false;
    scene.add(g);
    return g;
  }

  // ── 산타 매 프레임 업데이트 ──
  // 경로: 기차 바로 위(z=0, y≈4) 천천히 직선 → 기차 끝 지나면 달 방향으로 솟아 사라짐
  let _santaPhase = 'fly';

  function _tickSanta(dt) {
    _santaTimer -= dt;
    if (!_santaOn) {
      if (_santaTimer > 0) return;
      _santaOn = true;
      _santaElapsed = 0;
      _santaPhase = 'fly';
      _santaDir = -1; // 항상 기차 반대 방향 (-x)
      // 경로 1: 지붕 위 / 2: 오른쪽 창문 옆 / 3: 왼쪽 창문 옆
      const route = Math.floor(Math.random() * 3);
      if (route === 0) {
        _santaBaseY = 5.5 + Math.random() * 0.8;
        _santa.position.set(CAR.L / 2 + 45, _santaBaseY, 0);
      } else if (route === 1) {
        _santaBaseY = 1.4 + Math.random() * 0.2;
        _santa.position.set(CAR.L / 2 + 45, _santaBaseY, CAR.W / 2 + 1.6);
      } else {
        _santaBaseY = 1.4 + Math.random() * 0.2;
        _santa.position.set(CAR.L / 2 + 45, _santaBaseY, -(CAR.W / 2 + 1.6));
      }
      _santa.rotation.y = Math.PI;
      _santa.visible = true;
      _santaTimer = 5;
      _spkTimer = 0;
      return;
    }
    _santaElapsed += dt;

    if (_santaPhase === 'fly') {
      // 기차 위 천천히 직선 비행 + 가벼운 보빙
      _santa.position.x += _santaDir * 4.5 * dt;
      // 큰 물결 + 작은 떨림 조합으로 자연스러운 볼록볼록
      _santa.position.y = _santaBaseY
        + Math.sin(_santaElapsed * 0.85) * 0.65
        + Math.sin(_santaElapsed * 2.1)  * 0.18;
      // y 속도 비례 살짝 앞뒤 기울기 (내려갈 때 앞으로, 올라갈 때 뒤로)
      const yVel = Math.cos(_santaElapsed * 0.85) * 0.65 * 0.85;
      _santa.rotation.x = yVel * 0.12;
      // 반짝이 파티클 뿌리기
      _spkTimer -= dt;
      if (_spkTimer <= 0) {
        _spkTimer = 0.07;
        for (let i = 0; i < 3; i++) _spawnSparkle();
      }
      // 기차 끝 지나면 달 방향으로 전환
      // 화면 밖으로 나가면 산타 + 남은 반짝이 모두 제거
      if (_santa.position.x < -(CAR.L / 2 + 50)) {
        _santaOn = false; _santa.visible = false;
        for (let i = _sparkles.length - 1; i >= 0; i--) {
          const s = _sparkles[i];
          scene.remove(s); s.geometry.dispose(); s.material.dispose();
        }
        _sparkles.length = 0;
      }
    }

    // 반짝이 파티클 갱신
    for (let i = _sparkles.length - 1; i >= 0; i--) {
      const s = _sparkles[i];
      s.userData.life -= dt;
      s.position.y += s.userData.vy * dt;
      if (s.userData.life <= 0) {
        scene.remove(s); s.geometry.dispose(); s.material.dispose();
        _sparkles.splice(i, 1);
      } else {
        s.material.color.copy(s.userData.bright).multiplyScalar(Math.max(0, s.userData.life / s.userData.maxLife));
      }
    }
  }

  function _spawnSparkle() {
    const col = _SPKCOLS[Math.floor(Math.random() * _SPKCOLS.length)];
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 + Math.random() * 0.065, 4, 3),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    m.position.set(
      _santa.position.x + (Math.random() - 0.5) * 2.0,
      _santa.position.y + (Math.random() - 0.5) * 1.0,
      _santa.position.z + (Math.random() - 0.5) * 1.2,
    );
    const life = 1.5 + Math.random() * 1.5;
    m.userData = { vy: -0.4 - Math.random() * 0.5, life, maxLife: life, bright: new THREE.Color(col) };
    scene.add(m);
    _sparkles.push(m);
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

      // 짐칸 앞 레일 위치: scene.js SY+0.13, frz = sg*(CAR.W/2 - 0.257)
      const frZ = sg * (CAR.W / 2 - 0.257);

      // 레일을 자연스럽게 감은 전선 — y·z 양방향 사인파
      const wirePts = [];
      for (let i = 0; i <= 80; i++) {
        const t  = i / 80;
        const x  = -7.1 + 14.2 * t;
        const y  = WIRE_Y + Math.sin(t * Math.PI * 14) * 0.020;          // 위아래 굴곡
        const z  = frZ + sg * Math.sin(t * Math.PI * 14 + Math.PI / 2) * 0.022; // 앞뒤 감김
        wirePts.push(new THREE.Vector3(x, y, z));
      }
      const wireCurve = new THREE.CatmullRomCurve3(wirePts);
      const wireMesh  = new THREE.Mesh(
        new THREE.TubeGeometry(wireCurve, 90, 0.005, 5, false),
        new THREE.MeshBasicMaterial({ color: 0x1a1208 }),
      );
      sg_group.add(wireMesh);

      // 덩굴 위 은은한 노란 반짝임 점 22개
      const GLOW_COL = new THREE.Color(0xffee55);
      for (let i = 0; i < 22; i++) {
        const pt   = wireCurve.getPoint((i + 0.5) / 22);
        const dot  = new THREE.Mesh(
          new THREE.SphereGeometry(0.016, 5, 4),
          new THREE.MeshBasicMaterial({ color: GLOW_COL }),
        );
        dot.position.copy(pt);
        dot.userData = {
          bright: GLOW_COL.clone(),
          dim:    GLOW_COL.clone().multiplyScalar(0.04),
          phase:  (i / 22) * Math.PI * 6 + (sg < 0 ? 0 : Math.PI),
          speed:  1.2 + (i % 7) * 0.18,
        };
        sg_group.add(dot);
        _bulbs.push(dot);
      }

      let ci = sg < 0 ? 0 : 2;
      for (let x = -7.1; x <= 7.15; x += PITCH) {
        const col = COLORS[ci % COLORS.length];
        ci++;

        // 흰 소켓
        const socket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.019, 0.015, 0.06, 6),
          new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }),
        );
        socket.position.set(x, WIRE_Y - 0.038, frZ);
        sg_group.add(socket);

        // 전구 — 세로로 긴 뾰족 타원형 (y축 1.5배 스케일)
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.062, 8, 7),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        bulb.scale.set(1, 1.5, 1);
        bulb.position.set(x, BULB_Y, frZ);
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

    // 끝벽 배너 숨기기 (기본 테마 전용)
    if (typeof sideBanners !== 'undefined')
      sideBanners.forEach(b => { b.visible = false; });

    // 옷걸이 숨기기 + 크리스마스 랜턴 추가
    for (const sg of [-1, 1]) {
      if (typeof wallHooks !== 'undefined' && wallHooks[sg])
        wallHooks[sg].visible = false;
      const lg = _makeLanternGroup(sg);
      _lanternGroups[sg] = lg;
      walls[sg].add(lg);
    }

    // 출입문 창문 리스 — ends[e] 에 넣어 끝벽과 함께 가시성 토글
    for (const e of [-1, 1]) {
      const wx = e * (CAR.L / 2 - 0.19); // 창문 안쪽 면 바로 앞
      const wreath = _makeWreath();
      wreath.position.set(wx, 1.62, 0);
      scene.add(wreath);
      ends[e].push(wreath);
      _wreaths[e] = wreath;
    }

    // 출입문 좌우 전광판 — ends[e]에 넣어 끝벽과 함께 가시성 토글
    // 왼쪽(z=-1.625): merry  /  오른쪽(z=+1.625): christmas!
    for (const e of [-1, 1]) {
      const inX = e * (CAR.L / 2 - 0.09);
      const ry  = (-e * Math.PI) / 2;
      const sg = new THREE.Group();
      sg.add(_makeSignMesh('merry christmas', inX, 1.98, -1.625, ry));
      sg.add(_makeSignMesh('happy new year',  inX, 1.98,  1.625, ry));
      scene.add(sg);
      ends[e].push(sg);
      _signGroups[e] = sg;
    }

    // 외부 장식 (주 객차 외벽 전구·리본, 뒤 객차 외벽 전구, 기관차 장식, 창밖 나무 전구)
    _buildExteriorLights();
    _buildRearCarLights();
    _buildLocoDecor();
    _buildTreeLights();
    _buildRoofLights();
    _santa = _buildSantaGroup();
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

    // 끝벽 배너 복원
    if (typeof sideBanners !== 'undefined')
      sideBanners.forEach(b => { b.visible = true; });

    // 랜턴 정리 + 옷걸이 복원
    for (const sg of [-1, 1]) {
      const lg = _lanternGroups[sg];
      if (lg) {
        lg.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        walls[sg].remove(lg);
        _lanternGroups[sg] = null;
      }
      if (typeof wallHooks !== 'undefined' && wallHooks[sg])
        wallHooks[sg].visible = true;
    }

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

    // 전광판 정리
    _signs.length = 0;
    for (const e of [-1, 1]) {
      const sg = _signGroups[e];
      if (sg) {
        sg.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        scene.remove(sg);
        const idx = ends[e].indexOf(sg);
        if (idx !== -1) ends[e].splice(idx, 1);
        _signGroups[e] = null;
      }
    }

    // 외부 전구 그룹 정리
    for (const sg of [-1, 1]) {
      const eg = _extLightGroups[sg];
      if (eg) {
        eg.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        walls[sg].remove(eg);
        delete _extLightGroups[sg];
      }
    }

    // 헤드셋 장식 정리
    if (_hpDecorDone && typeof P !== 'undefined' && P && P.headphones) {
      for (const m of _hpDecorMeshes) {
        P.headphones.remove(m);
        m.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      }
    }
    _hpDecorMeshes.length = 0;
    _hpDecorDone = false;

    // 기관차 장식 정리
    if (_locoDecorGroup) {
      _locoDecorGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      scene.remove(_locoDecorGroup);
      _locoDecorGroup = null;
    }

    // 뒤 객차 외부 전구 정리
    for (const g of _rearCarLightGroups) {
      g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      scene.remove(g);
    }
    _rearCarLightGroups.length = 0;

    // 산타 썰매 + 반짝이 정리
    if (_santa) {
      _santa.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      scene.remove(_santa);
      _santa = null; _santaOn = false; _santaTimer = 20;
    }
    for (const s of _sparkles) { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }
    _sparkles.length = 0;

    // 지붕 전구 정리
    for (const g of _roofLightGroups) {
      g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      scene.remove(g);
    }
    _roofLightGroups.length = 0;

    // 나무 전구 메쉬 — scene 과 SCN 에서 모두 제거
    for (const m of _xscMeshes) {
      scene.remove(m);
      const idx = SCN.findIndex(o => o.m === m);
      if (idx !== -1) SCN.splice(idx, 1);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    _xscMeshes.length = 0;
  }

  // ── 매 프레임: 전구 반짝임 + 전광판 + 헤드셋 장식 1회 적용 ──
  function tick(dt) {
    // P.headphones 준비되면 1회 크리스마스 장식 추가
    if (!_hpDecorDone && typeof P !== 'undefined' && P && P.headphones) {
      _decorateHeadphones(P.headphones);
    }

    // 산타 썰매 업데이트
    if (_santa) _tickSanta(dt);

    // 지붕 전구 — trainRoof 가시성과 동기화 (실내에서 카메라가 지붕 안보일 때 같이 숨김)
    if (typeof trainRoof !== 'undefined' && _roofLightGroups.length) {
      const roofVis = trainRoof.visible;
      for (const g of _roofLightGroups) g.visible = roofVis;
    }

    for (const b of _bulbs) {
      const u = b.userData;
      u.phase += dt * u.speed;
      b.material.color.copy(Math.sin(u.phase) > 0 ? u.bright : u.dim);
    }
    for (const s of _signs) {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.litCount = s.litCount >= s.letters.length + 2 ? 0 : s.litCount + 1;
        s.timer = 0.28;
        _drawSign(s);
      }
    }
  }

  return { build, dispose, tick };
})();

// 테마 관리자에 등록
Theme.register('christmas', ChristmasTheme);
