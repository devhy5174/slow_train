/* =====================================================
   15. 멀티플레이 (multi.js)
   Supabase Realtime Presence + Broadcast 기반
   - Presence : 접속자 목록 관리 (접속·퇴장 추적)
   - Broadcast: 위치·방향·상태 10fps 동기화 (저지연)
   회원가입·DB 테이블 불필요 — Realtime 채널만 사용합니다.
   ===================================================== */

const Multi = (() => {

  // 원격 플레이어 맵: peerId → Actor 객체
  const peers = {};
  let _channel = null;
  let _myId    = null;
  let _enabled = false;

  // 원격 플레이어용 색상 팔레트 (내 캐릭터·베타 NPC와 시각적으로 구분)
  const PALETTES = [
    { shirt: 0x4a90d9, hair: 0x2c1810, skin: 0xffd9b3, pants: 0x2d4a6b },
    { shirt: 0x7bc88a, hair: 0x5a3426, skin: 0xf0c090, pants: 0x3a4a2b },
    { shirt: 0xe8a034, hair: 0x1a1a2e, skin: 0xffd9b3, pants: 0x4a2b1a },
    { shirt: 0xd44fa0, hair: 0x3c2a1a, skin: 0xf5c8a0, pants: 0x2a2a4a },
    { shirt: 0x9b59b6, hair: 0x4a3426, skin: 0xffe0b3, pants: 0x1a3a2a },
    { shirt: 0xe74c3c, hair: 0x2a1a0a, skin: 0xf0c890, pants: 0x2a3a4a },
  ];
  let _paletteIdx = 0;

  // ---- 내부 헬퍼 ----

  // 원격 플레이어 착석 적용: 로컬 플레이어·NPC 자리 침범 불가
  // NPC를 비우지 않는 이유: 각 클라이언트의 NPC 배치가 독립적이라
  // 강제로 비우면 로컬 GameState.occ가 깨져 로컬 플레이어가 그 자리에 앉을 수 있게 됨
  function _applySit(a, seatId) {
    if (a.state === 'sit' && a.seat?.id === seatId) return; // 이미 해당 자리 착석 중
    const s = SEATS.find(q => q.id === seatId);
    if (!s) return;
    const occupantId = GameState.occ[s.id];
    if (occupantId === P?.id) return; // 로컬 플레이어 자리 → 착석 거부
    if (occupantId && NPCS.some(n => n.id === occupantId)) return; // 베타 NPC 자리 → 착석 거부
    if (a.state === 'sit') standUp(a); // 다른 자리에 앉아 있었으면 먼저 일어남
    sitDown(a, s);
  }

  // 새 접속자 입장 시 내 현재 상태를 즉시 전송 (착석 중이면 착석 위치 공유)
  function _sendFullState() {
    if (!_enabled || !_channel || !P) return;
    const snap = actorSnapshot(P);
    _lastSent = { x: snap.x, z: snap.z, ry: snap.ry, state: snap.state, seatId: snap.seatId };
    _channel.send({ type: 'broadcast', event: 'move', payload: { ...snap, id: _myId, moving: false } });
  }

  // 원격 플레이어 캐릭터 생성 (npc: true → saveNow·brain 호출 안 됨)
  function _spawnPeer(peerId, name) {
    if (peers[peerId] || peerId === _myId) return;
    const pal = PALETTES[_paletteIdx % PALETTES.length];
    _paletteIdx++;
    const a = mkActor(`peer_${peerId}`, name || '승객', { ...pal, npc: true });
    a.g.position.set(0, 0, 0);
    a._moving = false;
    peers[peerId] = a;
  }

  // 원격 플레이어 캐릭터 제거 및 점유 좌석 해제
  function _removePeer(peerId) {
    const a = peers[peerId];
    if (!a) return;
    if (a.state === 'sit' && a.seat && GameState.occ[a.seat.id] === a.id)
      delete GameState.occ[a.seat.id];
    scene.remove(a.g);
    delete peers[peerId];
    _updateHud();
  }

  // HUD 승객 수 텍스트 갱신
  function _updateHud() {
    const remoteCount = Object.keys(peers).length;
    const total = 1 + remoteCount + NPC_DEFS.length;
    const ticket = GameState.hasTicket ? '🎫 승차권 있음' : '🎫 승차권 없음(무임승차)';
    const remotePart = remoteCount > 0 ? ` · 실제 승객 ${remoteCount}명` : '';
    $('hc').textContent = `승객 ${total}명 (베타 승객 ${NPC_DEFS.length}명 포함${remotePart}) · ${ticket}`;
  }

  // ---- 공개 API ----

  // 입장 직후 1회 호출: Supabase 채널에 연결하고 Presence 등록
  async function connect(name, carId) {
    // 환경변수 주입 여부 진단 로그 (브라우저 콘솔에서 확인 가능)
    console.info('[Multi] SUPABASE_URL:', window.SUPABASE_URL ? '✅ 설정됨' : '❌ 없음');
    console.info('[Multi] SUPABASE_KEY:', window.SUPABASE_KEY ? '✅ 설정됨' : '❌ 없음');

    if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
      console.info('[Multi] Supabase 환경변수 없음 — 싱글플레이 모드');
      return;
    }
    if (typeof supabase === 'undefined') {
      console.warn('[Multi] Supabase SDK 로드 실패 — CDN 차단 여부 확인 필요');
      return;
    }

    // 각 플레이어는 고유 UUID로 식별 (로그인 불필요)
    _myId = crypto.randomUUID();

    const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });

    // 채널 이름은 객차 ID 기반으로 분리
    _channel = sb.channel(`train_car_${carId}`, {
      config: {
        broadcast: { self: false, ack: false }, // ack: false → 응답 대기 없이 즉시 전송
        presence:  { key: _myId },
      },
    });

    // Presence sync: 채널 현재 상태 전체 갱신 (최초 연결 시 기존 접속자 처리)
    _channel.on('presence', { event: 'sync' }, () => {
      const state = _channel.presenceState();
      console.info('[Multi] Presence sync — 현재 접속자 수:', Object.keys(state).length);
      for (const [id, presences] of Object.entries(state)) {
        if (id !== _myId && !peers[id]) _spawnPeer(id, presences[0]?.name);
      }
      for (const id of Object.keys(peers)) {
        if (!state[id]) _removePeer(id);
      }
      _updateHud();
    });

    // Presence join: 새 접속자 입장 — 내 현재 착석 상태도 즉시 전송
    _channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === _myId) return;
      console.info('[Multi] 접속자 입장:', newPresences[0]?.name || key);
      _spawnPeer(key, newPresences[0]?.name);
      _updateHud();
      _sendFullState(); // 새 접속자가 내 현재 위치·착석 상태를 즉시 볼 수 있도록
    });

    // Presence leave: 접속 종료
    _channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.info('[Multi] 접속자 퇴장:', key);
      _removePeer(key);
    });

    // seat_yield: 내 지정석 자리를 비워달라는 요청 수신 → NPC와 동일한 흐름으로 자동 처리
    _channel.on('broadcast', { event: 'seat_yield' }, ({ payload }) => {
      if (!P || P.state !== 'sit' || !P.seat || P.seat.id !== payload.seatId) return;
      speak(P, '앗 죄송합니다!', 3.5);
      setTimeout(() => {
        if (P && P.state === 'sit' && P.seat && P.seat.id === payload.seatId) {
          standUp(P);
          goFloor(P, rnd(-XMAX, XMAX), rnd(-AISLE, AISLE));
          saveNow();
        }
      }, 1200);
    });

    // Broadcast move: 위치·방향·착석 상태 적용
    _channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload || payload.id === _myId) return;
      const a = peers[payload.id];
      if (!a) return;
      if (payload.state === 'sit' && payload.seatId) {
        // 착석 상태 적용
        _applySit(a, payload.seatId);
      } else {
        // 이동 중 / 서 있는 상태: 착석 중이었으면 먼저 일어남
        if (a.state === 'sit') standUp(a);
        a.g.position.x = payload.x ?? a.g.position.x;
        a.g.position.z = payload.z ?? a.g.position.z;
        if (payload.ry != null) a.g.rotation.y = payload.ry;
      }
      a._moving = !!payload.moving;
    });

    // 채널 구독 — 모든 상태 변화를 콘솔에 출력해 디버깅 가능하게 함
    _channel.subscribe((status, err) => {
      console.info('[Multi] 채널 상태:', status, err ? err : '');
      if (status === 'SUBSCRIBED') {
        _enabled = true;
        _channel.track({ name, x: 0, z: 0, ry: 0, state: 'idle' });
        console.info('[Multi] ✅ Realtime 연결 완료 — 같은 객차 접속자가 보입니다');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Multi] ❌ 채널 오류 — Supabase 대시보드에서 Realtime 활성화 여부 확인:', err);
      } else if (status === 'TIMED_OUT') {
        console.warn('[Multi] ⏱ 연결 시간 초과 — 네트워크 상태 확인 필요');
      } else if (status === 'CLOSED') {
        console.info('[Multi] 채널 닫힘');
      }
    });
  }

  // 매 프레임 호출: 원격 플레이어 애니메이션 + 내 위치 브로드캐스트
  let _sendTimer = 0;
  let _lastSent = null; // 마지막으로 전송한 위치·방향 (변화 없으면 전송 생략)
  function tick(dt) {
    if (!_enabled || !_channel) return;

    // 강제 퇴장 시 연결 종료 (1회)
    if (GameState.ended) { disconnect(); return; }

    // 원격 플레이어 걷기 애니메이션 갱신
    for (const a of Object.values(peers)) {
      if (a.state !== 'sit' && a.state !== 'hide') animate(a, a._moving, dt);
    }

    // 100ms마다 전송 시도
    _sendTimer += dt;
    if (_sendTimer < 0.1 || !P) return;
    _sendTimer = 0;

    const snap = actorSnapshot(P);
    const moving = P.path.length > 0 || !!(
      keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD ||
      keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight
    );

    // 상태·위치·방향 변화 없고 정지 중이면 전송 생략 (불필요한 Broadcast·429 방지)
    if (_lastSent && !moving &&
        snap.state  === _lastSent.state  &&
        snap.seatId === _lastSent.seatId &&
        Math.abs(snap.x  - _lastSent.x)  < 0.01 &&
        Math.abs(snap.z  - _lastSent.z)  < 0.01 &&
        Math.abs(snap.ry - _lastSent.ry) < 0.03) return;

    _lastSent = { x: snap.x, z: snap.z, ry: snap.ry, state: snap.state, seatId: snap.seatId };

    // id: _myId 를 spread 뒤에 써야 snap.id('player')를 덮어쓸 수 있음
    _channel.send({
      type: 'broadcast',
      event: 'move',
      payload: { ...snap, id: _myId, moving },
    });
  }

  // 접속 종료 시 호출 (강제 퇴장·탭 닫기)
  async function disconnect() {
    if (!_channel) return;
    _enabled = false;
    for (const id of Object.keys(peers)) _removePeer(id);
    await _channel.unsubscribe();
    _channel = null;
  }

  // 탭 닫기·새로고침 시에도 Presence 해제
  window.addEventListener('pagehide', () => disconnect());

  // 내 지정석을 점유한 원격 플레이어에게 자리 반환 요청 전송
  function requestYield(seatId) {
    if (!_enabled || !_channel) return;
    _channel.send({
      type: 'broadcast',
      event: 'seat_yield',
      payload: { seatId, fromName: P?.name || '' },
    });
  }

  return { connect, tick, disconnect, requestYield };
})();
