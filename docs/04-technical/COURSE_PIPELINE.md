# 코스 입력과 설정 전달

![현재 자산 생성과 화면 실행 구조](../assets/diagrams/current-architecture.svg)

현재는 D 경로·바퀴/km·목표 페이스를 사용합니다. M87/B·M88 시점의 아래 그림은 초기 연결 구조 이력입니다.

2026-10-26 · M87–M93 · **코스 설정·주행 구현 완료 / 기록 계산은 후속**

M93 현재: [항공사진 대조·경로 오류 수정](../05-validation/COURSE_IMAGERY.md). 남동쪽 광장 우회를 제거한 D 경로를 사용합니다. M92 원본 검사는 유지하며 현장 도착점 차이 전체는 아직 미해결입니다.

![코스 입력과 기존 달리기의 연결](../assets/diagrams/course-settings.svg)

확인한 경로의 후속 D 자산을 정적으로 제공하고 TypeScript·SVG로 표시합니다. 기존 달리기 실행 코드를 재사용하므로 코스 선택이 신체·자세 계산에 개입하지 않습니다.

| 단계 | 구현 위치 | 확인 방법 |
| --- | --- | --- |
| 공개 자료 → C 원본 검증 | [sync-course.mjs](../../experiments/model-preview/scripts/sync-course.mjs) · [M92 원본](../05-validation/reports/course-automation-source.json) | 8개 way·79개 원본 구간·연결·구면 길이 검사 |
| C → 현재 D 자산 | [correct-course.mjs](../../experiments/model-preview/scripts/correct-course.mjs) · [M93](../05-validation/COURSE_IMAGERY.md) | 고정 원본 해시·확인한 연결점 제거·이전 경로/설정 이전·출처 보존 |
| 거리·출발·방향 | [course.ts](../../experiments/model-preview/src/course.ts) | WGS84 → 지역 미터 좌표 · 원본 구면 길이 · 사각형 독립 검산 |
| 지도·조건 입력 | [course-editor.ts](../../experiments/model-preview/src/course-editor.ts) | 입력·터치·오류·재시도 |
| 상태·미리보기 | [stage-state.ts](../../experiments/model-preview/src/stage-state.ts) · [stages.js](../../experiments/model-preview/src/stages.js) | 기존 version 1 호환 · 신체·자세·동작 동일 |
| 주행 | [course-playback.ts](../../experiments/model-preview/src/course-playback.ts) · [course-run-view.js](../../experiments/model-preview/src/course-run-view.js) | 같은 시계·실제 경로·표시 복제본 / [M88 검사](../05-validation/COURSE_RUNNING.md) |

정확한 필드·단위·차단 기준은 [요구사항 M87 / 세부 M85](../02-requirements/REQUIREMENTS.md#m87--확인한-코스-설정), 실행 결과는 [M87 검증](../05-validation/COURSE_SETTINGS.md)에서 관리합니다. 앱은 같은 서버의 코스 JSON만 읽으며 외부 지도 API나 타일에 의존하지 않습니다.

## M88 주행 연결

![같은 시간에서 경로 이동과 자세를 재생하는 구조](../assets/diagrams/course-running.svg)

실행기는 원래 좌표계에서 관절·피부를 계산하고, 별도 복제본의 상위 그룹에 경로 위치·방향을 적용합니다. 선형 주기 이동을 상쇄한 뒤 경로 이동을 더하므로 기존 주기 전진이 중복되지 않습니다.

## 후속 범위

![첫 코스 설정과 후속 기능의 구분 · M85 설계 이력](../assets/images/course-scope.png)

M85의 코스 확인·입력·기존 설정 연결을 M87에서 구현했습니다. M88에서 3D 코스 주행을 구현했습니다. 기록 계산·고도·계정 저장은 별도 작업이며 실측 거리도 미검증입니다.

[화면](../03-screens/COURSE_SCREEN.md) · [확보 증거](../05-validation/COURSE_FEASIBILITY.md) · [기술내역](TECH_SPEC.md) · [D06](../01-planning/DEVELOPMENT_PLAN.md)
