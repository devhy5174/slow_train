/* =====================================================
   커튼 (curtain.js)
   창문마다 옆으로 치고 닫을 수 있는 커튼을 추가합니다.
   - 앉아 있을 때만, 같은 벽쪽 + 가까운 x 범위 커튼만 조작 가능
   - 플레이어 로컬 전용 — Supabase 연동 없음
   ===================================================== */

const curtainMeshes = [];
const curtainHits   = [];

function buildCurtains() {
  const pitch = 1.9;

  for (const sg of [-1, 1]) {
    const zc = sg * (CAR.W / 2 - 0.1); // 벽 안쪽면 약간 띄움

    for (let i = 0; i < 8; i++) {
      const wx = (i - 3.5) * pitch;

      // 커튼 레일 (상단 얇은 막대)
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.022, 0.022),
        mat(0x888888),
      );
      rail.position.set(wx, 1.905, zc);
      scene.add(rail);

      // 커튼 메쉬
      const curtain = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 1.0, 0.018),
        mat(0xf0dfc0), // 크림/베이지
      );
      const openX = wx - 0.432; // 왼쪽 끝 고정, 오른쪽으로 열림
      // 기본 상태: 열린 채로 시작
      curtain.position.set(openX, 1.4, zc);
      curtain.scale.x = 0.20;
      curtain.userData = {
        closed:   false,
        originX:  wx,
        openX,
        targetX:  openX,
        targetSX: 0.20,
      };
      scene.add(curtain);
      curtainMeshes.push(curtain);

      // 클릭 감지용 투명 히트 박스 (창 전체 범위로 커버 — 열린 상태에도 클릭 가능)
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 1.1, 0.08),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.set(wx, 1.42, zc);
      hit.userData = { curtainIdx: curtainMeshes.length - 1, wx, zc };
      scene.add(hit);
      curtainHits.push(hit);
    }
  }
}

// 커튼 토글 — 착석 중이고 같은 벽/가까운 x인 경우만 허용
function toggleCurtain(idx) {
  if (P.state !== 'sit' || !P.seat) {
    toast('자리에 앉아 있을 때만 커튼을 움직일 수 있어요.');
    return;
  }

  const { wx, zc } = curtainHits[idx].userData;
  const sameSide  = Math.sign(zc) === Math.sign(P.seat.z);
  const nearEnough = Math.abs(wx - P.seat.x) < 1.1;

  if (!sameSide || !nearEnough) {
    toast('내 자리 옆 커튼만 움직일 수 있어요.');
    return;
  }

  const c = curtainMeshes[idx];
  c.userData.closed = !c.userData.closed;
  if (c.userData.closed) {
    c.userData.targetX  = c.userData.originX;
    c.userData.targetSX = 1.0;
    toast('커튼을 닫았어요.');
  } else {
    c.userData.targetX  = c.userData.openX;
    c.userData.targetSX = 0.20; // 왼쪽에 얇게 모임
    toast('커튼을 열었어요.');
  }
}

// 매 프레임: position.x, scale.x 동시 보간 → 옆으로 치는 효과
function tickCurtains(dt) {
  const spd = Math.min(1, dt * 7);
  for (const c of curtainMeshes) {
    // 가로 위치 이동
    if (Math.abs(c.position.x - c.userData.targetX) > 0.001)
      c.position.x += (c.userData.targetX - c.position.x) * spd;
    else
      c.position.x = c.userData.targetX;
    // 가로 너비 압축
    if (Math.abs(c.scale.x - c.userData.targetSX) > 0.001)
      c.scale.x += (c.userData.targetSX - c.scale.x) * spd;
    else
      c.scale.x = c.userData.targetSX;
  }
}
