/* =====================================================
   6. 말풍선 + 베타 승객 NPC (npc.js)
   NPC는 실제 접속자가 아닙니다(이름표에 '베타' 표시).
   Supabase 연결 시 이 파일의 brain 부분을 실제 접속자 동기화로 교체하세요.
   ===================================================== */

// NPC가 무작위로 하는 말
const LINES = ['안녕하세요! 👋', '풍경이 참 예쁘네요.', '어디까지 가세요?', '간식 먹고 싶다!', '좋은 여행 되세요.', '기차 여행은 역시 좋네요.'];
// 베타 승객 5명의 외형 데이터(이름·옷·머리·피부·바지 색)
const NPC_DEFS = [
  { name: '하늘', shirt: 0xf2b632, hair: 0x2b2b2b, skin: 0xffd9b3, pants: 0x4a5a3a },
  { name: '민수', shirt: 0x3f7d46, hair: 0x6b4a2b, skin: 0xf1c79e, pants: 0x3b3b4a },
  { name: '지아', shirt: 0xb05fb0, hair: 0x1f1f1f, skin: 0xffd9b3, pants: 0x5a3b5a },
  { name: '도윤', shirt: 0x57a0c9, hair: 0x8a5a2b, skin: 0xe8b88c, pants: 0x2f3b55 },
  { name: '서연', shirt: 0xe58aa0, hair: 0x4a2f1e, skin: 0xffe0c4, pants: 0x6a4a3a },
];

// 행위자 머리 위에 말풍선 표시(sec초 뒤 사라짐, 긴 문구는 글자 크기 자동 축소)
function speak(a, text, sec = 3) {
  // 기존 말풍선이 있으면 메모리 해제 후 제거
  if (a.bub) { a.g.remove(a.bub); a.bub.material.map.dispose(); a.bub.material.dispose(); }
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 96;
  const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.strokeStyle = '#1d2f4f'; x.lineWidth = 4;
  x.fillRect(6, 6, 308, 70); x.strokeRect(6, 6, 308, 70);
  x.fillStyle = '#1d2f4f'; let fs = 28; x.font = 'bold 28px sans-serif'; while (x.measureText(text).width > 288 && fs > 14) x.font = `bold ${--fs}px sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 42);
  a.bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  a.bub.scale.set(1.9, 0.57, 1); a.bub.position.y = 2.15; a.g.add(a.bub); a.bubT = sec;
}

// 베타 NPC 행동 결정: 앉아 있기/일어나기/빈 좌석 찾기/걷기/말풍선
function brain(n, dt) {
  n.say -= dt; n.timer -= dt;
  if (n.say <= 0) { n.say = rnd(7, 16); speak(n, pick(LINES)); }
  if (n.timer > 0 || n.path.length) return;
  if (n.state === 'sit') { if (Math.random() < 0.5) standUp(n); else n.timer = rnd(6, 14); return; }
  if (Math.random() < 0.55) { const free = SEATS.filter(s => !GameState.occ[s.id]); if (free.length && goSeat(n, pick(free))) return; }
  goFloor(n, rnd(-XMAX, XMAX), rnd(-AISLE, AISLE)); n.timer = rnd(2, 6);
}

// 통로에서 서 있는/걷는 사람끼리 겹치지 않게 밀어냄(NPC·플레이어·판매원·승무원 충돌 처리)
function separate() {
  const all = [P, ...NPCS, V, C].filter(a => a.g.visible && a.state !== 'sit' && Math.abs(a.g.position.z) <= AISLE + 0.02);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i].g.position, B = all[j].g.position; let dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d >= 0.5) continue; // 충분히 떨어져 있으면 무시
    if (d < 0.001) { dx = 1; dz = rnd(-0.2, 0.2); d = 1; } // 완전히 겹쳤을 때는 임의 방향으로
    const k = (0.5 - Math.hypot(B.x - A.x, B.z - A.z)) / 2 / d;
    A.x -= dx * k; A.z -= dz * k; B.x += dx * k; B.z += dz * k;
    for (const p of [A, B]) { p.x = Math.max(-XMAX, Math.min(XMAX, p.x)); p.z = Math.max(-AISLE, Math.min(AISLE, p.z)); } // 통로 밖으로 밀려나지 않게
  }
}
