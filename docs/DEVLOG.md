# DEVLOG — 개발 일지

## 2026-11-18 — 유저 입장 시 베타 NPC 단계적 퇴장·복귀

**변경 파일**: `public/js/multi.js`, `public/js/game.js`

**내용**: 실제 유저 입장 시 NPC 1명이 객차 끝으로 걸어가서 숨김, 유저 퇴장 시 복귀. `npc_states`에 `visible` 필드 추가로 비호스트에도 동기화. 비활성·퇴장 중 NPC는 brain/루프에서 제외.

---

## 2026-11-18 — NPC Realtime 동기화 최적화 (변화 감지·충돌 방지·호스트 전환)

**변경 파일**: `public/js/multi.js`, `public/js/features/ticket.js`

**문제 → 해결**
- NPC 착석·정지 중에도 200ms마다 무조건 전송 → `_npcChanged()` 변화 감지 추가, 변화 없으면 전송 생략
- 자리 비켜주기 요청 후 `brain()`이 같은 자리 재선택 가능 → 타임아웃 전에 `cancelRes()` 호출로 차단
- 호스트 전환 시 모든 NPC가 동시에 행동 → 신규 호스트 전환 감지 후 타이머 랜덤 분산

**다음 할 일**: 유저 수 증가 시 NPC 단계적 퇴장(조건 5)

---

## 2026-11-18 — NPC 자리 비켜주기 멀티플레이 동기화 수정

**변경 파일**: `public/js/multi.js`, `public/js/features/ticket.js`, `dist/js/` (빌드 반영)

**문제**: 비호스트 유저가 지정석에 앉은 NPC에게 자리 반환 요청 시, 로컬 화면에서만 NPC가 일어나고 호스트의 `npc_states` 브로드캐스트가 200ms 후 NPC를 다시 앉혀버림. 다른 접속자 화면에도 반영 안 됨.

**해결**: `npc_yield` 브로드캐스트 이벤트 추가. 비호스트는 호스트에게 처리 위임 → 호스트가 NPC를 직접 일으켜 다음 `npc_states`로 전체 동기화.

**다음 할 일**: NPC 착석·정지 시 반복 전송 제거(변화 감지 최적화)

---

## 2026-11-18 — Supabase Realtime 통신량 분석 (코드 변경 없음)

**분석 목적**: 실제 유저 24명 접속 시 메시지 병목·대역폭 초과 여부 확인

**주요 발견**
- 플레이어 위치(`move`): 이미 변화 감지 최적화 완료 — 정지·착석 시 전송 없음 ✅
- NPC 상태(`npc_states`): **전체 착석 중에도 무조건 5fps 전송 — 변화 감지 없음** ⚠️
- 역무원·판매원: 활성화 중 pause(멈춤) 구간에서도 5fps 전송 ⚠️
- 24명 현실적 합계: ~75 msg/sec (Free tier 한도 100 msg/sec에 근접)
- 대역폭: 상시 24명 가정 시 ~27 GB/month (Free tier 2 GB 초과)

**개선 우선순위 (미구현)**
1. NPC 상태 변화 감지 추가 → 착석·정지 시 전송 생략 (절감 효과 가장 큼)
2. 역무원·판매원 pause 구간 전송 중단
3. NPC·역무원·판매원 주기 200ms → 300~500ms로 늘림

**다음 작업 시 참고 파일**: `public/js/multi.js` — `tick()` 함수 내 `_npcSendTimer` / `_cSendTimer` / `_vSendTimer` 블록

---

## 2026-11-18 — 이어폰 켤 때 기차음 자동 음소거 · 복원

**변경 파일**
- `public/js/features/sound.js`: `initEarphoneUI()` 내 `_mutedByEarphone` 플래그 + 뮤트 버튼 아이콘 갱신 추가

**구현 내용**
- 이어폰(🎧) 재생 시작 시: 기차음이 켜져 있으면 자동 음소거 → `bMute` 아이콘 🔇 갱신
- 이어폰 정지 시: `_mutedByEarphone` 플래그가 `true`일 때만 기차음 복원 (사용자가 먼저 🔇로 끈 경우엔 그대로 유지)
- 사용자 의도와 이어폰 동작을 플래그 하나로 분리하여 설정 충돌 방지

---

## 2026-11-18 — 모바일 하단 바 컴팩트 + 소리 컨트롤 박스 그룹화

**변경 파일**
- `index.html`: 소리 관련 버튼·슬라이더 5개를 `<div class="sound-group">`으로 묶음
- `public/css/style.css`: `.sound-group` 박스 스타일, `.sound-sep` 구분선, `@media (max-width: 600px)` 컴팩트 규칙, Netlify 배지 숨김 CSS 추가

**구현 내용**
- 🔊·볼륨 슬라이더 / 구분선 / 🎧·이어폰 슬라이더 / ℹ 를 반투명 박스 하나로 묶어 한 줄에 나열
- 박스 내부는 `flex-wrap: nowrap`으로 절대 줄 바뀜 없음
- 모바일(≤600px): 버튼 패딩·폰트 11px, 슬라이더 54px, hint 10px로 컴팩트
- Netlify 무료 플랜 배지 CSS 숨김 시도 (`.netlify-badge` / `.nf-badge` / data 속성)
  - 완전 제거는 Netlify 계정 설정 또는 유료 플랜 필요

---

## 2026-11-17 — 황금색 점선 경로 안내 + 자동 이동 (지정석 찾기)

**변경 파일**
- `public/js/features/ticket.js`: `startSeatGuidance()`, `clearSeatGuidance()` 추가, `bFindSeat` 연결 변경
- `public/js/features/conductor.js`: `acceptSeatGuide`, `showTicket(standing)`, `endGame` 수정

**구현 내용**
- "자리 안내받기" 버튼 클릭 시 플레이어 현재 위치 → 지정석까지 황금색 반짝 점선 경로 표시
- 경로는 `goSeat`와 동일한 2-단계(통로 → 좌석 열) 선분 위에 간격 0.35 단위로 구 메쉬 배치
- 각 점이 파도처럼 순서대로 밝아졌다 어두워지는 pulse 애니메이션 (`sin` 위상 오프셋)
- 목적지 좌석 위에 황금색 ▼ 화살표(둥둥 떠다님)
- 플레이어를 자동으로 지정석까지 이동(`goSeat` 호출)
- 착석 완료 시 경로/화살표 자동 제거, 25초 타임아웃 안전망
- 적용 지점: 지정석 안내 팝업 "자리 안내받기" / 검표 중 통로 대기 케이스 / 하단 "📍 내 자리 찾기" 버튼
- 게임 종료(`endGame`) 시 `clearSeatGuidance`도 함께 정리

**다음 할 일**
- 없음 (이 기능 완성)

## 2026-11-17 — 이어폰 버튼(가야금 음악) + 저작권 안내 팝업 추가

**변경 파일**
- `index.html`: 🎧 이어폰 버튼, ℹ 정보 버튼, 음악 저작권 안내 팝업 추가
- `public/css/style.css`: `#bInfo` 우하단 원형 버튼 스타일 추가
- `public/js/features/sound.js`: `EarphoneMusic`, `initEarphoneUI()` 추가
- `public/js/ui/ui.js`: `bInfo`, `infoClose` 버튼 이벤트 연결
- `public/sounds/국악 배경음악 #131.mp3` (신규): CC BY 4.0 국악 배경음악

**구현 내용**
- 하단 바에 🎧 이어폰 버튼 추가 — 클릭 시 가야금 음악 반복 재생, 재클릭 시 정지
- 재생 중 아이콘이 🎵로 변경되어 상태 표시
- 브라우저 자동재생 정책 대응: 첫 클릭 시점에 `new Audio()` 생성
- 파일명의 `#` 문자 URL 인코딩 처리 (`encodeURIComponent`)
- 우하단 ℹ 버튼 → 팝업으로 음악 저작권 안내 표시 (CC BY 4.0, 공유마당 출처 링크 포함)

**다음 할 일**
- 없음 (사용자 테스트 후 볼륨 기본값 조정 가능)

## 2026-11-17 — 멀티플레이 1단계: Supabase Realtime 연결 + 위치 동기화

**변경 파일**
- `public/js/multi.js` (신규): Supabase Realtime Presence + Broadcast 모듈
- `index.html`: Supabase UMD CDN + `<!-- ENV_INJECT -->` 주석 + multi.js 스크립트 태그 추가
- `public/js/game.js`: `update()`에 `Multi.tick(dt)` 추가
- `public/js/main.js`: 입장 직후 `Multi.connect(name, carId)` 호출 추가
- `vite.config.js`: `inject-env` 플러그인으로 HTML에 환경변수 인라인 주입
- `netlify.toml` (신규): 빌드 커맨드 + publish 디렉토리 설정
- `.env` (신규, gitignore): Supabase URL·Key 로컬 보관
- `.gitignore`: `.env` 항목 추가

**구현 내용**
- 회원가입·DB 테이블 없이 Supabase Realtime Presence + Broadcast만 사용
- Presence: 접속자 입장/퇴장 감지 → 원격 캐릭터 자동 생성·제거
- Broadcast: 10fps throttle로 위치·방향·착석 상태 동기화
- 원격 플레이어는 `npc: true` Actor로 생성 → 기존 베타 NPC와 구분, saveNow·brain 호출 안 함
- Supabase 환경변수 없으면 조용히 싱글플레이 모드로 fallback
- HUD 승객 수에 실제 접속자 수 반영
- `pagehide` 이벤트로 탭 닫기 시 Presence 해제

**다음 할 일**
- 착석·말풍선·승무원 검표 동기화 (2단계)
- 객차 배정 로직 (Supabase DB 활용, 최대 24명)

## 2026-11-17 — 객차 하부 구조 추가 (대차·바퀴·철로)

**한 일**
- `scene.js`에 `buildBogies()`, `buildTrack()`, `tickWheels()` 추가
- 대차 2개(앞뒤 x=±5.0): 프레임 + 사이드빔, 바퀴 4개씩 총 8개
- 바퀴: `rollGroup`(위치) + 내부 메쉬(orientation, rotation.z=PI/2) 구조로 올바른 굴림 구현
- 레일 z=±2.0(바퀴 위치 일치), 침목 z폭=5.0, 자갈 z폭=5.2
- 철로 타일 3개(offset -PERIOD, 0, +PERIOD)로 무한 루프 → 끊김 없음
- 높이 정렬: 레일 윗면 y=-0.43 → 바퀴 중심 y=-0.11 → 차체 하부 y=-0.6
- `game.js` update()에 `tickWheels(dt)` 추가, buildWorld()에 build 호출 2개 추가

**문제 → 해결**
- 문제: 초기 구현에서 `wheel` 메쉬 중복 생성(추가 없음), 바퀴 y=-0.70(지면 아래), 레일 z=±1.0(바퀴 위치 불일치), 타일 1개로 끊김, `rotation.y` 조작으로 굴림 불가
- 해결: rollGroup 패턴으로 굴림 분리, 높이 상수 계산 후 일치, 레일 z=±2.0, 타일 3개 triple-buffer

**다음에 할 일**
- 실제 플레이에서 높이·속도 세부 조정

---

> 날짜가 기록되지 않은 이전 작업은 **"1단계"**로 묶어 적었습니다.
> 앞으로는 작업할 때마다 아래 템플릿으로 맨 위에 추가하세요.

```md
## YYYY-MM-DD — 제목
- 한 일:
- 문제 → 해결:
- 다음에 할 일:
```

---

## 2026-11-17 — 좌석 번호 Sprite → 등받이 부착 Mesh로 교체

**한 일**
- 기존 `THREE.Sprite` (카메라 추적 빌보드) 방식을 `THREE.Mesh + PlaneGeometry` (고정 Mesh)로 완전 교체
- 번호판을 벤치 그룹의 자식 오브젝트로 추가 → 의자와 함께 움직이고 회전
- 머리받침 뒷면(-x 면, x=-0.45)에서 2mm 바깥(x=-0.452)에 부착하여 z-fighting 방지
- `benchGroups` 맵을 추가하여 `bench()` 호출 시 그룹 참조를 저장하고 `buildSeatLabels()`에서 활용
- 텍스트 방향 수학적 검증: `rotation.y = -π/2`로 벤치 로컬 -x 방향을 바라봄
  - yaw=0 좌석: 세계 -x 방향, yaw=π 좌석: 세계 +x 방향 → 각각 뒤에서 접근하는 플레이어에게 정면 가독성 ✓
- 텍스트 스타일: 투명 배경 + 짙은 남색/초록/황금 텍스트 (아이보리 헤드레스트에 프린트된 느낌)
- `plane.raycast = () => {}` 적용 → 좌석 클릭 레이캐스트에 간섭 없음
- 비밀공간(nook) 힌트용 초록빛 Sprite 추가 및 색상 수정

**문제 → 해결**
- 문제: 기존 Sprite가 항상 카메라를 향해 회전 → "공중에 뜬 직사각형" 느낌
- 해결: Mesh로 교체하여 의자와 같은 방향에 고정, 벤치 자식 오브젝트로 등록

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/world/scene.js` | `benchGroups` 맵 추가, `bench()`에 저장, `makeSeatLabelMat` → MeshBasicMaterial, `buildSeatLabels` → Mesh+PlaneGeometry로 교체 |
| `js/game.js` | `buildSeatLabels` 주석 갱신 |
| `js/features/nook.js` | 힌트 구체 Sprite 색상 초록으로 변경 |

**다음에 할 일**
- 실제 카메라 시점에서 번호 가독성 확인 (특히 측면 접근 시)
- UI 디자인 개선 작업 계속

---

## 2026-11-17 — 검표 5초 자동 판정 구현

**한 일**
- `openTicket()` 을 5초 카운트다운 UI로 교체
  - "N초 안에 제출해 주세요" 카운트다운 표시 (1초마다 갱신)
  - '승차권 제출하기' 버튼 (클릭 즉시 판정)
  - '표 없음' 버튼 숨김 (자동 판정이므로 불필요)
- `processTicketCheck()` 추가
  - 버튼 클릭 or 5초 경과 → 자동 호출
  - `GameState.hasTicket` 기준 판정 (버튼 클릭 여부 무관)
  - `showTicket()` 또는 `noTicket()` 으로 분기
- `_clearInspectTimer()` 헬퍼 추가 (타이머·인터벌 일괄 정리)
- `ui.js` `tkShow` onclick → `processTicketCheck` 연결

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/features/conductor.js` | `openTicket()` 타이머 UI로 교체, `processTicketCheck()` · `_clearInspectTimer()` 추가 |
| `js/ui/ui.js` | `tkShow.onclick = processTicketCheck` |

---

## 2026-11-17 — 역무원 검표 이벤트 확장 구현 (F-09b)

**한 일**
- 좌석 상태 판별 함수 `getPlayerSeatState()` 추가
  - `own_seat` / `other_seat` / `free_seat` / `standing` / `free_rider` 5분기
- `showTicket()` 좌석 상태별 반응 분기
  - **본인 지정석**: "확인했습니다. 편안한 여행 되세요!" + 가끔 인사 대사
  - **타인 지정석 임시 착석**: "지정석은 N번입니다. 안내해 드릴까요?" → 1.6초 후 선택 모달
  - **자유석**: "좋은 여행 되세요!" (정상 통과)
  - **통로 대기**: 지정석 번호 안내 + 화살표 자동 표시
  - **무임승차**: 기존 강제 퇴장 흐름 유지
- 역무원 인사 대사 3종 추가 (`CONDUCTOR_GREETINGS`), 90초 쿨다운·45% 확률
- `#seatGuideModal` 신규 팝업: "자리 안내받기" → 화살표 표시 / "괜찮습니다" → 닫기
- `openTicket()` 에 "다른 승객의 지정석에 착석 중" 힌트 텍스트 추가

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/features/conductor.js` | `getPlayerSeatState`, `showTicket` 분기, `acceptSeatGuide`, `declineSeatGuide`, `_maybeGreet` 추가 |
| `index.html` | `#seatGuideModal` 추가 |
| `js/ui/ui.js` | `sgYes`·`sgNo` 버튼 이벤트 연결 |

---

## 2026-11-17 — UI 디자인 개선: 이름표·말풍선·좌석 번호

**한 일**

**닉네임 이름표 (actor.js)**
- 텍스트 길이에 맞춰 캔버스 너비 자동 조절 (최대 210px)
- 둥근 모서리 (`roundRect` 반경 9), 아이보리 글씨 `#f0e8d8`
- NPC: `rgba(55,75,110,0.78)` / 플레이어: `rgba(20,37,65,0.86)`
- 스프라이트 scale 1.2×0.3 → 텍스트 비례 최대 ~0.74×0.14 (소형화)
- `userData.baseScaleY` 저장 → `animate()` hide 보정 시 활용

**말풍선 (npc.js)**
- 따뜻한 아이보리 배경 `#f5ecd8`, 둥근 모서리 반경 14
- 꼬리 삼각형 (캐릭터 방향 아래 → (136,68)~(164,68)~(150,83))
- 은은한 테두리 `rgba(29,47,79,0.22)`
- 등장·퇴장 페이드 애니메이션 (opacity 0 출발 → game.js에서 처리)
- 스프라이트 scale 1.9×0.57 → 1.6×0.48 (약간 소형화)
- 위치 y=2.15 → y=2.22 (이름표와 간격 확보)

**말풍선 페이드 (game.js)**
- 등장 0.3초 페이드 인, 퇴장 0.4초 페이드 아웃
- `a.bub.userData.fi` 로 프레임별 증분, 기존 bubT 수명 로직 유지

**좌석 번호 (scene.js)**
- 캔버스 128×64 → 80×34 (소형 번호판)
- 짙은 남색/초록/황금 + 아이보리 텍스트 (기존 연회색 → 무궁화호 감성)
- 스프라이트 scale 0.42×0.21 → 0.26×0.11
- 위치 y=1.9 → y=1.75 (헤드레스트 바로 위, 화살표 y≈2.14와 간격 확보)

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/characters/actor.js` | 이름표 동적 너비·둥근 모서리·소형화, animate hide 보정 개선 |
| `js/characters/npc.js` | 말풍선 아이보리+꼬리, 페이드용 opacity:0 출발 |
| `js/game.js` | 말풍선 페이드 인/아웃 루프 |
| `js/world/scene.js` | 좌석 번호 소형 번호판 스타일 |

---

## 2026-11-17 — 승차권 유지 및 세션 복구 구현

**한 일**
- **새로고침 시 같은 좌석 복구**: 같은 닉네임으로 재접속하면 저장된 `ticketSeatId` 복구 시도. 좌석이 비어 있으면 그 자리 복구, 이미 점유됐으면 새 좌석 배정
- **강제 퇴장 시 승차권 반환**: `endGame()` 에서 `GameState.ticket = null` + `saveNow()` 호출 (ended 설정 전) → 다음 접속 시 새 좌석 배정
- **`saveNow()`에 ticketSeatId 추가**: 4초 자동저장·탭 종료(pagehide)·숨김(visibilitychange) 시 함께 저장
- 다른 닉네임 접속 시 저장된 ticketSeatId를 적용하지 않음 (본인 확인)

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/game.js` | `saveNow()` ticketSeatId 포함, `spawnActors(profile)` 프로필 수신, `build(profile)` 연결 |
| `js/features/ticket.js` | `assignTicket(savedSeatId)` — 복구 1순위, 새 배정 2순위 |
| `js/features/conductor.js` | `endGame()` — ticket null 처리 → saveNow → ended 순서 |
| `js/repo.js` | 프로필 필드 주석에 ticketSeatId 문서화 |

**세션별 동작 정리**

| 상황 | 결과 |
|---|---|
| 새로고침 (같은 닉네임, 승차권 구매) | 기존 지정석 복구 |
| 새로고침 (같은 닉네임, 무임승차) | 티켓 없음 (hasTicket=false) |
| 새로고침 (다른 닉네임) | 새 좌석 배정 |
| 강제 퇴장 후 재접속 + 승차권 구매 | 새 좌석 배정 (반환됨) |
| 탭 닫기/네트워크 끊김 | 티켓 유지 (향후 Supabase 60초 유예 처리 예정) |

---

## 2026-11-17 — 내 자리 찾기: 황금빛 강조 → 3D 화살표로 교체

**한 일**
- 기존 황금빛 플레인 오버레이 제거, 아래를 가리키는 빨간 3D 콘(▼)으로 교체
- 5초간 위아래 둥둥 (1.1초 주기 ±0.12m sin 파) → 마지막 1초 페이드아웃
- 반복 클릭 시 타이머 초기화 (중첩 없음), `clearSeatArrow()` 로 외부 강제 제거 가능
- 콘은 `hits` 배열에 미포함 → 클릭·이동 판정에 영향 없음

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/features/ticket.js` | `highlightMySeat()` 를 3D 콘 애니메이션으로 교체, `clearSeatArrow()` 추가 |

**설계 결정**
- `ConeGeometry(0.11, 0.28, 8)` + `rotation.x = Math.PI` → 아래를 가리키는 ▼
- 중심 y=2.28, 팁 y≈2.14 (헤드레스트 1.64 위, 이름표 1.6 위)
- `MeshStandardMaterial` 사용 → 씬 조명 반응으로 3D 입체감

---

## 2026-11-17 — 베타 NPC 자리 반환 요청 구현

**한 일**
- 플레이어 지정석에 베타 NPC가 앉아 있을 때 해당 좌석 클릭 → NPC가 "앗 죄송합니다!" 말풍선 표시 후 자리를 비움
- 호버 툴팁에 힌트 추가: "5번석 · 내 자리 (클릭해서 비워달라기)"
- 실제 이용자가 앉은 경우는 `requestSeatYield()` false 반환 (서버 처리 예약)

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/features/ticket.js` | `requestSeatYield()` 추가 |
| `js/game.js` | 좌석 클릭 핸들러에 yield 조건 분기, 툴팁 힌트 추가 |

---

## 2026-11-17 — 내 자리 찾기 기능 구현

**한 일**
- 하단 바에 `📍 내 자리 찾기` 버튼 추가 (무임승차자 숨김)
- 클릭 시 플레이어 지정석 위에 황금빛 플레인 오버레이를 3초간 펄스 표시
  - 페이드 인(0~400ms) → 펄스 3회 → 페이드 아웃(2400~3000ms)
  - `THREE.PlaneGeometry` + `MeshBasicMaterial` (기존 좌석 메쉬 미변경)
  - 여러 번 클릭 시 기존 효과 취소 후 재시작 (중첩·오류 없음)
- 자동 이동 없음 — 이용자가 직접 걸어가도록 유지

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/features/ticket.js` | `highlightMySeat()` 추가, `initTicketUI()`에 `bFindSeat` 연결 |
| `index.html` | `#bFindSeat` 버튼 추가 (`bTicket` 옆) |

**설계 결정**
- 하이라이트는 별도 `PlaneGeometry`로 구현 — 파란 좌석 메쉬 완전 불변
- `requestAnimationFrame` 루프 내에서 `hmat.opacity`만 갱신 — Three.js 렌더 루프와 독립적으로 동작
- 모듈 레벨 변수(`_hlMesh`, `_hlRaf`)로 중복 클릭 방지 및 메모리 정리

**검증**
- `npm run build` 오류 없음

---

## 2026-11-17 — 승차권 발급 및 좌석 번호 표시 구현

**한 일**
- 승차권 구매 시 지정석(1~24번) 자동 배정 (`assignTicket`)
- 입장 직후 승차권 팝업 자동 표시 (`#myTicketModal`)
- 하단 바 `🎫 승차권 확인` 버튼 추가 (무임승차자 숨김)
- 머리받침 위 좌석 번호 레이블 스프라이트 추가 (`buildSeatLabels`)
  - 지정석: 연회색 배경 + 번호, 내 지정석: 황금색 배경
  - 자유석: 초록 배경 + "자유"
- 호버 툴팁 개선: 좌석 ID → `"5번석 · 내 자리"` / `"자유석 · 착석 중"` 등
- 승무원 검표 팝업에 지정석 번호 포함 (`"1호차 · 7번 지정석 (가상)"`)
- NPC 착석 전 플레이어 지정석 선점 → NPC 중복 착석 방지

**변경 파일**

| 파일 | 변경 내용 |
|---|---|
| `js/state.js` | `ticket: null` 필드 추가 |
| `js/world/data.js` | `displayNum: 1~24` 추가 (자유석 null) |
| `js/world/scene.js` | `seatLabelMeshes`, `buildSeatLabels()`, `refreshSeatLabels()` 추가 |
| `js/features/ticket.js` | **신규**: `assignTicket()`, `showMyTicket()`, `initTicketUI()` |
| `js/features/conductor.js` | `TICKET` 상수 제거, `openTicket()` 동적 레이블로 교체 |
| `js/game.js` | `buildWorld`에 `buildSeatLabels`, `spawnActors`에 `assignTicket` + NPC 필터, `initInput` 툴팁 개선 |
| `js/ui/ui.js` | `initTicketUI()` 호출 추가 |
| `js/main.js` | 입장 후 `showMyTicket()` 자동 호출 |
| `index.html` | `#myTicketModal`, `#bTicket`, `ticket.js` 로드 추가 |
| `css/style.css` | 승차권 팝업 레이아웃 스타일 추가 |

**설계 결정**
- 검표용 `#tkModal`과 확인용 `#myTicketModal`을 분리 → 두 흐름 독립 유지
- `assignTicket()`은 `spawnActors()` 내에서 NPC 착석 전에 호출 → `GameState.occ`에는 미등록, NPC 필터로만 보호
- `ticket.js`는 ui.js 뒤 game.js 앞에 로드 → `initTicketUI()`가 `buildUI()` 내에서 안전하게 호출됨
- `roundRect` 사용: 구형 WebView(iOS 15 미만) 미지원 가능성 있으나 기능 동작에는 무관

**검증**
- `npm run build` 오류 없음

---

## 2026-11-17 — 멀티플레이 확장 대비 상태 구조 정리

**목적**
Supabase Realtime 기반 멀티플레이 확장을 위해 게임 상태를 중앙화하고, 행위자 상태의 직렬화/역직렬화 구조를 준비합니다.

**변경 파일 (신규 1개 + 수정 10개)**

| 파일 | 변경 내용 |
|---|---|
| `js/state.js` (**신규**) | `GameState` 중앙 저장소: `carId`, `hasTicket`, `ended`, `inspecting`, `kick`, `occ` |
| `js/world/data.js` | `SEATS`에 `seatType: 'reserved'|'free'` 추가, `const occ = {}` 제거 |
| `js/core.js` | `hasTicket`, `ended`, `inspecting`, `kick` 선언 제거 (렌더링 전역만 유지) |
| `js/characters/actor.js` | `occ` → `GameState.occ` (5곳), `actorSnapshot()` 및 `applyActorSnapshot()` 추가 |
| `js/characters/npc.js` | `occ` → `GameState.occ` (1곳) |
| `js/features/conductor.js` | `kick`, `ended`, `inspecting`, `hasTicket` → `GameState.*` (9곳) |
| `js/features/nook.js` | `inspecting` → `GameState.inspecting` (1곳) |
| `js/features/vendor.js` | `inspecting` → `GameState.inspecting` (1곳) |
| `js/repo.js` | 프로필 키 v1 → v2, `carId` 필드 추가, Supabase 교체 메서드 주석 추가 |
| `js/game.js` | `ended`, `inspecting`, `occ` → `GameState.*`, `saveNow()`에 `carId` 포함 |
| `js/main.js` | `GameState.hasTicket`, `GameState.carId = 1` 초기화 |
| `index.html` | `state.js` 로드 순서 0번으로 추가 |

**설계 결정**

- `GameState.occ` 현재 구조: `seatId → actorId`
  향후 승차권 시스템: `seatId → { reservedBy: userId|null, occupiedBy: actorId|null }`
- 지정석(24개, `seatType: 'reserved'`): `zone: 'normal'` 일반 2인석
- 자유석(8개, `seatType: 'free'`): `zone: 'table'` 중앙 4인 테이블석
- 원격 이용자 행위자는 `npc: true`로 생성하면 `sitDown()`이 `saveNow()`를 호출하지 않음
- `actorSnapshot(a)` 반환 형태: `{ id, name, carId, x, z, ry, state, seatId, nookId }`

**검증**
- `npm run build` 오류 없음
- `npm run dev` 오류 없음
- 맨 변수(`occ`, `hasTicket`, `ended`, `inspecting`, `kick`) 참조 0건 — 모두 `GameState.*` 경유

**향후 승차권 시스템 구현 시 필요한 작업**

1. **승차권 발급** — `Repo.issueTicket(carId)` → `{ carId, seatId }` 반환
   `GameState.ticket = { carId, seatId }` 에 저장
2. **지정석 착석 로직** — `sitDown()` 에서 `seatType === 'reserved'`이고 `reservedBy !== P.id`인 경우 임시 착석 처리
3. **자리 반환 요청** — 지정석 소유자가 임시 착석자에게 반환 요청; 서버에서 권한 확인 후 처리
4. **객차 이동** — `Repo.returnTicket(carId)` 후 `GameState.occ = {}`, `GameState.carId = newCarId`
5. **좌석 상태 확장** — `GameState.occ[seatId]` 를 `{ reservedBy, occupiedBy }` 형태로 마이그레이션
6. **원격 이용자 렌더링** — `mkActor(id, name, { ...appearance, npc: true })` 후 `applyActorSnapshot(remoteActor, snap)` 반복 호출

---

## 2026-11-17 — 단일 HTML을 순수 웹 리소스로 분리

**한 일**
- 단일 파일 `느린 기차.html`을 `index.html` + `css/style.css` + `js/*.js`(14개)로 분리
- JS를 기능별로 나눔: repo / data / core / scene / actor / npc / sound / snack / conductor / nook / vendor / ui / game / main
- 거대한 `build()`를 `initRenderer → buildWorld → spawnActors → restoreProfile → initCamera → initInput → initAutoSave → startLoop` 8단계로 분리
- CSS 중복 규칙(`.bar`, `.hud`의 `flex-wrap`) 통합, 섹션 주석 추가
- 안 쓰던 변수 `lastSave` 제거, 공용 헬퍼(`$`, `toast`, `panel`)를 `core.js`로 이동
- README / PRD / DEVLOG / PROMPTS 문서 작성

**문제 → 해결**
| 문제 | 해결 |
| --- | --- |
| ES 모듈로 나누면 `file://`로 열 때 CORS로 막힘 | 일반 `<script>`로 로드, 전역 공유. 대신 `index.html`의 로딩 순서를 고정하고 주석으로 경고 |
| 파일 분리 후 전역 선언 중복/누락 우려 | 전체를 이어 붙여 `node --check`로 구문 검사 |
| "주석 없는 함수" 누락 방지 | 스크립트로 함수 선언 윗줄 주석 여부 점검 (누락 0개) |

**검증 한계**
- 문법 검사와 주석 점검만 수행했고, 브라우저에서 직접 실행해 확인하지는 못함 → 실제 화면 확인 필요

**다음에 할 일**
- 브라우저/모바일에서 분리 후 동작 확인
- 접근성(팝업 dialog, 포커스) / 보안(SRI) 보강

---

## 1단계 (날짜 미기록) — 베타 기능 구현 (단일 HTML)

**구현한 것**
1. 컷어웨이 3D 객차, 창문, 햇살 그림자, 32석 배치
2. 시점 조작(드래그/휠/핀치) + 가로·세로 반응형 시점
3. 창밖 풍경 스크롤(시차 + 반복)
4. 플레이어 이동·착석·일어나기, 통로 충돌 제한
5. 베타 승객 NPC 5명 (중복 착석 방지 `occ`)
6. 간식 판매원 (정차·말걸기·가상 구매·손에 듦·버리기)
7. 말풍선 문구 선택
8. 입장 방식 선택 + 승무원 검표 + 강제 퇴장
9. 의자 틈 숨기
10. 임시 합성 기차 소리 + 볼륨/음소거 유지
11. localStorage 저장/복원

**알려진 이슈 → 해결**
| 문제 | 해결 |
| --- | --- |
| 한 줄짜리 이벤트 핸들러 끝에 `//` 주석을 붙이자 뒤 코드가 주석 처리됨 | 해당 위치는 `/* */` 사용. 규칙으로 문서화 |
| 플레이어/NPC가 같은 좌석에 앉는 문제 | `occ[seatId]`로 점유·예약 관리, 이미 점유면 거부 |
| 통로에서 사람끼리 겹침 | `separate()`로 서로 밀어냄 |
| 말풍선·텍스트 텍스처 누적으로 메모리 증가 우려 | 제거 시 `map.dispose()` / `material.dispose()` |
| 브라우저 자동재생 정책으로 소리 미재생 | 입장 버튼 클릭 직후 `RailSound.start()` 호출, 일시정지 상태면 다음 터치에서 `resume` |
| 숨은 플레이어 이름표가 납작하게 찌그러짐 | 몸을 낮출 때 이름표 스케일을 역보정 |

**당시 검증 한계**
- 문법 검사만 통과, 화면 확인은 사용자가 직접 하고 이상한 부분을 알려주는 방식

---

## 백로그

- [ ] Supabase 연결 (`Repo` 교체 + NPC → 실제 접속자)
- [ ] 접근성: `role="dialog"`, `aria-modal`, 포커스 트랩, `aria-live`
- [ ] 보안: CDN SRI, 서버 연동 시 인증/권한/입력 검증
- [ ] 실제 기차 소리 파일 (출처·라이선스 표기)
- [ ] 모바일 조이스틱
- [ ] 숨기 규칙 유지 여부 결정
