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
