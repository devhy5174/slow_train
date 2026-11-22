## 2026-11-22 — 크리스마스 테마 간소화: 눈 제거 + 나무 전구

### 변경 파일
- `public/js/themes/christmas.js` — 눈 전부 제거, 기존 나무에 전구 조명 추가

### 변경 내용
- **제거**: 낙설 파티클, 지붕 눈, 언덕·나무 눈 모자, 눈 바닥, 대형 크리스마스 트리
- **유지**: 외벽 전구 스트링 2열·리본 보우, 내부 전구·랜턴·리스·전광판
- **추가**: `_buildTreeLights()` — 기존 scenery() 나무 25그루×양쪽에 다색 전구 4개씩, 나선형 배치, 반짝임 애니메이션. scene.js 나무와 동일 scroll(k=1, p=90)로 완벽 동기화

---

## 2026-11-22 — 크리스마스 테마 외부 장식 대폭 확장

### 변경 파일
- `public/js/themes/christmas.js` — 외부 전구·리본, 지붕 눈, 낙설, 창밖 눈 풍경 추가

### 추가 내용
- **기차 외벽 전구 스트링**: 양쪽 외벽에 상·하 2열 전구선 (다색+황금), 창 기둥마다 빨간 리본 보우
- **기차 지붕 눈**: trainRoof에 흰 슬랩 추가 (아치 크라운 y 계산 활용)
- **낙설 파티클**: Three.Points 180개, 외벽 바깥 z=±3~15 영역에서 완만히 낙하
- **창밖 눈 풍경**: 언덕·나무·집 위 흰 눈 모자, 집 창문 따뜻한 노란 불빛
- **대형 크리스마스 트리**: 3단 콘+별+눈 모자+8색 전구, 창밖 6개소 배치 (양쪽)
- **눈 바닥 오버레이**: 반투명 흰 평면으로 DayNight 녹색 바닥 덮음
- dispose() 에서 SCN·scene 완전 정리, 모바일 성능 고려 (지오메트리·재질 최소화)

---

## 2026-11-22 — 밤 모드 객실 천장 조명 + 눈 발광 버그 수정

### 변경 파일
- `public/js/features/daynight.js` — 객실 PointLight 5개 추가, interiorInt 프리셋 추가
- `public/js/characters/avatar.js` — 눈·볼터치 MeshBasicMaterial → MeshStandardMaterial

### 문제 → 해결
- 밤 모드에서 객실이 너무 어두움 → 아이보리 PointLight 5개(천장 y=2.4) 추가, 밤=1.0·노을=0.3·낮=0 보간
- 캐릭터 눈이 밤에 과도하게 빛남 → MeshBasicMaterial(조명 무시) → MeshStandardMaterial(조명 반응)
- PointLight distance=5.5, decay=2 → 창밖 풍경에 불필요한 빛 없음
- intensity<0.01일 때 light.visible=false 처리 → 모바일 셰이더 연산 절약

---

## 2026-11-22 — 낮·노을·밤 시간대 자동 전환 추가

### 변경 파일
- `public/js/features/daynight.js` (신규) — 시간대 판정·조명 보간·달·별 생성
- `public/js/game.js` — 조명 ref 변수명 변경, DayNight.init/tick 연동
- `index.html` — devTimePanel 버튼·daynight.js 스크립트 태그 추가
- `public/css/style.css` — devTimePanel 스타일
- `public/js/main.js` — ?dev=1 URL 파라미터 처리

### 기능 요약
- 접속자 현지 시각 기준 낮(06~17시) / 노을(17~19시) / 밤(19~06시) 자동 적용
- 60초 동안 하늘 색상·조명 색상·강도·풀밭 바닥색을 부드럽게 보간 전환
- 밤: 달 메쉬(SphereGeometry) + 별 파티클(Points, 220개) 생성 — 창밖 하늘에 배치
- 개발자 버튼: ?dev=1 접속 시 상단 중앙에 ☀️낮 / 🌇노을 / 🌙밤 즉시 전환 버튼 표시
- 객실 내부·커튼·좌석·기존 기능 모두 영향 없음

### 다음 할 일
- (선택) 커튼 열림 비율과 연동해 창밖 빛 색상 반영
- (선택) 밤 시간 열차 내부 전등 밝기 조정

---

## 2026-11-22 — 기차멍 모드 추가 + 로딩 시간 단축

### 변경 파일
- `public/js/features/trainview.js` (신규) — 기차멍 모드 진입/종료 로직
- `public/js/game.js` — 카메라 lerp·이동 차단·fit() 가드 추가
- `public/js/features/conductor.js` — 기차멍 중 검표 팝업 생략, 무임승차 퇴장 시 모드 종료
- `public/js/features/loading.js` — 로딩 시간 5초 → 3초
- `index.html` — 기차멍 버튼·오버레이 UI 추가
- `public/css/style.css` — 기차멍 오버레이·구름 버튼 스타일
- `public/js/ui/ui.js` — initTrainViewUI() 호출 추가

### 기능 요약
- 앉은 상태 + 헤드셋 착용 시 🚂 기차멍 버튼 표시 (구름 pulse 스타일)
- 버튼 클릭 → 창가 고정 시점으로 부드럽게 카메라 전환
- 기차멍 중 모든 UI 숨김 / 캔버스 클릭·키보드 입력 완전 차단
- 기차멍 중 승차권 팝업·자리 안내 팝업 생략 (무임승차 퇴장은 정상)
- 모바일 기기 회전 시 카메라 리셋 방지

### 다음 할 일
- 기차멍 카메라 각도 미세 조정 (좌석 타입별 최적화 가능)

## 2026-11-20 — 끝벽 느린기차 광고 배너 4개 추가

### 변경 파일
- `public/js/world/scene.js` — SIDE_BANNERS 데이터, `_makeBannerTex()`, `buildEndWallDecor` 배너 패널 추가

### 변경 이유
기존 광고판 위 빈 공간(y≈1.73~2.19)에 느린기차 테마 배너 추가 요청

### 동작
- 앞/뒤 끝벽 각 2개씩 총 4개, 1.3×0.37m 가로 배너
- 창밖 여유 / 간식 / 느리게 / 풍경역 — 각각 다른 색상·이모지·카피

---

## 2026-11-20 — 로딩 화면 추가 (픽셀아트 기차 애니메이션)

### 변경 파일
- `public/js/features/loading.js` (신규) — 픽셀아트 기차 canvas 애니메이션, 연기 파티클, 타이핑 텍스트
- `index.html` — `#loadingScreen` 추가, loading.js 스크립트 태그 추가
- `public/css/style.css` — 로딩 화면 스타일(섹션 7) 추가
- `public/js/main.js` — `showLoadingScreen()` 호출, 완료 콜백으로 승차권 팝업 연동

### 변경 이유
게임 접속이 빨라서 로딩 화면이 보이지 않음 → 5초 고정 표시 후 페이드 아웃

### 동작
- 탑승 버튼 클릭 → 로딩 화면 등장 (기차 위아래 bounce, 연기 파티클, "기차 탑승중..." 타이핑)
- 5초 후 페이드 아웃 → 승차권 팝업(해당자만) 표시

---

## 2026-11-20 — 화이트보드 포스트잇 기능 추가

### 변경 파일
- `public/js/features/whiteboard.js` (신규) — 포스트잇 UI, Supabase 저장/로드, 로컬 폴백
- `public/js/world/scene.js` — 화이트보드 클릭 메쉬 등록, 포스트잇 3D 텍스처(3×3 그리드)
- `public/js/game.js` — 화이트보드 클릭 처리 추가
- `public/js/ui/ui.js` — initWhiteboard() 호출 추가
- `index.html` — 화이트보드 모달 추가, whiteboard.js 스크립트 태그
- `public/css/style.css` — 포스트잇 팝업 UI 스타일

### 기능
- 앞쪽 끝벽 화이트보드 클릭 시 팝업 오픈
- 기본: 보기 모드 (전체 메모 목록, 최신순)
- "나도 남기기" → 쓰기 모드 (문구 5개 선택 + 이모티콘 10개)
- 날짜 자동 기재, Supabase DB 저장 (없으면 localStorage 폴백)
- 3D 보드에 포스트잇 최대 9개(3열×3행) 부착 모습 반영

### 다음 할 일
- Supabase `whiteboard_postits` 테이블 생성 필요 (SQL 별도 제공)

---

## 2026-11-18 — 캐릭터 외형 전면 리디자인 (얼굴·몸통·모자·카트)

### 변경 파일
- `public/js/characters/actor.js` — 몸통·팔다리 구조 리디자인
- `public/js/characters/avatar.js` — 얼굴·모자·헤드폰 리디자인
- `public/js/features/conductor.js` — 승무원 머리색 모자와 동일하게(네이비)
- `public/js/features/vendor.js` — 판매원 머리색 갈색 변경, 카트 "매점카트" 텍스트 추가

### 변경 이유
캐릭터 디자인 품질 개선 요청: 각진 몸통→곡선형, 단순 얼굴→표정 추가, 모자→실제 모자 형태, 카트 라벨 추가

### 주요 변경 내용

#### 얼굴 (avatar.js)
- 일반 승객: 눈썹·입 제거 → 살짝 미소(`TorusGeometry` 0.65π 호, `rotation.z = Math.PI * 1.175`)
- 승무원·판매원: 반달눈(`TorusGeometry` π 호) + 활짝 웃는 큰 미소 (`_addSmileFace`)

#### 몸통 (actor.js)
- `BoxGeometry` 직사각형 → `LatheGeometry` 곡선형 원뿔(위좁고 아래넓음, Roblox 스타일)
- `DoubleSide` 머티리얼 + 상단·하단 `CircleGeometry` 캡으로 내부 투명 문제 해결
- 어깨 구체 `SphereGeometry` → 납작한 타원형(`scale.set(1.0, 0.70, 0.88)`)
- 팔: `CylinderGeometry(0.055)` 원기둥 + 살색 주먹 `SphereGeometry(0.07)`
- 다리: `CylinderGeometry(0.07)` 원기둥 + 검정 신발 `SphereGeometry(0.082)`
- 목: `CylinderGeometry(0.09, 0.09, 0.06)` 추가 (HEAD_Y와 살짝 겹침)

#### 모자 (avatar.js)
- 승무원: 크라운+브림디스크+금색밴드+앞챙(BoxGeometry+원기둥 라운드 엣지) 구조
- 판매원: 위로 살짝 넓어지는 위생모 크라운+하단 접힘 밴드

#### 머리색·카트
- 승무원 머리색 → 네이비(`0x1c3a6b`, 모자와 동일)
- 판매원 머리색 → 갈색(`0x5a3a1a`)
- 카트 뒷면(z=+0.276)에 "매점카트" Canvas 텍스트 라벨 추가

### 다음 할 일
- Supabase 연동 시 `channel.send(actorSnapshot(P))`으로 헤드폰 상태 포함 브로드캐스트 (주석 위치: sound.js:110)
- 추가 캐릭터 디자인 피드백 반영
