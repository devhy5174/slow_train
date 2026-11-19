/* =====================================================
   3. 렌더링 전역 + 공용 헬퍼 (core.js)
   Three.js 오브젝트와 행위자 참조, 입력 상태를 선언합니다.
   게임 흐름 상태(ended·inspecting 등)는 state.js(GameState)에서 관리합니다.

   renderer·scene·cam: Three.js 기본 객체
   ctl: 카메라 컨트롤  ray: 클릭 판정용 레이캐스터
   hits: 좌석 터치 영역  walls: 좌우 벽 그룹
   ends: 양 끝 벽  SCN: 움직이는 창밖 풍경
   P: 플레이어  NPCS: 베타 승객들  V: 간식 판매원  C: 승무원
   ===================================================== */

// ----- 3D 장면 / 행위자 전역 -----
let renderer, scene, cam, ctl, ray, hits = [], walls = {}, ends = { '-1': [], '1': [] };
let P, NPCS = [], V, C, SCN = [];
let lastPortrait = null;
const keys = {}; // 현재 눌려 있는 키 상태(event.code 기준)

// ----- 공용 헬퍼 -----
// document.getElementById 단축 함수
const $ = id => document.getElementById(id);
// 재질(색) 생성 헬퍼
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
// rnd: a~b 사이 난수 / pick: 배열에서 무작위 1개 선택
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

// 화면 상단 알림 메시지 표시(잠시 후 자동으로 사라짐)
function toast(t) {
  const el = $('toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600);
}
// 말풍선/간식 메뉴 패널 열고 닫기(하나만 열리게)
function panel(id) { const el = $(id), was = !el.hidden; $('phr').hidden = $('menu').hidden = true; el.hidden = was; }
// Lucide 아이콘을 버튼 등에 주입하고 SVG로 렌더링
function setLucideIcon(el, name) {
  el.innerHTML = `<i data-lucide="${name}"></i>`;
  if (window.lucide) lucide.createIcons({ nodes: [el] });
}
