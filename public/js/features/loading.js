/* =====================================================
   로딩 화면 (loading.js)
   showLoadingScreen(onDone?) : 폼 제출 시 호출
   5초 표시 후 자동 페이드 아웃 → onDone 콜백
   ===================================================== */

(function () {
  const MIN_MS  = 5000;
  const TYPE_MS = 160;
  const FULL_TEXT = '기차 탑승중...';

  let _typeStr = '';
  let _typeT   = 0;
  let _hideT   = 0;
  let _animId  = null;
  let _last    = 0;
  let _running = false;
  let _onDone  = null;

  /* ── 메인 루프 ───────────────────────────────────── */
  function _tick(ts) {
    if (!_running) return;
    _animId = requestAnimationFrame(_tick);

    const dt = Math.min(ts - _last, 50);
    _last = ts;

    // 타이핑 애니메이션
    if (_typeStr.length < FULL_TEXT.length) {
      _typeT += dt;
      if (_typeT >= TYPE_MS) { _typeT = 0; _typeStr += FULL_TEXT[_typeStr.length]; }
    } else {
      _typeT += dt;
      if (_typeT >= 1200) { _typeStr = ''; _typeT = 0; }
    }
    const el = document.getElementById('ldText');
    if (el) el.textContent = _typeStr;

    // 자동 숨김
    _hideT += dt;
    if (_hideT >= MIN_MS) _fadeOut();
  }

  /* ── 페이드 아웃 ─────────────────────────────────── */
  function _fadeOut() {
    _running = false;
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    const el = document.getElementById('loadingScreen');
    if (!el) return;
    el.style.transition = 'opacity 0.6s ease';
    el.style.opacity    = '0';
    setTimeout(() => {
      el.hidden           = true;
      el.style.opacity    = '';
      el.style.transition = '';
      if (_onDone) { const cb = _onDone; _onDone = null; cb(); }
    }, 650);
  }

  /* ── 공개 API ────────────────────────────────────── */
  window.showLoadingScreen = function (onDone) {
    _onDone  = onDone || null;
    _typeStr = '';
    _typeT   = 0;
    _hideT   = 0;
    _running = true;
    _last    = performance.now();

    const el = document.getElementById('loadingScreen');
    if (!el) return;
    el.hidden           = false;
    el.style.opacity    = '1';
    el.style.transition = '';
    const txt = document.getElementById('ldText');
    if (txt) txt.textContent = '';

    if (_animId) cancelAnimationFrame(_animId);
    _animId = requestAnimationFrame(_tick);
  };
})();
