# 러너 단계 화면 실행

2026-10-22 · M84 · **현재 로컬 기능 시험**

![현재 네 단계 실제 화면](../assets/images/stages-overview.png)

[신체 세팅으로 시작](http://127.0.0.1:5173/body) · [자세 재생](http://127.0.0.1:5173/pose) · [신체 변경 달리기·검증](../05-validation/BODY_RUNNING.md).

신체 위 부위·화살표를 잡아 길이를 조절하고, 화면 안 `전체 크기` 손잡이로 배율을 바꿉니다. [직접 조작·취소·보조 입력](../05-validation/BODY_EDITOR.md).

자세에서는 몸통·다리·아래팔을 위아래로 드래그하고 재생합니다. [상체 기울기 조작·검사](../05-validation/UPPER_LEAN.md). [조작 시점·양쪽 반영·검사](../05-validation/POSE_EDITOR.md).

모델 위 **착지 방식 → 뒤꿈치 / 미드풋 / 앞꿈치**를 고르면 양발에 반영됩니다. [접촉 비교·코드·검사](../05-validation/FOOT_STRIKE.md).

## 실행

Node.js 22.12 이상 · 이번 시험 24.19.0. 모델 원본·GLB는 Git에서 제외하므로 다른 PC에 별도로 복사합니다.

```sh
cd experiments/model-preview
npm ci
npm run dev
```

| 준비 | 위치·방법 |
| --- | --- |
| 기본 모델 | `public/models/runner-male.glb`, `runner-female.glb` |
| 동작 자료 | `public/review-data/shared-gait-reference.json` / 모델 버전 검사 |
| 빌드 | `npm run build` |
| 접속 | `/body` → `/pose` → `/course` → `/backtest` |
| 이전 비교·관리자 | 진입 제거 / [이전 주소와 보존 범위](../05-validation/STAGE_PAGES.md#이전-비교-화면) |

코스·백테스팅은 준비 안내만 표시합니다. 신체에서 부위 길이·전체 크기를 수정한 뒤 자세 단계로 이동하면 변경한 신체로 달립니다. 다리 들림·팔꿈치·상체 기울기·착지 방식은 그대로 유지합니다. 서버 저장·관리자 통계·다른 자세 항목의 직접 조작은 현재 단계 화면에 연결하지 않았습니다.

## 설정 유지

![단계 이동 순서](../assets/diagrams/journey.svg)

이 탭에서 이동하거나 새로고침해도 모델·신체·팔·다리 설정을 유지합니다. 새 세션의 기본값은 기본 신체·다리 0cm·팔 0°이며 브라우저가 임시 저장을 차단하면 안내합니다.

## Blender 자동 변환

남성형·여성형은 설치된 MPFB와 원본 .blend로 각각 생성합니다. 원본 저장 없이 체형 적용·뼈대 재맞춤 후 별도 GLB를 만듭니다.

```powershell
& 'B:/SteamLibrary/steamapps/common/Blender/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python 'experiments/model-preview/export_variants.py'
```

생성 파일은 public/models/runner-male.glb와 runner-female.glb입니다. 새 해시의 모델은 관절 검사 후 허용 프로필을 갱신해야 합니다. 기존 단일 시험 모델 변환은 아래 명령입니다.

프로젝트 루트에서 실행하는 Windows 예시입니다. 메뉴 방식은 [MPFB와 GLB 안내](MPFB_TO_GLB_GUIDE.md)를 참고하세요.

```powershell
& 'B:/SteamLibrary/steamapps/common/Blender/blender.exe' --background --factory-startup --disable-autoexec 'data/processed/makehuman/runner-test.blend' --python-exit-code 1 --python 'experiments/model-preview/export_runner.py'
```

| 조건 | 내용 |
| --- | --- |
| Blender | 이번 시험 5.2.2 LTS · 다른 PC는 실행 파일 경로 변경 |
| 입력 | data/processed/makehuman/runner-test.blend |
| 기준 OBJ | data/raw/makehuman/mpfb-2.0.17/data/3dobjs/base.obj 필요 |
| 구조 | Human + 연결 뼈대 · hm08 원본 정점/면 · 기본 자세 |
| 구조 불일치 | 잘못된 보조 형상 삭제를 피하도록 중단 |
| 출력 | public/models/runner-test.glb · 원본 .blend 저장 안 함 |
| 변환 | 보조 형상 제거 · 단색 재질 · 뼈/12개 변형키 유지 |
| 제약 | 뼈 영향 최대 4개 · 피부/복장/동작 추가 없음 |

## 확인 범위

| 확인 | 아직 검증 전 |
| --- | --- |
| Edge GLB 표시 · 무릎 · 첫 변형키 · 복원 | 전체 관절/변형키 · 실제 치수 |
| 남성형·여성형 부위 길이 6종 최소/최대 · 다른 길이 유지 · 자세·전체 배율·복원 | 모든 조합의 피부 품질·관통·실제 치수 대응 |
| 8개 자세 입력의 양 끝 각도·방향 · 제한·복원 · 높이 변경 호환 | 신체 충돌·접지·인체 타당성 전체 |
| TypeScript 검사 · 빌드 | Mac · 모바일 · 성능 · 달리기 |

[검증 결과](../05-validation/CHARACTER_VALIDATION.md) · [초기 전달 수치](../05-validation/reports/model-preview-verification.json) · [높이·뼈대 검사](../05-validation/reports/model-scale-verification.json) · [자세 제한 검사](../05-validation/reports/running-pose-verification.json) · [내보내기 기록](../../experiments/model-preview/public/models/runner-test.export.json) · [기술](../04-technical/TECH_SPEC.md) · [구조](../04-technical/ARCHITECTURE.md) · [개발 순서](../01-planning/DEVELOPMENT_PLAN.md)
