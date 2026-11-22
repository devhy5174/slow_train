/* =====================================================
   낮·노을·밤 자동 전환 모듈 (daynight.js)
   접속자 현지 시간 기준:
     낮   06:00~17:00 → 맑은 하늘
     노을  17:00~19:00 → 주황빛 하늘
     밤   19:00~06:00 → 어두운 하늘 + 달·별 + 객실 천장 조명
   ===================================================== */

const DayNight = (() => {

  // ----- 색상·조명 프리셋 -----
  // hemi: 반구광(sky/ground), sun: 메인 태양광, fill: 보조광
  // interiorInt: 객실 천장 PointLight 강도 (낮=0, 노을=0.3, 밤=1.0)
  const PRESETS = {
    day: {
      bg:          0xcfe8f0,
      hemiSky:     0xfff3dc,
      hemiGnd:     0xb8895a,
      hemiInt:     0.85,
      sunColor:    0xffd9a0,
      sunInt:      1.3,
      fillColor:   0xfff6e8,
      fillInt:     0.4,
      groundColor: 0x8fbf6a,
      interiorInt: 0,       // 낮: 객실 조명 꺼짐
    },
    sunset: {
      bg:          0xe05020,
      hemiSky:     0xff7030,
      hemiGnd:     0x7a3010,
      hemiInt:     0.7,
      sunColor:    0xff4400,
      sunInt:      0.85,
      fillColor:   0xff9955,
      fillInt:     0.25,
      groundColor: 0x9a7040,
      interiorInt: 0.3,     // 노을: 조명 살짝 켜짐
    },
    night: {
      bg:          0x070c1a,
      hemiSky:     0x101830,
      hemiGnd:     0x040608,
      hemiInt:     0.22,
      sunColor:    0x3355bb,
      sunInt:      0.25,
      fillColor:   0x1a2244,
      fillInt:     0.08,
      groundColor: 0x2a3d1a,
      interiorInt: 1.0,     // 밤: 객실 천장 조명 풀 밝기
    },
  };

  // 색상 보간용 임시 Color 객체
  const _c = {
    bg:          new THREE.Color(),
    hemiSky:     new THREE.Color(),
    hemiGnd:     new THREE.Color(),
    sunColor:    new THREE.Color(),
    fillColor:   new THREE.Color(),
    groundColor: new THREE.Color(),
  };

  // ----- 조명·씬 참조 -----
  let _hemi, _sun, _fill, _ground;

  // ----- 객실 천장 PointLight 배열 -----
  const _interiorLights = [];

  // ----- 달 / 별 메쉬 -----
  let _moon = null, _stars = null;

  // ----- 전환 상태 -----
  let _fromZone = 'day';
  let _toZone   = 'day';
  let _progress = 1.0;
  const TRANSITION_SECS = 60;
  let _lastCheckedZone = null;

  // ----- 헬퍼: 현재 시간대 계산 -----
  function _getZone() {
    const h = new Date().getHours();
    if (h >= 6 && h < 17) return 'day';
    if (h >= 17 && h < 19) return 'sunset';
    return 'night';
  }

  // ----- 객실 천장 조명 생성 -----
  // 아이보리 PointLight 5개 — 객차 길이(±7.8) 따라 3m 간격 배치
  // distance=5.5, decay=2 → 창밖까지 빛이 거의 닿지 않음
  function _buildInteriorLights() {
    for (const px of [-6, -3, 0, 3, 6]) {
      const light = new THREE.PointLight(0xfffde8, 0, 5.5, 2);
      light.position.set(px, 2.4, 0);  // 천장 y=2.55 바로 아래
      light.visible = false;
      scene.add(light);
      _interiorLights.push(light);
    }
  }

  // ----- 프리셋 보간 적용 -----
  function _applyLerp(a, b, t) {
    // 배경 색상
    _c.bg.set(a.bg).lerp(new THREE.Color(b.bg), t);
    scene.background.copy(_c.bg);

    // 반구광
    _c.hemiSky.set(a.hemiSky).lerp(new THREE.Color(b.hemiSky), t);
    _c.hemiGnd.set(a.hemiGnd).lerp(new THREE.Color(b.hemiGnd), t);
    _hemi.color.copy(_c.hemiSky);
    _hemi.groundColor.copy(_c.hemiGnd);
    _hemi.intensity = a.hemiInt + (b.hemiInt - a.hemiInt) * t;

    // 태양광
    _c.sunColor.set(a.sunColor).lerp(new THREE.Color(b.sunColor), t);
    _sun.color.copy(_c.sunColor);
    _sun.intensity = a.sunInt + (b.sunInt - a.sunInt) * t;

    // 보조광
    _c.fillColor.set(a.fillColor).lerp(new THREE.Color(b.fillColor), t);
    _fill.color.copy(_c.fillColor);
    _fill.intensity = a.fillInt + (b.fillInt - a.fillInt) * t;

    // 풀밭 바닥
    if (_ground) {
      _c.groundColor.set(a.groundColor).lerp(new THREE.Color(b.groundColor), t);
      _ground.material.color.copy(_c.groundColor);
    }

    // 객실 천장 조명 — 보간된 강도 적용
    const intInt = a.interiorInt + (b.interiorInt - a.interiorInt) * t;
    for (const l of _interiorLights) {
      l.intensity = intInt;
      // intensity=0일 때 visible=false 처리 → 모바일 셰이더 연산 절약
      l.visible = intInt > 0.01;
    }

    // 달·별 — 밤 비율에 따라 가시성·불투명도 조정
    const nightRatio = (() => {
      if (_toZone === 'night')   return t;
      if (_fromZone === 'night') return 1 - t;
      return 0;
    })();
    if (_moon)  _moon.visible  = nightRatio > 0.05;
    if (_stars) {
      _stars.visible = nightRatio > 0.05;
      _stars.material.opacity = Math.min(1, nightRatio * 2.5);
    }
  }

  // ----- 달 생성 -----
  function _buildMoon() {
    const geo = new THREE.SphereGeometry(2.4, 14, 10);
    const matM = new THREE.MeshBasicMaterial({ color: 0xfffde8 });
    _moon = new THREE.Mesh(geo, matM);
    _moon.position.set(-20, 22, 72);
    _moon.visible = false;
    scene.add(_moon);
    SCN.push({ m: _moon, k: 0, p: 999999 });
  }

  // ----- 별 생성 (Points geometry) -----
  function _buildStars() {
    const COUNT = 220;
    const positions = [];
    for (let i = 0; i < COUNT; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      positions.push(
        (Math.random() - 0.5) * 160,
        6 + Math.random() * 36,
        side * (40 + Math.random() * 50),
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const matS = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    _stars = new THREE.Points(geo, matS);
    _stars.visible = false;
    scene.add(_stars);
    SCN.push({ m: _stars, k: 0, p: 999999 });
  }

  // ----- 공개 API -----

  function init(hemi, sun, fill, ground) {
    _hemi   = hemi;
    _sun    = sun;
    _fill   = fill;
    _ground = ground;

    _buildInteriorLights();
    _buildMoon();
    _buildStars();

    const zone = _getZone();
    _fromZone = zone;
    _toZone   = zone;
    _progress = 1.0;
    _lastCheckedZone = zone;
    _applyLerp(PRESETS[zone], PRESETS[zone], 1);
  }

  function tick(dt) {
    if (!_hemi) return;

    tick._checkTimer = (tick._checkTimer || 0) + dt;
    if (tick._checkTimer > 10) {
      tick._checkTimer = 0;
      const zone = _getZone();
      if (zone !== _lastCheckedZone) {
        _fromZone = _toZone;
        _toZone   = zone;
        _progress = 0;
        _lastCheckedZone = zone;
      }
    }

    if (_progress < 1.0) {
      _progress = Math.min(1.0, _progress + dt / TRANSITION_SECS);
    }

    _applyLerp(PRESETS[_fromZone], PRESETS[_toZone], _progress);
  }

  function setZone(zone) {
    _fromZone = zone;
    _toZone   = zone;
    _progress = 1.0;
    _lastCheckedZone = zone;
    _applyLerp(PRESETS[zone], PRESETS[zone], 1);
  }

  return { init, tick, setZone };

})();
