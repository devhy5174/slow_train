/* =====================================================
   8. 손에 든 간식 (snack.js)
   판매원에게서 산 간식(가상 구매)을 오른손에 쥐여 주고, 40초 뒤 자동으로 없앱니다.
   ===================================================== */

// 간식 이름별 작은 3D 모델(간단한 도형). 오른손 좌표계 기준으로 만들어 세워서 보이게 함
function makeSnack(name) {
  const g = new THREE.Group(), cy = (r, h, c) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(c)); // 원기둥 헬퍼
  if (name === '삶은 계란') { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0xfdf7ea)); e.scale.set(0.8, 1.05, 0.8); g.add(e); }
  else if (name === '사이다') { g.add(cy(0.04, 0.2, 0x7fd6a0)); const cap = cy(0.025, 0.04, 0xffffff); cap.position.y = 0.12; g.add(cap); }
  else if (name === '과자') { box(g, 0.16, 0.22, 0.05, 0xf2b632, 0, 0, 0, false); box(g, 0.17, 0.06, 0.055, 0xe8553d, 0, 0.02, 0, false); }
  else if (name === '커피') { g.add(cy(0.05, 0.1, 0xf4efe3)); const t = cy(0.052, 0.02, 0x4a2f1e); t.position.y = 0.05; g.add(t); }
  else { box(g, 0.26, 0.06, 0.18, 0xe8553d, 0, 0, 0, false); box(g, 0.24, 0.02, 0.16, 0xf4efe3, 0, 0.04, 0, false); } // 도시락
  g.rotation.x = 1.0; // 팔이 앞으로 기울어진 만큼 되돌려 똑바로 보이게
  return g;
}

// 행위자의 오른손에 간식을 쥐여 줌(기존 것은 교체). 40초 뒤 자동으로 사라짐(다 먹음)
function setHeld(a, name) {
  a.heldName = name; // 간식 이름 보존 (멀티 동기화용)
  const arm = a.g.userData.aR; if (a.held) arm.remove(a.held);
  const m = makeSnack(name); m.position.set(0, -0.3, 0.05); arm.add(m); a.held = m; a.heldT = 40;
}

// 매 프레임: 플레이어가 든 간식의 남은 시간 계산, 끝나면 제거
function heldTick(dt) {
  $('bDrop').hidden = !P.held; // 들고 있을 때만 '간식 버리기' 버튼 표시
  if (P.held && (P.heldT -= dt) <= 0) { P.g.userData.aR.remove(P.held); P.held = null; toast('다 먹었어요 😋'); }
}

// '간식 버리기' 버튼: 손에 든 간식을 바로 없앰
function dropHeld() {
  if (!P.held) return;
  P.g.userData.aR.remove(P.held); P.held = null; toast('간식을 버렸어요.');
}
