# DEVLOG — 개발 일지

> 날짜가 기록되지 않은 이전 작업은 **"1단계"**로 묶어 적었습니다.
> 앞으로는 작업할 때마다 아래 템플릿으로 맨 위에 추가하세요.

```md
## YYYY-MM-DD — 제목
- 한 일:
- 문제 → 해결:
- 다음에 할 일:
```

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
