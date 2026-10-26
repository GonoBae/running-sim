# 코스 설정 · M87

> **실험 시점 기록** · 본문의 화면·수치·‘현재/다음’은 해당 M 실험 당시 기준입니다. [2026-10-26 현재 결과물](../01-planning/CURRENT_STATE.md)에서 채택된 기능·후속 보정·남은 한계를 확인하세요. 기존 검사 결과를 새로 통과한 것으로 바꾸지 않았습니다.

2026-10-22 · **구현·입력·보존·재생 검사 완료** · R03·R08·R15 / D06 / SCR04 / M85→M87

![코스 설정 실제 화면 · 정면](../assets/images/course-settings-front.png)

**실제 구현 화면.** 사용자 확인을 받은 B 경로에서 출발점·방향·바퀴를 정하고, 오른쪽에서 이어받은 러너를 재생합니다. 예시는 남성형·전체 105%·변경 비율·다리 +5cm·팔 +10°·상체 +8°·미드풋입니다.

[코스 화면 열기](http://127.0.0.1:5173/course) · [측면 실제 화면](../assets/images/course-settings-side.png) · [모바일 실제 화면](../assets/images/course-settings-mobile.png) · [백테스팅 요약 화면](../assets/images/course-settings-backtest.png)

![기존 달리기를 유지하면서 코스 설정을 추가하는 구조](../assets/diagrams/course-settings.svg)

코스 변경은 `course` 필드에만 저장합니다. 입력·단위·오류 계약은 [요구사항 M87 / 세부 M85](../02-requirements/REQUIREMENTS.md#m87--확인한-코스-설정)에 모았습니다.

후속 [M88 실제 코스 주행](COURSE_RUNNING.md)을 연결했습니다. 이 문서의 백테스팅 요약 화면은 M87 당시의 구현 이력입니다.

현재 경로·목표·도착 표시의 후속 변경은 [M89](COURSE_GOAL.md)입니다. 이 문서의 화면은 당시 바퀴 목표와 B 경로의 검증 이력입니다.

## 핵심 코드

| 위치 | 역할 |
| --- | --- |
| [course.ts](../../experiments/model-preview/src/course.ts) | 원본 좌표 검사 → 구면 거리·누적 거리 → 클릭 지점을 가장 가까운 경로 선분에 투영 |
| [course-editor.ts](../../experiments/model-preview/src/course-editor.ts) | 지도·출발점·방향 화살표·바퀴 수·입력 차단·재시도 |
| [stage-state.ts](../../experiments/model-preview/src/stage-state.ts) | 기존 version 1에 코스 초안 추가 · 이전 저장 자료 호환 |
| [stages.js](../../experiments/model-preview/src/stages.js) | 신체·자세 값 유지 → 기존 달리기 재사용 → 설정 요약 전달 |

```ts
// 출발점은 유지하고 진행 방향만 반전합니다.
pointAt(startDistanceM + (direction === 'forward' ? travelM : -travelM));
// 총 거리는 출발 위치와 방향에 관계없이 같습니다.
totalM = lengthM * laps;
```

## 검증

| 검사 | 결과·증거 |
| --- | --- |
| 거리·경로 | [단위 검사](reports/course-settings-unit.json) · 독립 사각형 검산·잘못된 형상 차단·출발/방향/1·100바퀴 2,000조합 |
| 기존 동작 | [변경 전/후 비교](reports/course-motion-regression.json) · 남녀×기본/변형 체형×4착지×4시점 64표본의 뼈대와 표본 피부 좌표 동일 |
| 실제 화면·보존 | [브라우저 검사](reports/course-settings-ui.json) · 16조합의 단계 왕복·정확한 신체/자세 값·뼈대 좌표, 새로고침·입력 오류·터치·재시도 |
| 빌드·배포 형식 | [프로덕션 검사](reports/course-settings-production.json) · 타입 검사·빌드·정적 코스 자산과 단계 연결 |
| 문서 | [렌더링·링크 검사](reports/course-settings-docs.json) |

**검증 한계:** 지도상 한 바퀴는 1,209.65m이며 실측 거리가 아닙니다. 실제 휴대폰 조작감·현장 통행/고도·3D 코스 주행·기록 계산은 미검증 또는 미구현입니다.

## 재현·출처

| 자료 | 원본·생성 방식 |
| --- | --- |
| 코스 B | [사용자 확인·원본 ID](COURSE_CANDIDATE.md) → [생성 스크립트](../../experiments/model-preview/scripts/build-course-asset.py) → [서비스 자산](../../experiments/model-preview/public/courses/lotte-garden-b-v1.json) |
| 지도 | 2026-10-22T06:21:36Z OSM 자료 · © OpenStreetMap contributors / [ODbL](https://www.openstreetmap.org/copyright) |
| 코드 검사 | [단위 검사](../../experiments/model-preview/tests/course.mjs) · [동작 회귀](../../experiments/model-preview/scripts/course-motion-fixture.cjs) · [UI 검사·캡처](../../experiments/model-preview/scripts/check-course-settings.cjs) |
| 화면 | 위 UI 검사에서 명시한 예시 입력을 실제 브라우저로 촬영 · 사용자 세션과 분리 · 이미지 생성 시안 아님 |
| 빌드 화면 | [프로덕션 검사 코드](../../experiments/model-preview/scripts/check-course-production.cjs) · 빌드 후 preview 서버에서 실행 |

```sh
python experiments/model-preview/scripts/build-course-asset.py
node experiments/model-preview/tests/course.mjs
node experiments/model-preview/scripts/course-motion-fixture.cjs
node experiments/model-preview/scripts/check-course-settings.cjs
node experiments/model-preview/scripts/check-course-production.cjs
node docs/assets/diagrams/check-course-docs.cjs settings
```

Node 24, Python, Playwright/Edge 사용. UI 검사에는 `PLAYWRIGHT_PATH`, 문서 검사에는 `NODE_MODULES_DIR`를 설치 경로로 지정합니다. 동작 검사는 보관한 변경 전 fixture와 비교하며 `--capture`는 새 기준을 의도적으로 만들 때만 사용합니다.

[화면 정의](../03-screens/COURSE_SCREEN.md) · [구현 흐름](../04-technical/COURSE_PIPELINE.md) · [문서 목록](../README.md)
