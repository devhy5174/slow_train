/* =====================================================
   1. 저장소 어댑터 (repo.js)
   지금은 브라우저 localStorage를 사용합니다.
   Supabase로 바꿀 땐 같은 메서드를 가진 SupabaseRepo를 만들고
   맨 아래 `const Repo = ...` 한 줄만 교체하면 됩니다.
   (게임 코드는 Repo 외에는 저장 방식을 전혀 모릅니다)

   Supabase 연결 시 추가할 메서드:
     assignCar(userId)        → 빈 객차 배정, carId 반환
     broadcastState(snapshot) → actorSnapshot(P)을 채널에 전송
     subscribeRoom(carId, cb) → 같은 carId 내 다른 이용자 상태 수신
     issueTicket(carId)       → 지정석 승차권 발급, { carId, seatId } 반환
     returnTicket(carId)      → 객차 이동 시 기존 승차권 반환
   ===================================================== */

// 브라우저 localStorage 기반 저장소
const LocalRepo = {
  // ----- 프로필(닉네임·앉은 좌석·위치·객차) -----
  // v2: carId 추가
  key: 'slowtrain:profile:v2',
  // 저장된 프로필 불러오기(없거나 깨졌으면 null)
  async loadProfile() { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } },
  // 프로필 저장(저장 시각 updatedAt 자동 추가)
  // 저장 형태: { nickname, carId, seatId, x, z, updatedAt }
  async saveProfile(p) { try { localStorage.setItem(this.key, JSON.stringify({ ...p, updatedAt: Date.now() })); } catch {} },

  // ----- 사운드 설정(음소거/볼륨) -----
  settingsKey: 'slowtrain:settings:v1',
  // 사운드 설정 불러오기
  async loadSettings() { try { return JSON.parse(localStorage.getItem(this.settingsKey) || 'null'); } catch { return null; } },
  // 사운드 설정 저장
  async saveSettings(v) { try { localStorage.setItem(this.settingsKey, JSON.stringify(v)); } catch {} }
};

// 게임이 실제로 사용하는 저장소 (Supabase 전환 시 이 줄만 교체)
const Repo = LocalRepo;
