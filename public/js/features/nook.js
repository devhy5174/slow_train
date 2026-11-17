/* =====================================================
   10. 숨는 곳 — 의자 등받이 사이 틈 (nook.js)
   중앙 4인석 오른쪽 의자 뒤와 일반석 등받이 사이의 빈 공간 2곳(양쪽 1곳씩).
   힌트용 작은 빛나는 구체가 있어 '저게 뭐지?' 하고 클릭하면 발견할 수 있습니다.
   임의 규칙: 숨어 있으면 승무원이 검표하지 않음 (유지 여부는 기획 확인 필요)
   ===================================================== */

// 숨는 곳 데이터(좌/우 1곳씩)와 터치 영역 목록
const NOOKS = [-1, 1].map((sg) => ({
  id: "nook" + (sg < 0 ? "L" : "R"),
  x: 2.45,
  z: sg * 1.6,
  side: sg,
}));
const nookHits = [];
const nookGlows = []; // 힌트용 빛나는 구체 목록
let pendingNook = null; // '들어가 볼까?' 팝업에서 선택 대기 중인 숨는 곳

// 힌트 구체에 쓸 캔버스 텍스처(부드러운 원형 그라데이션 발광)
function makeGlowTexture() {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(120, 255, 120, 1.0)"); // 중심: 밝은 초록빛
  g.addColorStop(0.4, "rgba(60,  220, 80,  0.6)");
  g.addColorStop(1, "rgba(30,  180, 50,  0.0)"); // 가장자리: 투명
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

// 숨는 곳 터치 영역(보이지 않는 박스) + 힌트 구체 2쌍을 장면에 추가
// 히트박스: 벽 바로 안쪽 깊숙이 배치 — 등받이 뒤를 꼼꼼히 클릭해야 발견
// 힌트 구체: 히트박스보다 살짝 앞(z * 2.1)에 배치 — 살짝 보이지만 뭔지는 모르게
function makeNooks() {
  const glowTex = makeGlowTexture();
  NOOKS.forEach((n) => {
    // 보이지 않는 히트박스(클릭 감지용)
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 0.12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    m.position.set(n.x, 0.3, n.side * 2.4);
    m.userData = n;
    scene.add(m);
    nookHits.push(m);

    // 힌트용 작은 빛나는 Sprite — 항상 카메라를 향하므로 어느 각도에서도 동그랗게 보임
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    sp.scale.set(0.18, 0.18, 1);
    sp.position.set(n.x, 0.52, n.side * 2.1);
    sp.userData = n; // 클릭해도 askNook 발동
    scene.add(sp);
    nookGlows.push(sp);
    nookHits.push(sp); // 레이캐스터에 등록
  });
}

// 매 프레임 힌트 구체 pulse 애니메이션 (scale + opacity 출렁임)
function nookTick() {
  const t = Date.now() / 1000;
  nookGlows.forEach((sp, i) => {
    const wave = Math.sin(t * 2.2 + i * Math.PI); // 0.86초 주기, 좌우 위상 반전
    const s = 0.14 + 0.06 * wave; // 0.08 ~ 0.20 크기
    sp.scale.set(s, s, 1);
    sp.material.opacity = 0.55 + 0.3 * wave; // 0.25 ~ 0.85 투명도
  });
}

// 숨는 곳을 터치하면 '들어가 볼까?' 팝업을 띄움(표 검사 중이거나 이미 점유 시 무시)
function askNook(n) {
  if (GameState.inspecting) return;
  // 이미 누군가 숨어 있으면 입장 불가 (싱글플레이 + 향후 멀티플레이 대비)
  const occupied = [P, ...NPCS].some(
    (a) => a.state === "hide" && a.nook && a.nook.id === n.id,
  );
  if (occupied) {
    toast("이미 누군가 숨어 있어요.");
    return;
  }
  pendingNook = n;
  $("nkModal").hidden = false;
}

// '들어가기': 통로로 걸어가 틈 안으로 들어가 웅크림
function enterNook(n) {
  leaveSpot(P);
  cancelRes(P);
  P.pendNook = n;
  P.path = [
    { x: n.x, z: 0 },
    { x: n.x, z: n.side * 1.6 },
  ];
}

// 틈에 도착하면 웅크려 앉은 상태(hide)로 전환
function hideIn(a, n) {
  a.pendNook = null;
  a.state = "hide";
  a.nook = n;
  a.path = [];
  a.g.position.set(n.x, 0, n.z);
  face(a, 0, -n.side);
  animate(a, false, 0);
}

// '나가기': 틈에서 나와 통로 가장자리에 섬
function exitNook(a) {
  if (a.state !== "hide") return;
  const n = a.nook;
  a.nook = null;
  a.state = "idle";
  a.g.position.set(n.x, 0, n.side * AISLE);
  animate(a, false, 0);
}

// 앉아 있거나 숨어 있다면 그 자리에서 빠져나옴(이동 명령 전에 공통 사용)
function leaveSpot(a) {
  if (a.state === "sit") standUp(a);
  else if (a.state === "hide") exitNook(a);
}
