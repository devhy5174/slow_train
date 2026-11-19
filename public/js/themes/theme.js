/* =====================================================
   테마 관리자 (theme.js)
   새 테마 추가 방법:
     1. themes/ 에 new_theme.js 파일 생성
     2. 파일 하단에 Theme.register('이름', { build, dispose, tick }) 호출
     3. index.html 에 script 태그 추가
   ===================================================== */

const Theme = {
  active: 'default',
  _current: null,
  _map: {},

  // 테마 모듈 등록 (각 테마 파일이 스스로 호출)
  register(name, mod) {
    this._map[name] = mod;
  },

  // 테마 전환: 이전 테마 정리 → 새 테마 빌드 → 로컬 저장
  set(name) {
    if (this._current) {
      this._current.dispose();
      this._current = null;
    }
    this.active = name;
    if (this._map[name]) {
      this._current = this._map[name];
      this._current.build();
    }
    localStorage.setItem('slowtrain_theme', name);
    const btn = document.getElementById('bTheme');
    if (btn) setLucideIcon(btn, name === 'default' ? 'sparkles' : _themeIcon(name));
  },

  // 저장된 테마 불러오기 (게임 시작 시 호출)
  load() {
    const saved = localStorage.getItem('slowtrain_theme');
    if (saved && saved !== 'default') this.set(saved);
  },

  // 매 프레임 애니메이션 (game.js update에서 호출)
  tick(dt) {
    if (this._current && this._current.tick) this._current.tick(dt);
  },
};

function _themeIcon(name) {
  const icons = { christmas: 'tree-pine' };
  return icons[name] || 'sparkles';
}

// 테마 전환 버튼 이벤트 연결 (buildUI에서 호출)
function initThemeUI() {
  const btn = document.getElementById('bTheme');
  if (!btn) return;
  // 등록된 테마 목록 순환 (default → christmas → default → ...)
  btn.onclick = () => {
    const names = ['default', ...Object.keys(Theme._map)];
    const idx = names.indexOf(Theme.active);
    const next = names[(idx + 1) % names.length];
    Theme.set(next);
    const label = next === 'default' ? '기본 테마' : next === 'christmas' ? '크리스마스 테마' : next;
    toast(`${label}로 변경됐어요.`);
  };
}
