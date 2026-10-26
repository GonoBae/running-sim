# 문서 그림과 원본

2026-10-22 · **시안·설계도·실제 구현 화면을 구분합니다.**

![문서와 검토를 중심으로 진행하는 협업 순서](diagrams/review-workflow.svg)

| 그림 | 성격 | 원본·생성 방식 |
| --- | --- | --- |
| M93 항공사진 대조 | 실영상 좌표 중첩·국소 수정·실제 앱 | [영상 수집](diagrams/course-imagery-fetch.py) → `outputs/course-imagery/` · [그림 생성](diagrams/course-imagery.py) → `images/course-imagery-{detail,overview}.png` · [화면 검사](../../experiments/model-preview/scripts/check-course-imagery.cjs) → `images/course-imagery-*.png` · [출처/해시](../05-validation/reports/course-imagery-evidence.json) · Esri/Vantor/Earthstar/GIS User Community, Kakao/국토지리정보원, OSM/ODbL |
| M92 원본 자동 검증 | 구현 구조·실제 지도/주행 | [SVG 원본](diagrams/course-automation.svg) · [검사/촬영](../../experiments/model-preview/scripts/check-course-automation.cjs) → `images/course-automation-*.png` · © OpenStreetMap contributors / ODbL |
| M91 사용자 기준 거리 보정 (철회 이력) | 실제 구현 전후 지도·주행 | [화면 검사/촬영](../../experiments/model-preview/scripts/check-course-calibration.cjs) → `images/course-calibration-*.png` · [계산 원본 SVG](diagrams/course-calibration.svg) · 원본 좌표 유지 · © OpenStreetMap contributors / ODbL |
| M90 페이스·거리 대조 | 실제 구현 화면·사용자 B/C 확인 | [촬영](../../experiments/model-preview/scripts/capture-course-pace.cjs) → `images/course-pace-*.png` · [구조 SVG](diagrams/course-pace.svg) · [거리 검산 Python](diagrams/course-distance-audit.py) → [지도 SVG](diagrams/course-distance-audit.svg) · © OpenStreetMap contributors / ODbL |
| M89 거리·도착점 | 실제 구현 화면·지도 원본 비교 | [UI 검사](../../experiments/model-preview/scripts/check-course-goal.cjs)·[촬영](../../experiments/model-preview/scripts/capture-course-goal.cjs) → `images/course-goal-*.png` · [경로 생성](diagrams/course-shortcut.py) → [SVG](diagrams/course-shortcut.svg) · [흐름 원본](diagrams/course-goal.svg) · © OpenStreetMap contributors / ODbL |
| M88 실제 코스 주행 | 구현 화면·실제 동시 재생 영상 / 시안 아님 | [UI 검사](../../experiments/model-preview/scripts/check-course-running.cjs)·[촬영/검사](../../experiments/model-preview/scripts/capture-course-running.cjs) → `outputs/course-running/` → `images/course-running-{front,side,overview,mobile}.png` / `videos/course-running.webm` · [구조 SVG](diagrams/course-running.svg) · © OpenStreetMap contributors / ODbL |
| M87 실제 코스 설정 | 구현 화면·명시한 예시 입력 / 시안 아님 | [UI 검사·캡처](../../experiments/model-preview/scripts/check-course-settings.cjs) → `outputs/course-settings/` → `images/course-settings-{front,side,mobile,backtest}.png` · [구조 SVG 원본](diagrams/course-settings.svg) · [자산 생성](../../experiments/model-preview/scripts/build-course-asset.py) · © OpenStreetMap contributors / ODbL |
| M86 수정 후보 B | 사용자 정정 반영 / ⑤ 제외·①–④ 굽은 길 · M87 사용자 선형 확인 완료 · 그림 자체는 당시 후보 검토 기록 | [생성](diagrams/course-candidate.py) `--candidate B` → [검사 JSON](../05-validation/reports/course-candidate-b.json) / [SVG](diagrams/course-candidate-b.svg) → [렌더링](diagrams/render-course.cjs) `course-candidate-b` → `images/course-candidate-b.png` · © OpenStreetMap contributors / ODbL |
| M86 외곽 한 바퀴 후보 A · 반려 이력 | 실제 OSM 선분 연결 / 사용자 확인 전 · 지도 계산 거리이며 실측 아님 | [후보 추출·생성](diagrams/course-candidate.py) → [검사 JSON](../05-validation/reports/course-candidate.json) / [SVG](diagrams/course-candidate.svg) → [PNG 렌더링](diagrams/render-course.cjs) `course-candidate` → `images/course-candidate.png` · © OpenStreetMap contributors / ODbL |
| M85 실제 지도·코스 시안·전달·범위 | OSM 실제 좌표 참고도 / 코스 UI는 미구현 시안 / 러너는 예시 입력으로 촬영 | [공개 자료 추출](diagrams/course-research.py) → [좌표 JSON](../05-validation/reports/course-source.json) → [SVG 생성](diagrams/course-review.py) → [PNG 렌더링](diagrams/render-course.cjs) · [러너 촬영](diagrams/capture-course-runner.cjs) → `images/course-runner-example.png` · `diagrams/course-*.svg` / `images/course-*.png` · OSM © contributors / ODbL |
| M84 착지 3종 | 실제 정면·측면·발 확대·선택 화면 | [검사](../../experiments/model-preview/scripts/check-foot-strike.cjs) + [캡처](../../experiments/model-preview/scripts/capture-foot-strike.cjs) + [그림 생성](diagrams/foot-strike.py) → `images/foot-strike-*` / [직접 작성 SVG](diagrams/foot-strike.svg) · [검증](../05-validation/FOOT_STRIKE.md) |
| M83 미드풋 착지 | 실제 선택·정면/측면 캡처 / 피부점 접촉 수치 그림 | [입력·기하 검사](../../experiments/model-preview/scripts/check-midfoot.cjs) + [캡처](../../experiments/model-preview/scripts/capture-midfoot.cjs) + [그림 생성](diagrams/midfoot.py) → `images/midfoot-*` / [직접 작성 SVG](diagrams/midfoot.svg) · [검증](../05-validation/MIDFOOT.md) |
| M82 몸통 직접 조절 | 같은 시점 0°/+8° 정면·측면 / 실제 데스크톱·터치 화면 | [입력 검사](../../experiments/model-preview/scripts/check-upper-lean.cjs) + [실제 캡처](../../experiments/model-preview/scripts/capture-upper-lean.cjs) + [그림 생성](diagrams/upper-lean.py) → `images/upper-lean-*` / [직접 작성 SVG](diagrams/upper-lean.svg) · [검증](../05-validation/UPPER_LEAN.md) |
| M81 자세 직접 조절 | 정면·측면·모바일 실제 화면 / 기존 두 자세 값 연결 | [입력 검사·캡처](../../experiments/model-preview/scripts/check-pose-editor.cjs) + [생성 원본](diagrams/pose-editor.py) → `images/pose-editor-screen.png`, [흐름 SVG](diagrams/pose-editor.svg) · [검증](../05-validation/POSE_EDITOR.md) |
| M80 신체 직접 조절 | 실제 데스크톱·모바일 화면 / 같은 신체 값 전달 구조 | [입력 검사·캡처](../../experiments/model-preview/scripts/check-body-editor.cjs) + [생성 원본](diagrams/body-editor.py) → `images/body-editor-*`, [흐름 SVG](diagrams/body-editor.svg) · [검증](../05-validation/BODY_EDITOR.md) |
| M79 신체와 달리기 | 현재 남녀 정면·측면 실제 화면 / 검사 기록 연결 | [캡처](../../experiments/model-preview/scripts/capture-body-running.cjs) + [그림 생성](diagrams/body-running.py) → `images/body-running-*` · [설명](../05-validation/BODY_RUNNING.md) |
| M78 네 단계 화면 | 실제 화면 / 신체·자세 구현·뒤 두 단계 준비 | [캡처 검사](../../experiments/model-preview/scripts/check-stages.cjs) + [그림 생성](diagrams/stages.py) → `images/stages-*` · [검증](../05-validation/STAGE_PAGES.md) |
| M77 팔꿈치·다리 설정 | 실제 남녀·정면/측면·각도 비교 / 구현·기하·재생 확인 | [UI 캡처](../../experiments/model-preview/scripts/check-elbow-bend-ui.cjs) + [그림 생성](diagrams/cmu-elbow-bend.py) → `images/cmu-elbow-bend-*` · [구조 SVG](diagrams/cmu-elbow-bend-plan.svg) · [검사](../05-validation/CMU_ELBOW_BEND.md) |
| 확정 네 단계 흐름 | 신체→자세→코스→백테스팅 / 구현 상태와 구분 | [원본 생성 코드](diagrams/generate.cjs) · `node docs/assets/diagrams/generate.cjs journey` → [journey.svg](diagrams/journey.svg) / [R15](../02-requirements/REQUIREMENTS.md#r15-설정-단계와-r02-직접-조작) |
| M76 다리 들림 높이 | 실제 남녀·정면/측면·입력별 무릎 높이 / 구현·기하·재생 검사 완료 | [UI 캡처](../../experiments/model-preview/scripts/check-leg-height-ui.cjs) + [그림 생성](diagrams/cmu-leg-height.py) → `images/cmu-leg-height-*` · [구조 SVG](diagrams/cmu-leg-height-plan.svg) · [검사](../05-validation/CMU_LEG_HEIGHT.md) |
| M75 양발 접촉 통합 | 실제 정면·측면·접촉 이동·무릎 굽힘 / 기하·재생 검사 완료·물리 검증 아님 | [검사·캡처](../../experiments/model-preview/scripts/verify-unified-stance.cjs) + [그림 생성](diagrams/cmu-unified-stance.py) → `images/cmu-unified-stance-*` · [구조 SVG](diagrams/cmu-unified-stance-plan.svg) · [기록](../05-validation/CMU_UNIFIED_STANCE.md) |
| M74 왼발 합류 우회 축소 | 실제 정면·측면·누적 경로 / 작은 수치 개선·외형 차이 작음·밀림 잔여 | [검사·캡처](../../experiments/model-preview/scripts/verify-support-join.cjs) + [그림 생성](diagrams/cmu-support-join.py) → `images/cmu-support-join-*` · [구조 SVG](diagrams/cmu-support-join-plan.svg) · [기록](../05-validation/CMU_SUPPORT_JOIN.md) |
| M73 착지 초반 지지 연결 | 실제 정면·측면·양발 피부점 경로 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-early-support.cjs) + [그림 생성](diagrams/cmu-early-support.py) → `images/cmu-early-support-*` · [구조 SVG](diagrams/cmu-early-support-plan.svg) · [기록](../05-validation/CMU_EARLY_SUPPORT.md) |
| M72 전신 재검토 | 실제 정면·측면·착지 피부점·해제 굽힘·몸통 회전 / 관찰 완료·보정 없음 | [측정·캡처](../../experiments/model-preview/scripts/inspect-full-run.cjs) + [그림 생성](diagrams/cmu-full-run-review.py) → `images/cmu-full-run-review-*` · [기록](../05-validation/CMU_FULL_RUN_REVIEW.md) |
| M71 손목과 손 모양 | 실제 정면·측면·양손 근접·손목 측정 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-hand-pose.cjs) + [그림 생성](diagrams/cmu-hand-pose.py) → `images/cmu-hand-pose-*` · [구조 SVG](diagrams/cmu-hand-pose-plan.svg) · [기록](../05-validation/CMU_HAND_POSE.md) |
| M70 팔 앞뒤 움직임 | 실제 정면·측면·몸통 기준 팔 각도 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-arm-swing.cjs) + [그림 생성](diagrams/cmu-arm-swing.py) → `images/cmu-arm-swing-*` · [구조 SVG](diagrams/cmu-arm-swing-plan.svg) · [기록](../05-validation/CMU_ARM_SWING.md) |
| M69 무릎 옆 흔들림 | 실제 정면·측면·고관절 기준 무릎 경로 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-knee-lateral.cjs) + [그림 생성](diagrams/cmu-knee-lateral.py) → `images/cmu-knee-lateral-*` · [초기 설계 SVG](diagrams/cmu-knee-lateral-plan.svg) · [기록](../05-validation/CMU_KNEE_LATERAL.md) |
| M68 해제 구간 무릎 왕복 | 실제 정면·측면·무릎 굽힘 곡선 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-shared-release.cjs) + [그림 생성](diagrams/cmu-shared-release.py) → `images/cmu-shared-release-*` · [기록](../05-validation/CMU_SHARED_RELEASE.md) |
| M67 양발 지지 후반 연결 | 실제 정면·측면·왼발 경로·반 주기 연결 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-shared-support-bilateral.cjs) + [그림](diagrams/cmu-shared-support-bilateral.py) → `images/cmu-shared-support-bilateral-*` · [기록](../05-validation/CMU_SHARED_SUPPORT_BILATERAL.md) |
| M66 오른발 지지 후반 연결 | 실제 정면·측면·피부점 경로 / 수치·재생 검사 완료·외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-shared-support.cjs) + [그림](diagrams/cmu-shared-support.py) → `images/cmu-shared-support-*` · [기록](../05-validation/CMU_SHARED_SUPPORT.md) |
| M65 착지·지지·밀어내기 관찰 | 실제 연속 장면·무릎/골반 곡선·계산 단계별 지지점 / 관찰 완료·보정 없음 | [관찰·캡처](../../experiments/model-preview/scripts/inspect-shared-stance.cjs) + [그림](diagrams/cmu-shared-stance-review.py) → `images/cmu-shared-stance-review-*` · [기록](../05-validation/CMU_SHARED_STANCE_REVIEW.md) |
| M64 양발 착지 접근 | 실제 정면·측면·고정 피부 경로·검사 / 사용자 외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-shared-approach.cjs) + [그림](diagrams/cmu-shared-approach.py) → `images/cmu-shared-approach-*` · [영상 촬영](../../experiments/model-preview/scripts/capture-shared-approach.cjs) · [기록](../05-validation/CMU_SHARED_APPROACH.md) |
| M63 전신 좌우 자세 | 실제 같은 단계 정면·측면·전신/피부 검사 / 사용자 외형 검토 전 | [검사·캡처](../../experiments/model-preview/scripts/verify-bilateral-pose.cjs) + [그림](diagrams/cmu-bilateral-pose.py) → `images/cmu-bilateral-pose-*` · [영상 촬영](../../experiments/model-preview/scripts/capture-bilateral-pose.cjs) · [기록](../05-validation/CMU_BILATERAL_POSE.md) |
| M62 상체 중심 대응 | 중심점 검사 완료 / 사용자 전체 자세 품질 문제 / M63 후속 | [검사·캡처](../../experiments/model-preview/scripts/verify-upper-center.cjs) + [그림](diagrams/cmu-upper-center.py) → `images/cmu-upper-center-*` · [영상 촬영](../../experiments/model-preview/scripts/capture-upper-center.cjs) · [기록](../05-validation/CMU_UPPER_CENTER.md) |
| M61 양발 착지 접근 | 실제 반 주기 캡처·관절 중첩·지면/골반/상체 경로 / 관찰 완료·보정 없음 | [관찰·캡처](../../experiments/model-preview/scripts/inspect-approach-symmetry.cjs) + [그림·요약](diagrams/cmu-approach-symmetry.py) → `images/cmu-approach-symmetry-*` · [기록](../05-validation/CMU_APPROACH_SYMMETRY.md) |
| M60 몸 높이 연결 | 실제 비교·높이 곡선·착지 표면 검사 / 좌우 외형 차이는 M61 관찰 | [검사·캡처](../../experiments/model-preview/scripts/verify-body-height.cjs) + [그림·요약](diagrams/cmu-body-height.py) → `images/cmu-body-height-*` · [영상 촬영](../../experiments/model-preview/scripts/capture-body-height.cjs) · [기록](../05-validation/CMU_BODY_HEIGHT.md) |
| M59 전신 관찰 | 현재 동작 정면·측면 / 높이 보정 분해 / 상체·접지 후보 수치 / 보정 없음 | [관찰·촬영](../../experiments/model-preview/scripts/inspect-shared-gait-body.cjs) + [그림·요약 생성](diagrams/cmu-whole-body-audit.py) → `images/cmu-whole-body-*` · [기록](../05-validation/CMU_WHOLE_BODY_AUDIT.md) |
| M58 양발 공통 기준 | 실제 비교·반 주기 좌표·회전 속도 / 발목 사용자 확인 | [검사](../../experiments/model-preview/scripts/verify-shared-gait.cjs) + [그림 생성](diagrams/cmu-shared-gait.py) → `images/cmu-shared-gait-*` · [기록](../05-validation/CMU_SHARED_GAIT.md) |
| M51 좌우 전체 점검 | 실제 M50 측면·피부 높이·골반 이동·단계별 수치 | [관찰·촬영](../../experiments/model-preview/scripts/inspect-cmu-bilateral-chain.cjs) + [그림·요약 생성](diagrams/cmu-bilateral-chain-audit-figures.py) → `images/cmu-bilateral-chain-audit-*` · [기록](../05-validation/CMU_BILATERAL_CHAIN_AUDIT.md) |
| M50 왼발 방향 교정 | 실제 양발 정면/측면·발목 확대 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-left-ankle-direction.cjs) + [확대](../../experiments/model-preview/scripts/capture-cmu-left-ankle-close.cjs) + [그림 생성](diagrams/cmu-left-ankle-direction-figures.py) → `images/cmu-left-ankle-direction-*` · [기록](../05-validation/CMU_LEFT_ANKLE_DIRECTION.md) |
| M49 왼발 발목 점검 | 같은 착지 단계·동일 뼈 자세 가중치 비교 / 실제 화면 | [검사·촬영](../../experiments/model-preview/scripts/inspect-cmu-left-ankle-skin.cjs) + [그림 생성](diagrams/cmu-left-ankle-audit-figures.py) → `images/cmu-left-ankle-audit-*` · [기록](../05-validation/CMU_LEFT_ANKLE_AUDIT.md) |
| M48 접근 경로 | 실제 양발 정면/측면·지면 X 경로 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-swing-approach.cjs) + [그림 생성](diagrams/cmu-swing-approach-figures.py) → `images/cmu-swing-approach-*` · [JSON](../05-validation/reports/cmu-swing-approach.json) |
| M47 착지 경로 | 같은 순간 정면/측면·접지 순서·실제 피부점 측정 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-stance-contact.cjs) + [그림 생성](diagrams/cmu-stance-contact-figures.py) → `images/cmu-stance-contact-*` · [JSON](../05-validation/reports/cmu-stance-contact.json) |
| M46 앞뒤 재보정 | 실제 정면/측면·앞뒤 속도/발끝 높이·코드 흐름 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-fore-aft-release.cjs) + [그림 생성](diagrams/cmu-fore-aft-release-figures.py) → `images/cmu-fore-aft-release-*` · [JSON](../05-validation/reports/cmu-fore-aft-release-summary.json) |
| M45 좌우·발끝 보정 | 실제 정면/측면·발끝 높이·밀림 측정·코드 흐름 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-release-refinement.cjs) + [그림 생성](diagrams/cmu-release-refinement-figures.py) → `images/cmu-release-refinement-*` · [JSON](../05-validation/reports/cmu-release-refinement-summary.json) |
| M44 해제 지지점 연동 | 실제 정면/측면·밀림 측정·코드 흐름 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-pivot-release.cjs) + [그림 생성](diagrams/cmu-pivot-release-figures.py) → `images/cmu-pivot-release-*` · [JSON](../05-validation/reports/cmu-pivot-release.json) |
| M43 고정 해제 검토 | 실제 측면 연속 장면·지면 속도 분해 / 보정 없음 | [측정·캡처](../../experiments/model-preview/scripts/inspect-cmu-foot-release.cjs) + [그림 생성](diagrams/cmu-foot-release-figures.py) → `images/cmu-foot-release-*` · [JSON](../05-validation/reports/cmu-foot-release.json) |
| M42 오른발 짧은 고정 | 실제 정면/측면·고정과 해제 피부점 속도 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-foot-plant.cjs) + [그림 생성](diagrams/cmu-foot-plant-figures.py) → `images/cmu-foot-plant-*` · [녹화](../../experiments/model-preview/scripts/capture-cmu-foot-plant.cjs) · [JSON](../05-validation/reports/cmu-foot-plant.json) |
| M41 오른발 밀림 점검 | 같은 피부점 속도·궤적의 측정 그림 / 보정 없음 | [측정](../../experiments/model-preview/scripts/inspect-cmu-hip-reference-slip.cjs) + [그림 생성](diagrams/cmu-hip-reference-slip-figures.py) → `images/cmu-hip-reference-slip-*` · [JSON](../05-validation/reports/cmu-hip-reference-slip.json) |
| M40 오른발 고관절 기준 | 실제 정면/측면·기준 골반/착지 측정 곡선 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-hip-reference.cjs) + [그림 생성](diagrams/cmu-hip-reference-figures.py) → `images/cmu-hip-reference-*` · [녹화](../../experiments/model-preview/scripts/capture-cmu-hip-reference.cjs) · [JSON](../05-validation/reports/cmu-hip-reference.json) |
| M39 골반 좌우 이동 축소 | 실제 정면/측면 캡처·남녀 추가 이동/속도 측정 곡선 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-pelvis-sway.cjs) + [그림 생성](diagrams/cmu-pelvis-sway-figures.py) → `images/cmu-pelvis-sway-*` · [녹화](../../experiments/model-preview/scripts/capture-cmu-pelvis-sway.cjs) · [JSON](../05-validation/reports/cmu-pelvis-sway.json) |
| M38 양발 구간 연동 | 실제 정면/측면·회수 캡처·양발 적용량/골반 이동 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-stance-chain-bilateral.cjs) + [그림 생성](diagrams/cmu-stance-chain-bilateral-figures.py) → `images/cmu-stance-chain-bilateral-*` · [녹화](../../experiments/model-preview/scripts/capture-cmu-stance-chain-bilateral.cjs) · [JSON](../05-validation/reports/cmu-stance-chain-bilateral.json) |
| M37 오른발 구간 연동 재생 | 실제 정면/측면·회수 캡처·적용량/골반 이동 곡선 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-stance-chain-motion.cjs) + [그림 생성](diagrams/cmu-stance-chain-motion-figures.py) → `images/cmu-stance-chain-motion-*` · [재생 녹화](../../experiments/model-preview/scripts/capture-cmu-stance-chain-motion.cjs) · [JSON](../05-validation/reports/cmu-stance-chain-motion.json) |
| M36 착지 한 장면 연동 | 실제 정면/측면 캡처·관절 좌표 비교 / 정지 자세 검사 완료 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-stance-chain.cjs) + [그림 생성](diagrams/cmu-stance-chain-figures.py) → `images/cmu-stance-chain-*` · [JSON](../05-validation/reports/cmu-stance-chain.json) |
| M35 고관절 수직선 비교 | 실제 정면/측면/회수 캡처·수직선 잔차 / 로컬 검사 완료 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-hip-landing.cjs) + [그림 생성](diagrams/cmu-hip-landing-figures.py) → `images/cmu-hip-landing-*` · [영상 녹화](../../experiments/model-preview/scripts/capture-cmu-hip-landing.cjs) → `outputs/cmu-hip-landing/*.webm` · [JSON](../05-validation/reports/cmu-hip-landing.json) |
| M34 양발 지지 구간 비교 | 실제 정면/측면/회수 캡처·양발 이동량 / 로컬 검사 완료 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-bilateral.cjs) + [그림 생성](diagrams/cmu-bilateral-figures.py) → `images/cmu-bilateral-*` · [재생 녹화](../../experiments/model-preview/scripts/capture-cmu-bilateral.cjs) → `outputs/cmu-bilateral/*.webm` · [JSON](../05-validation/reports/cmu-bilateral.json) |
| M33 오른발 지지 구간 비교 | 실제 정면/측면/회수 캡처·이동량 그래프 / 로컬 구현·검사 완료 | [검사·캡처](../../experiments/model-preview/scripts/verify-cmu-landing.cjs) + [그림 생성](diagrams/cmu-landing-figures.py) → `images/cmu-landing-*` · [재생 녹화](../../experiments/model-preview/scripts/capture-cmu-landing.cjs) → `outputs/cmu-landing/*.webm` · [JSON](../05-validation/reports/cmu-landing.json) |
| M32 고관절 중점·안쪽 디딤 | M31 좌표 재분석 / 기준점 영향·안쪽 디딤 확인 / 보정 아님 | [계산·검사](../../experiments/model-preview/scripts/inspect-cmu-hip-center.py) + [그림 생성](diagrams/cmu-hip-center-figures.py) → `images/cmu-hip-center-*` · [JSON](../05-validation/reports/cmu-hip-center.json) · [재현·출처](../05-validation/CMU_HIP_CENTER_VALIDATION.md) |
| M31 모델 전달·골반·착지 위치 | 실제 캡처·측정 그래프 / 단계 차이 확인·직접 원인 미확정 | [측정 코드](../../experiments/model-preview/scripts/inspect-cmu-transfer.cjs) + [그림 생성](diagrams/cmu-transfer-figures.py) → `images/cmu-transfer-*` · [JSON](../05-validation/reports/cmu-transfer.json) · [요약](../05-validation/reports/cmu-transfer-summary.json) · [재현·출처](../05-validation/CMU_TRANSFER_VALIDATION.md) |
| M30 원본 좌표·좌우·순서 | 계산 뼈대·수치 그래프 / 골반·다리 검증 완료 | [독립 검사](../../experiments/model-preview/scripts/verify-independent-cmu.py) + [그림 생성](diagrams/cmu-independent-figures.py) → `images/cmu-independent-*` · [JSON](../05-validation/reports/cmu-independent.json) · [재현·출처](../05-validation/CMU_SOURCE_VALIDATION.md) |
| M29 한 주기 자세·궤적·교정 순서 | 실제 캡처·측정 곡선 / 다음 설계는 제안 | [측정·캡처](../../experiments/model-preview/scripts/inspect-cmu-cycle.cjs) + [그림 생성](diagrams/cmu-cycle-figures.py) → `images/cmu-cycle-*` · [설계 원본](diagrams/cmu-cycle-design.svg) · [JSON](../05-validation/reports/cmu-cycle-review.json) |
| M28 디딤 위치 원인·보정 전후 | 35_17 실패 실험 이력 · 사용자 검토 반려/기본 꺼짐 | [원인 도식 원본](diagrams/cmu-stance-cause.svg) · [검사·캡처](../../experiments/model-preview/tests/cmu-stance-width.cjs) + [그림 생성](diagrams/cmu-stance-figures.py) → `images/cmu-stance-*` · [JSON](../05-validation/reports/cmu-stance-width.json) |
| M27 후보별 중앙선/발목 정면 비교 | 과거 비교 캡처 · 127_06 사용 제외 결정 반영 · 정상 폭 판정 아님 | [측정·캡처](../../experiments/model-preview/scripts/inspect-cmu-step-width.cjs) + [그림 생성](diagrams/cmu-step-width-figures.py) → `images/cmu-step-width-*` · [JSON](../05-validation/reports/cmu-step-width.json) |
| M26 오른발 미끄러짐 전후·피부 속도·GIF | 실제 구현 캡처·독립 피부 속도 검사 · 자연스러움 검토 전 | [캡처](../../experiments/model-preview/scripts/capture-cmu-sole-slip.cjs) + [그림 생성](diagrams/cmu-sole-slip-figures.py) → `images/cmu-sole-slip-*` · [검사 JSON](../05-validation/reports/cmu-sole-slip.json) |
| M25 원본 수평 이동 비교 · 측면/정면/GIF/궤적 | 실제 화면·계산 결과 · 자연스러움 검토 전 | [캡처](../../experiments/model-preview/scripts/capture-cmu-root-travel.cjs) + [그림 생성](diagrams/cmu-root-travel-figures.py) → `images/cmu-root-travel-*` · [검사 JSON](../05-validation/reports/cmu-root-travel.json) |
| 메인·캐릭터·코스·좌우 주행 | 정적 디자인 시안 | `prompts/*-prompt.txt` + `images/`의 대응 PNG · 기존 생성 이미지 |
| 서비스·기술·구조·비교·단계 | 기획·설계도 | [generate.cjs](diagrams/generate.cjs) → SVG |
| 협업·체형·이전 프레임 편집/데이터 제안 | 기존 검토용 설계도 · 동작 기본 흐름은 아래 그림으로 대체 | [planning.cjs](diagrams/planning.cjs) → SVG |
| 주요 자세 → 달리기 흐름·화면 | 흐름 합의 · 화면 배치 제안/미구현 | [running-motion.cjs](diagrams/running-motion.cjs) → `running-motion-flow.svg` / `running-motion-screen.svg` |
| 문서 분류·요구사항 연결 | 문서 관리도 | [catalog.cjs](diagrams/catalog.cjs) → SVG |
| M01 자세 저장 흐름·이전 화면 시안 | 현재 검사 범위 표시·기존 검토 시안 구분 | [pose-snapshot.cjs](diagrams/pose-snapshot.cjs) → `pose-snapshot-flow.svg` / `pose-snapshot-screen.svg` |
| 자세 저장 실제 화면·버튼·좁은 화면 | 2026-10-14 로컬 Edge 캡처 | [화면 검사](../../experiments/model-preview/tests/pose-snapshot-ui.cjs) → `outputs/pose-snapshot/` → 채택 PNG를 `images/pose-snapshot-*.png`로 복사 |
| 다리 올림 재생·조작부·좁은 화면 | 2026-10-14 M06 실제 Edge 캡처 | [검사 코드](../../experiments/model-preview/tests/leg-lift.cjs) → `outputs/leg-lift/` → `images/leg-lift-*.png` |
| 체형/자세 단계·좁은 화면 | M07 실제 Edge 캡처 | [단계 검사](../../experiments/model-preview/tests/setup-steps.cjs) → `outputs/setup-steps/` → `images/setup-*.png` |
| 왼쪽 팔꿈치 핸들·좁은 화면 | M08 실제 Edge 캡처 | [팔꿈치 검사](../../experiments/model-preview/tests/elbow-drag.cjs) → `outputs/elbow-drag/` → `images/elbow-drag-*.png` |
| 오른쪽 팔꿈치·겹침 분리·좁은 화면 | M09 실제 Edge 캡처 | [팔꿈치 검사](../../experiments/model-preview/tests/elbow-drag.cjs) · `ELBOW_SIDE=r` → `outputs/right-elbow-drag/` → `images/right-elbow-drag-*.png` |
| 기본 달리기 재검토 | M17 품질 미달 / 전신 기준 재구성은 검토안 | [원본 SVG](diagrams/run-baseline-review.svg) 직접 작성 · 현재 구조와 다음 검토 순서 |
| CMU 전신 후보·우리 GLB 전달 | 실제 모션캡처 재구성 / 전달 시험 · 서비스 적용 전 | [자료·사용 조건](../05-validation/FULL_BODY_REFERENCE.md) · [캡처](../../experiments/model-preview/scripts/capture-cmu-review.cjs) → `images/cmu-*-side.png`, `cmu-35-17-front.png` · [조합](../../experiments/model-preview/scripts/assemble-cmu-review.py) → `cmu-35-17-preview.gif` · 원본은 `data/raw/cmu/` |
| CMU 어깨 보정 전후 | M18 실제 화면 / 수치 검사 완료·시각 검토 중 | `images/cmu-shoulder-{before,after}.png` 동일 정면/45프레임 캡처 → [자르기·조합](diagrams/cmu-shoulder-comparison.py) → `images/cmu-shoulder-comparison.png` · 수정 전 캡처는 보존 이력 |
| CMU 반복·팔 간격 | M19 실제 화면 / 반복 수치 검사 완료·자연스러움 검토 중 | [촬영·표면 표본](../../experiments/model-preview/scripts/inspect-cmu-arms.cjs) → `outputs/cmu-loop/` → [조합](diagrams/cmu-loop-figures.py) → `images/cmu-loop-preview.gif`, `images/cmu-loop-arms.png` · [흐름 SVG](diagrams/cmu-loop-flow.svg) 직접 작성 |
| CMU 전신 점검·발 교정 | M20 실제 화면 / 수치 검사 완료·시각 검토 중 | [진단·촬영](../../experiments/model-preview/scripts/inspect-cmu-foot-frame.cjs) → `outputs/cmu-posture-audit/` → `images/cmu-foot-{before,after}.png` → [조합](diagrams/cmu-foot-comparison.py) → `images/cmu-foot-comparison.png` · 수정 전은 보존 이력 · [전신 현황 SVG](diagrams/cmu-posture-audit.svg) 직접 작성 |
| CMU 착지 높이·그래프 | M21 실제 화면 / 수치 검사 완료·시각 검토 중 | [캡처](../../experiments/model-preview/scripts/capture-cmu-ground.cjs) + [검증 JSON](../05-validation/reports/cmu-ground.json) → [조합·그래프](diagrams/cmu-ground-figures.py) → `images/cmu-ground-*.png`, `cmu-ground-preview.gif` · Pillow/Matplotlib |
| CMU 팔 간격·발목 재점검 | M22 실제 화면 / 팔 수치 검사 완료·발목 외형 미통과 | [촬영](../../experiments/model-preview/scripts/capture-cmu-arm-spacing.cjs) → `images/cmu-arm-spacing-{before,after}.png`, `cmu-ankle-recheck-{1,3}.png` → [조합·GIF](diagrams/cmu-arm-spacing-figures.py) → `cmu-arm-spacing-comparison.png`, `cmu-arm-spacing-preview.gif`, `cmu-ankle-recheck.png` |
| CMU 발목 상대 회전·피부 비교 | M23 실제 화면 / 회전 기준 수정·피부 접힘 남음 | [촬영](../../experiments/model-preview/scripts/capture-cmu-ankle.cjs) → `images/cmu-ankle-{overview,skin}-{before,after,neutral}[-bones].png` → [조합·검사 그래프·GIF](diagrams/cmu-ankle-figures.py) → `cmu-ankle-{overview-comparison,skin-comparison,rotations,skin-metrics}.png`, `cmu-ankle-preview.gif` · [표본 JSON](../05-validation/reports/cmu-ankle-relative.json) |
| CMU 발목 전달 흐름 | M23 검사 완료 범위 / 피부는 미완료 | [직접 작성한 SVG 원본](diagrams/cmu-ankle-transfer.svg) · 요구 계약/검사 기록에서 공용 |
| CMU 피부 가중치·골반 연쇄 | M24 실제 화면 / 피부 압축 개선·골반 비교 완료·자연스러움 검토 전 | [촬영](../../experiments/model-preview/scripts/capture-cmu-ankle-weights.cjs) → `images/cmu-ankle-weights-{before,after}[-map].png`, `cmu-lower-chain-front.png` → [조합·그래프·GIF](diagrams/cmu-ankle-weight-figures.py) → `cmu-ankle-weights-comparison[-map].png`, `cmu-lower-chain-comparison.png`, `cmu-ankle-weight-{trials,metrics}.png`, `cmu-ankle-weights-preview.gif` · [최종 표본](../05-validation/reports/cmu-ankle-weights.json) |
| 공중 높이 보정 비교·실제 화면 | M17 수치 검증 / 자연스러움 검토 중 · 2026-10-15 | [원본 전](../05-validation/reports/run-height-before.json) + [후](../05-validation/reports/run-contact.json) → [그래프 생성](diagrams/plot-run-height.py) → `images/basic-run-height-comparison.png` · [촬영](../../experiments/model-preview/scripts/capture-basic-run.cjs) → `outputs/basic-run-height/` → `images/basic-run-height-{cycle,desktop}.png` |
| 지지점·전진·공중 구간 | M16 실제 GLB/Edge 캡처 · 2026-10-15 | 이력 [촬영 코드](../../experiments/model-preview/scripts/capture-basic-run.cjs) → `outputs/basic-run-contact/` → `images/basic-run-contact-*.png` · 카메라도 이동량만큼 추적 · M15는 이전 소스 이력 |
| 팔·발·높이 전환 보정 화면·한 주기 | M15 실제 GLB/Edge 캡처 · 2026-10-15 | 이력 [촬영 코드](../../experiments/model-preview/scripts/capture-basic-run.cjs) → `outputs/basic-run-stable/` → `images/basic-run-stable-*.png` · M10/M14는 당시 촬영 이력 |
| 자료 기반 기본 달리기 화면·한 주기 | M14 실제 GLB/Edge 캡처 · 2026-10-15 | 이력 [촬영 코드](../../experiments/model-preview/scripts/capture-basic-run.cjs) → `outputs/basic-run-reference/` → `images/basic-run-reference-*.png` · M10 캡처는 당시 소스 이력 |
| 기본 달리기 순서 | M10 설계도 · 실측 자료 아님 | [basic-run.cjs](diagrams/basic-run.cjs) → `basic-run-cycle.svg` |
| 기본 달리기 화면·한 주기 | M10 실제 GLB/Edge 캡처 | [촬영 코드](../../experiments/model-preview/scripts/capture-basic-run.cjs) → `outputs/basic-run/` → `images/basic-run-*.png` · 좁은 화면은 [검사 코드](../../experiments/model-preview/tests/basic-run.cjs) |
| 아래팔 선택·점 가림 흐름 | M11 계약·로컬 검사 범위 | [body-picking.cjs](diagrams/body-picking.cjs) → `body-picking.svg` |
| 아래팔 강조·가려진 점·좁은 화면 | M11 실제 남녀 GLB/Edge 캡처 | [검사·촬영 코드](../../experiments/model-preview/tests/body-picking.cjs) → `outputs/body-picking/` → `images/body-picking-*.png` |
| 다리 간격 수정 전후 | M12 실제 남녀 GLB 정면 캡처 | [촬영·조합 코드](../../experiments/model-preview/scripts/capture-leg-stance.cjs) · 수정 전 `before`, 수정 후 `after` 실행 → `outputs/leg-stance/leg-stance-comparison.png` → `images/` · 이전 캡처는 당시 코드에서만 재현 |
| 부위 길이 처리 순서 | 현재 구현 설명 | [body-lengths.svg](diagrams/body-lengths.svg) 직접 작성 |
| 실측·현재 달리기 곡선 / 연속 화면 | Reznick CC0 데이터 AB01 + 현재 앱 · 원본 수치/한계는 비교 설계서 | [추출](diagrams/fetch-gait-reference.py) → `05-validation/reports/gait-reference-ab01.json` · [촬영](diagrams/capture-gait-comparison.cjs) → `outputs/gait-comparison/` · [그래프·조합](diagrams/plot-gait-comparison.py) → `images/gait-comparison-*.png` |
| 각도 기준 / 개선 구조 | 자료·코드 정의 / M13 외 후속 검토안 | [생성 코드](diagrams/gait-comparison.cjs) → `gait-angle-reference.svg`, `gait-improvement-plan.svg` |
| 실측 왼다리 비교 · 데스크톱/390px | M13 실제 Edge 캡처 | [검사·촬영 코드](../../experiments/model-preview/tests/reference-leg.cjs) → `outputs/reference-leg/desktop.png`, `narrow.png` → `images/reference-leg-*.png` · 실행 곡선은 [생성 코드](../../experiments/model-preview/scripts/build-reference-leg.cjs)로 추출 JSON에서 생성 |
| 정식 근거 비교 · 흐름/화면/근거 구분 | R16·SCR08 상세 설계 제안 · 인체/곡선은 예시 · 미구현 | [원본 생성 코드](diagrams/evidence-comparison.cjs) → `evidence-comparison-flow.svg`, `evidence-comparison-screen.svg`, `evidence-comparison-evidence.svg` · 아래 렌더링 명령 → 같은 이름의 PNG |
| 길이 입력·관리자 길이 노출 | 실제 로컬 구현 화면 | [촬영 스크립트](../../experiments/model-preview/scripts/capture-body-lengths.cjs) → PNG |
| 모델·높이·자세·관리자 기존 화면 | 기존 로컬 시험 당시 캡처 | Playwright 캡처 · 당시 검증 JSON 보존 |

과거 캡처는 현재 UI 전체를 보장하지 않습니다. 관리자 통계의 숫자는 시험 데이터이며 실제 서비스 이용자 수가 아닙니다.

최신 디자인 시안·캡처는 `images/`, 이전 디자인 시안은 `images/archive/`에 보관합니다. 파일명은 출처 추적을 위해 유지했습니다.

## M85 코스 그림 재생성

보존한 JSON으로 지도 그림을 다시 만듭니다. 러너 캡처는 예시 입력이며 원본 PNG도 함께 보관해 서버 없이 시안을 생성할 수 있습니다.

```sh
python docs/assets/diagrams/course-review.py
node docs/assets/diagrams/render-course.cjs
```

Python Pillow와 Playwright/Edge가 필요하며 `PLAYWRIGHT_PATH`로 설치 위치를 지정할 수 있습니다. 공개 지도 재조회는 `python docs/assets/diagrams/course-research.py --fetch`로 명시하며, 새 조회로 과거 증거를 덮어쓰기 전에 자료 시점·그림을 함께 갱신합니다.

[문서 검사 코드](diagrams/check-course-docs.cjs)는 `NODE_MODULES_DIR`의 Playwright·marked로 링크·이미지·SVG·13개 문서를 검사하며 [결과 JSON](../05-validation/reports/course-docs.json)을 남깁니다. 실제 러닝 코스의 현장 검증과 별개입니다.

## 설계도 재생성

```sh
node docs/assets/diagrams/generate.cjs
node docs/assets/diagrams/planning.cjs
node docs/assets/diagrams/catalog.cjs
node docs/assets/diagrams/pose-snapshot.cjs
node docs/assets/diagrams/running-motion.cjs
node docs/assets/diagrams/basic-run.cjs
node docs/assets/diagrams/body-picking.cjs
node docs/assets/diagrams/evidence-comparison.cjs
```

근거 비교 SVG의 공유용 PNG는 Playwright/Edge로 원본 SVG를 열고 `svg` 요소를 캡처해 `images/evidence-comparison-*.png`에 저장합니다. [렌더링 코드](diagrams/render-evidence-comparison.cjs)를 저장소 루트에서 실행하며 `PLAYWRIGHT_PATH`로 설치 경로를 지정할 수 있습니다.

SVG를 그림으로 삽입하므로 Markdown 뷰어의 다이어그램 확장 기능이 없어도 볼 수 있습니다. 원본을 수정한 뒤 글자 잘림·링크·실제 문서 렌더링을 확인합니다.

## 실측 달리기 비교 재생성

**M14 이후 주의:** 아래 비교의 현재 앱은 수정 전 이력입니다. 촬영/해시 검사는 당시 소스가 필요하며 현재 코드로 이력 JSON·그림을 덮어쓰지 않습니다. 최신 동작은 위 M17 촬영 코드를 사용합니다.

저장소 루트에서 실행합니다. Python의 `h5py`, `numpy`, `requests`, `matplotlib`와 Playwright/Edge, 실행 중인 Vite, 기존 GLB가 필요합니다.

```sh
python docs/assets/diagrams/fetch-gait-reference.py
node docs/assets/diagrams/capture-gait-comparison.cjs
python docs/assets/diagrams/plot-gait-comparison.py
node docs/assets/diagrams/gait-comparison.cjs
node docs/assets/diagrams/check-gait-comparison.cjs
```

첫 단계는 공개 원본의 필요한 구간만 읽습니다. 확인한 도구: Python 3.12 · h5py 3.16 · NumPy 2.5 · Matplotlib 3.11; 한글 글꼴은 Windows 맑은 고딕, 다른 환경은 Noto Sans CJK KR/AppleGothic을 사용합니다.

[문서 목록](../README.md) · [검증 기록](../05-validation/CHARACTER_VALIDATION.md)
