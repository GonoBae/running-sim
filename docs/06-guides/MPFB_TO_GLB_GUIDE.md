# MPFB 설치와 GLB 내보내기

현재 PC 기준: MPFB 2.0.17 · Blender 5.2.2 · **이미 설치했다면 GLB 내보내기부터**

![Blender에서 웹으로 모델을 전달하는 순서](../assets/diagrams/export.svg)

## MPFB 설치

| 순서 | 메뉴·행동 |
| --- | --- |
| 1 | [공식 다운로드](https://extensions.blender.org/add-ons/mpfb/versions/) → 2.0.17 ZIP · 압축 유지 |
| 2 | Edit → Preferences → Get Extensions |
| 3 | 오른쪽 위 메뉴 → Install from Disk… → ZIP 선택 |
| 4 | Add-ons → MPFB 활성화 확인 |
| 5 | 3D 화면 위에서 N → MPFB 탭 |

새 사람: **New human → From scratch → Create human**. 기본 시험에 피부·옷은 필수가 아닙니다.

받아 둔 파일: `data/raw/makehuman/archives/mpfb-2.0.17.zip` · [공식 설치 안내](https://static.makehumancommunity.org/mpfb/docs/getting_started.html)

## 내보낼 복사본

**.blend 저장 → Object Mode → Human 선택 → N → MPFB → Operations → Export copy**

| 옵션 | 값 |
| --- | --- |
| Bake modelling shapekeys | 끄기 |
| Mask modifiers | Remove mask modifiers |
| Subdiv modifiers | Remove subdiv modifiers |
| Delete helpers | 켜기 · 치마처럼 보이는 보조 형상 제거 |
| Remove basemesh | 끄기 · 몸체 유지 |
| Create collection | 켜기 |

**Create export copy → Outliner의 export copy에서 복사본 몸체 + 복사본 뼈대만 선택**

[복사본 공식 설명](https://static.makehumancommunity.org/mpfb/docs/exporting/export_copy.html)

## GLB 내보내기

**File → Export → glTF 2.0 (.glb/.gltf)**

| 옵션 | 값 |
| --- | --- |
| Format | glTF Binary (.glb) |
| Include → Selected Objects | 켜기 |
| Data → Mesh → Apply Modifiers | 끄기 |
| Data → Shape Keys | 켜기 · 체형 변형 |
| Data → Skinning | 켜기 · 뼈와 몸체 연결 |
| Animation | 현재 달리기 동작이 없으므로 끄기 |

**runner-test.glb → Export glTF 2.0 → 관리자 작업실 → GLB 등록 → 표시 테스트**

[남성형·여성형 자동 생성](MODEL_PREVIEW.md) · [관리자 모델 관리](../03-screens/ADMIN_SCREEN.md)

| 파일 | 프로젝트 내 위치 |
| --- | --- |
| 편집 원본 | `data/processed/makehuman/runner-test.blend` |
| 기본 출력 | `experiments/model-preview/public/models/runner-test.glb` |

.blend 원본은 보관합니다. GLB 변환만으로 달리기·cm/kg 설정이 자동 생성되지는 않습니다.

[웹 실행과 자동 변환 명령](MODEL_PREVIEW.md) · [검증 결과](../05-validation/CHARACTER_VALIDATION.md)
