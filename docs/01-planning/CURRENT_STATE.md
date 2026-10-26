# 현재 결과물

2026-10-26 · **구현 기준: M93 / 문서 대조: 코드·기능별 검증 기록·실제 화면**

![현재 구현과 미완료 범위](../assets/diagrams/current-implementation.svg)

현재 네 단계 모두 접속할 수 있습니다. `/backtest`는 설정한 페이스로 달리는 **코스 주행**이며, 자세에 따른 기록 예측·비교는 아직 구현하지 않았습니다.

## 실제 화면

![신체·자세·코스·주행 실제 구현 화면, 2026-10-26](../assets/images/current-stages.png)

현재 코드를 별도 브라우저 세션에서 촬영한 화면입니다. 코스 캡처의 출발점·3km·6분/km는 문서용 예시이며 사용자 설정을 변경하지 않았습니다.

| 현재 결과 | 구현·검사 근거 | 남은 한계 |
| --- | --- | --- |
| 신체 길이·전체 크기 직접 조절 → 달리기 반영 | [M79](../05-validation/BODY_RUNNING.md) · [M80](../05-validation/BODY_EDITOR.md) | 실제 신체 치수·모든 조합의 피부/충돌 미검증 |
| 양발 공통 동작·다리 들림·양팔 굽힘·상체 기울기·착지 선택 | [M75](../05-validation/CMU_UNIFIED_STANCE.md) · [M81](../05-validation/POSE_EDITOR.md) · [M82](../05-validation/UPPER_LEAN.md) · [M84](../05-validation/FOOT_STRIKE.md) | 자연스러움·압력·힘·기록 효과 검증과 구분 |
| 출발·방향·바퀴/km·페이스·도착점 | [M87](../05-validation/COURSE_SETTINGS.md) · [M89](../05-validation/COURSE_GOAL.md) · [M90](../05-validation/COURSE_PACE.md) | 실제 거리·도착점 일치 미검증 |
| 코스 이동·같은 시점 자세·재생/정지·목표 종료 | [M88](../05-validation/COURSE_RUNNING.md) | 코너 인체 역학·고도·자세별 기록 계산 없음 |
| 원본 자동 검사·항공사진 확인 오류 수정 | [M92](../05-validation/COURSE_AUTOMATION.md) · [M93](../05-validation/COURSE_IMAGERY.md) | D 경로 약 1.182km/바퀴 · 사용자 3km B 이후/4km C 이후 차이 전체 미해결 |

정확한 입력·단위·범위·검수 계약은 [요구사항 명세서](../02-requirements/REQUIREMENTS.md)에서만 관리합니다. 위 검사는 각 실험의 범위이며 전체 서비스나 실측 정확도 인증이 아닙니다.

## 현재와 이력의 구분

| 구분 | 기준 |
| --- | --- |
| 현재 코드 | `experiments/model-preview/src/entry.ts` → `stages.js` |
| 기본 동작 | CMU **35_17** 유래 양측 공통 동작 + 후속 보정 · **127_06 미사용** |
| 현재 코스 | D `d-ebb99e9a6425` · 수동 거리 배율 없음 |
| 현재 저장 | 같은 탭 설정 임시 보관 · 새로고침 복원 · 주행 시간은 재시작 |
| 과거 실험 | M01–M93 각 문서는 해당 시점 계약·수치·화면 보존 · 현재 기능 안내와 구분 |
| 제거된 진입 | 이전 비교·관리자 주소 · 알고리즘/검사/기록은 보존 |
| PDF 교재 | 모델링 시험 당시의 교재 · [적용 시점과 현재 안내](../06-guides/modeling-lab/README.md) |
| 제안·미구현 | R06 기록 A/B · R16 정식 근거 비교 · 운영 관리자/통계 · 얼굴/가슴·다리 간격 입력 |

[기획](SERVICE_PLAN.md) · [화면](../03-screens/SCREEN_SPEC.md) · [기술](../04-technical/TECH_SPEC.md) · [구조](../04-technical/ARCHITECTURE.md) · [실행](../06-guides/MODEL_PREVIEW.md) · [문서 검증 보고서](../05-validation/reports/documentation-sync.json)

그림 원본·생성: [current-state.cjs](../assets/diagrams/current-state.cjs) · [실제 화면 캡처·렌더 검사](../assets/diagrams/check-current-docs.cjs). 새 기능 구현이나 기존 수치의 재검증을 뜻하지 않는 문서 동기화입니다.
