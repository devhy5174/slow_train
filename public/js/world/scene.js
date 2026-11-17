/* =====================================================
   4. 장면 (scene.js) — 객차·좌석·창문·창밖 풍경 3D 생성
   모든 모델은 외부 에셋 없이 코드로 만든 도형입니다.
   ===================================================== */

// 색상 상수: 좌석 파랑 / 짙은 남색 / 크림색(벽)
const BLUE = 0x2f62b0, NAVY = 0x1c3a6b, CREAM = 0xefe4cc;

// 박스 메쉬를 만들어 parent에 추가하는 공용 헬퍼(색·위치·그림자 설정)
function box(parent, w, h, d, color, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

// 2인용 파란 좌석(벤치) 1개 생성 — BENCHES 데이터 기준으로 배치
function bench(b) {
  const g = new THREE.Group(); g.position.set(b.x, 0, b.side * 1.6); g.rotation.y = b.yaw;
  box(g, 0.62, 0.36, 1.78, NAVY, 0, 0.18, 0); // 좌석 받침
  for (const z of [-0.45, 0.45]) {
    box(g, 0.66, 0.16, 0.84, BLUE, 0.02, 0.44, z);                      // 방석
    box(g, 0.16, 0.9, 0.84, BLUE, -0.3, 0.95, z).rotation.z = 0.1;      // 등받이(살짝 기울임)
    box(g, 0.18, 0.28, 0.55, 0xf4efe3, -0.36, 1.5, z);                  // 머리받침 흰 덮개
  }
  box(g, 0.5, 0.1, 0.08, NAVY, 0, 0.62, 0); // 두 좌석 사이 팔걸이
  scene.add(g);
}

// 4인석 중앙 테이블 1개 생성(상판+다리+받침)
function table(z) {
  const g = new THREE.Group(); g.position.set(0, 0, z);
  box(g, 0.9, 0.07, 1.7, 0xb07a45, 0, 0.78, 0); // 상판
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.78, 12), mat(0x6b4a2b));
  leg.position.y = 0.39; leg.castShadow = true; g.add(leg); // 다리
  box(g, 0.5, 0.04, 0.5, 0x6b4a2b, 0, 0.02, 0); // 바닥 받침
  scene.add(g);
}

// 객차 한쪽 창가 벽 생성(창문 8개 + 무늬 띠). sg: -1 왼쪽 / +1 오른쪽
// 카메라가 그쪽 바깥에 있으면 game.js 루프에서 숨겨 내부가 보이게 함
function wallSide(sg) {
  const L = CAR.L, zw = sg * CAR.W / 2, pitch = 1.9, g = new THREE.Group(); scene.add(g); walls[sg] = g;
  box(g, L, 0.9, 0.15, CREAM, 0, 0.45, zw); box(g, L, 0.7, 0.15, CREAM, 0, 2.25, zw);   // 창 아래/위 벽
  for (let i = 0; i < 7; i++) box(g, 0.7, 1.0, 0.15, CREAM, (i - 3) * pitch, 1.4, zw);  // 창 사이 기둥
  box(g, 0.55, 1.0, 0.15, CREAM, -7.525, 1.4, zw); box(g, 0.55, 1.0, 0.15, CREAM, 7.525, 1.4, zw); // 양 끝 기둥
  // 안쪽 벽면의 빨강/노랑 장식 띠
  box(g, L, 0.1, 0.02, 0xe8553d, 0, 0.75, zw - sg * 0.09, false); box(g, L, 0.05, 0.02, 0xf2b632, 0, 0.62, zw - sg * 0.09, false);
  // 창문 유리(반투명 흰색) 8장
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    p.position.set((i - 3.5) * pitch, 1.4, zw); g.add(p);
  }
}

// 객차 뼈대 생성: 바닥·차체·통로 카펫·양쪽 창가 벽·양 끝 벽과 출입문
function shell() {
  const L = CAR.L, W = CAR.W, H = CAR.H;
  box(scene, L, 0.2, W, 0xd9b48a, 0, -0.1, 0);               // 바닥
  box(scene, L + 0.2, 0.4, W + 0.2, 0x34383f, 0, -0.4, 0);   // 차체 하부
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.3), mat(0xa8473a)); // 통로 카펫
  aisle.rotation.x = -Math.PI / 2; aisle.position.y = 0.006; aisle.receiveShadow = true; scene.add(aisle);
  wallSide(-1); wallSide(1);
  for (const e of [-1, 1]) ends[e].push( // 양 끝 벽 + 출입문 위 벽
    box(scene, 0.15, H, 1.95, CREAM, e * L / 2, H / 2, -1.625), box(scene, 0.15, H, 1.95, CREAM, e * L / 2, H / 2, 1.625),
    box(scene, 0.15, 0.6, 1.3, CREAM, e * L / 2, 2.3, 0));
}

// ----- 창밖 풍경 -----
const TRAIN = 3; // 열차 속도(풍경이 지나가는 속도): 천천히

// 움직이는 풍경 오브젝트 등록 헬퍼. k: 시차(멀수록 느리게), p: 반복 주기
function sc(m, k, p) { scene.add(m); SCN.push({ m, k, p }); return m; }

// 창밖 풍경 생성(언덕·산·논밭·나무·집). game.js update()에서 -x 방향으로 흘러가며 반복
function scenery() {
  const sph = (c) => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat(c)); // 언덕용 구
  for (const sg of [-1, 1]) {
    // 가까운 언덕
    [-40, -24, -8, 8, 24, 40].forEach((x, i) => {
      const m = sph([0x6fa05a, 0x5d9150, 0x7aad63][i % 3]);
      m.scale.set(8 + (i % 3) * 2, 3 + (i % 2) * 1.2, 6); m.position.set(x, -0.62, sg * (22 + (i % 3) * 3)); sc(m, 0.5, 96);
    });
    // 먼 산(가장 느리게 움직임)
    [-36, -12, 12, 36].forEach((x, i) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(11, 13, 6), mat(i % 2 ? 0x7d98ae : 0x8aa3b8));
      m.position.set(x, 5.8, sg * 42); sc(m, 0.15, 96);
    });
    // 논밭(두 줄, 색이 번갈아)
    [5.5, 9].forEach((z, row) => {
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 2.6), mat((i + row) % 2 ? 0xc9c26a : 0xa8c25a));
        m.rotation.x = -Math.PI / 2; m.position.set(-45 + i * 8, -0.6, sg * z); sc(m, 1, 96);
      }
    });
    // 나무(줄기 + 잎)
    for (let i = 0; i < 25; i++) {
      const x = -45 + i * 3.6, z = sg * (12 + (i % 4) * 2.4);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8), mat(0x6b4a2b)); t.position.set(x, -0.02, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 8), mat(0x3f7d46)); c.position.set(x, 1.5, z);
      t.castShadow = c.castShadow = true; sc(t, 1, 90); sc(c, 1, 90);
    }
    // 작은 마을(집 몸체 + 지붕)
    for (let i = 0; i < 4; i++) {
      const x = -36 + i * 24, z = sg * (9 + (i % 2) * 1.5);
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.8), mat([0xf2e6d0, 0xe8c9a0][i % 2])); w.position.set(x, 0.1, z);
      const r = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.0, 4), mat(0xb5523b)); r.rotation.y = Math.PI / 4; r.position.set(x, 1.3, z);
      w.castShadow = r.castShadow = true; sc(w, 1, 96); sc(r, 1, 96);
    }
  }
}
