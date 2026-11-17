/* =====================================================
   7. 기차 주행 사운드 (sound.js)
   음원 교체 방법: SOUND_FILE에 무료 라이선스 음원 경로(예: 'sounds/rail.mp3')를 넣으면
   그 파일을 반복 재생합니다. (사용 시 출처·라이선스 표기 필요)
   null이면 아래 합성음(낮은 덜컹거림 + 부드러운 '철커덩' 레일 리듬)을 임시로 사용합니다.
   외부 음원은 쓰지 않았습니다.
   ===================================================== */
const SOUND_FILE = null;

const RailSound = {
  ctx: null, master: null, hit: null, audio: null, timer: null, nextT: 0, started: false, volume: 0.6, muted: false,

  // 소리 시작: 반드시 사용자 클릭(입장 버튼) 직후에 호출해야 브라우저가 재생을 허용함
  start() {
    if (this.started) return; this.started = true;
    // 음원 파일이 지정되어 있으면 파일 반복 재생
    if (SOUND_FILE) { this.audio = new Audio(SOUND_FILE); this.audio.loop = true; this.apply(); this.audio.play().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); c.resume(); this.master = c.createGain(); this.master.connect(c.destination); this.apply();
    // 저음 덜컹임: 갈색 소음을 만들어 저역 통과 필터로 반복 재생
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    const g = c.createGain(); g.gain.value = 0.9; src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    // 이음매 소리용 짧은 노이즈 버퍼 + 주기적 예약 시작
    this.hit = c.createBuffer(1, Math.floor(c.sampleRate * 0.12), c.sampleRate);
    const h = this.hit.getChannelData(0); for (let i = 0; i < h.length; i++) h[i] = Math.random() * 2 - 1;
    this.nextT = c.currentTime + 0.3; this.timer = setInterval(() => this.schedule(), 250);
  },

  // 앞으로 약 1.2초 분량의 '철커덩 철커덩'을 미리 예약 → 끊김 없이 일정한 리듬으로 반복
  schedule() {
    while (this.nextT < this.ctx.currentTime + 1.2) { this.clack(this.nextT, 1); this.clack(this.nextT + 0.17, 0.65); this.nextT += 0.95; }
  },

  // 레일 이음매 소리 1번: 부드러운 대역 노이즈 + 낮은 울림(날카로운 금속음 배제). t = 재생 시각, amp = 세기
  clack(t, amp) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.hit;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const g = c.createGain(); g.gain.setValueAtTime(amp * 1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.master); n.start(t);
    const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.14);
    og.gain.setValueAtTime(amp * 0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.2);
  },

  // 현재 음소거/볼륨 값을 실제 출력에 반영
  apply() {
    const v = this.muted ? 0 : this.volume;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    if (this.audio) this.audio.volume = v;
  },

  // 음소거 설정 + 저장(새로고침 후에도 유지)
  setMuted(m) { this.muted = m; this.apply(); Repo.saveSettings({ muted: this.muted, volume: this.volume }); },

  // 볼륨 설정(0~1) + 저장
  setVolume(v) { this.volume = v; this.apply(); Repo.saveSettings({ muted: this.muted, volume: this.volume }); },
};

// 하단 스피커 버튼/볼륨 슬라이더 연결
function initSoundUI() {
  const btn = $('bMute'), vol = $('vol');
  // 버튼 아이콘과 슬라이더 값을 현재 상태에 맞춤
  const sync = () => { btn.textContent = RailSound.muted || RailSound.volume === 0 ? '🔇' : '🔊'; vol.value = RailSound.volume; };
  btn.onclick = () => { RailSound.setMuted(!RailSound.muted); sync(); };
  // 브라우저가 소리를 멈춰 둔 상태(suspended)면 다음 터치/클릭 때 다시 재생
  document.addEventListener('pointerdown', () => { if (RailSound.ctx && RailSound.ctx.state === 'suspended') RailSound.ctx.resume(); });
  vol.oninput = () => { RailSound.setVolume(+vol.value); if (RailSound.muted && +vol.value > 0) RailSound.setMuted(false); sync(); };
  sync();
  initEarphoneUI();
}

// 이어폰 가야금 음악 재생/정지 + 볼륨 슬라이더
const EarphoneMusic = { audio: null, playing: false };

function initEarphoneUI() {
  const btn = $('bEarphone'), volEar = $('volEar');
  if (!btn) return;

  // 이어폰이 기차음을 음소거한 경우를 추적 (사용자가 먼저 음소거했으면 복원하지 않음)
  let _mutedByEarphone = false;

  const syncBtn = () => { btn.textContent = EarphoneMusic.playing ? '🎵' : '🎧'; };
  // bMute 아이콘을 현재 RailSound 상태에 맞춰 갱신
  const syncMute = () => { const mb = $('bMute'); if (mb) mb.textContent = RailSound.muted || RailSound.volume === 0 ? '🔇' : '🔊'; };

  btn.onclick = () => {
    if (!EarphoneMusic.audio) {
      // 첫 클릭 시 오디오 객체 생성 (브라우저 자동재생 정책: 클릭 후 생성해야 허용)
      EarphoneMusic.audio = new Audio('sounds/gugak-bgm.mp3');
      EarphoneMusic.audio.loop = true;
      EarphoneMusic.audio.volume = +volEar.value;
    }
    if (EarphoneMusic.playing) {
      EarphoneMusic.audio.pause();
      EarphoneMusic.playing = false;
      toast('이어폰을 뺐어요.');
      // 이어폰이 직접 음소거한 경우에만 기차음 복원
      if (_mutedByEarphone) { _mutedByEarphone = false; RailSound.setMuted(false); syncMute(); }
    } else {
      EarphoneMusic.audio.play().catch(() => toast('음악 파일을 찾을 수 없어요.'));
      EarphoneMusic.playing = true;
      toast('이어폰을 꽂았어요. 🎧');
      // 기차음이 켜져 있을 때만 음소거 (이미 꺼져 있으면 건드리지 않음)
      if (!RailSound.muted) { _mutedByEarphone = true; RailSound.setMuted(true); syncMute(); }
    }
    syncBtn();
  };

  // 슬라이더 조작 시 즉시 볼륨 반영
  volEar.oninput = () => { if (EarphoneMusic.audio) EarphoneMusic.audio.volume = +volEar.value; };

  syncBtn();
}
