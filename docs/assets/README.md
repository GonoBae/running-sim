# 문서 그림과 원본

2026-10-04 · **시안·설계도·실제 구현 화면을 구분합니다.**

![문서와 검토를 중심으로 진행하는 협업 순서](diagrams/review-workflow.svg)

| 그림 | 성격 | 원본·생성 방식 |
| --- | --- | --- |
| 메인·캐릭터·코스·좌우 주행 | 정적 디자인 시안 | `prompts/*-prompt.txt` + `images/`의 대응 PNG · 기존 생성 이미지 |
| 서비스·기술·구조·비교·단계 | 기획·설계도 | [generate.cjs](diagrams/generate.cjs) → SVG |
| 협업·동작·편집 화면·체형·데이터 | 최신 검토용 설계도 | [planning.cjs](diagrams/planning.cjs) → SVG |
| 문서 분류·요구사항 연결 | 문서 관리도 | [catalog.cjs](diagrams/catalog.cjs) → SVG |
| 부위 길이 처리 순서 | 현재 구현 설명 | [body-lengths.svg](diagrams/body-lengths.svg) 직접 작성 |
| 길이 입력·관리자 길이 노출 | 실제 로컬 구현 화면 | [촬영 스크립트](../../experiments/model-preview/scripts/capture-body-lengths.cjs) → PNG |
| 모델·높이·자세·관리자 기존 화면 | 기존 로컬 시험 당시 캡처 | Playwright 캡처 · 당시 검증 JSON 보존 |

과거 캡처는 현재 UI 전체를 보장하지 않습니다. 관리자 통계의 숫자는 시험 데이터이며 실제 서비스 이용자 수가 아닙니다.

최신 디자인 시안·캡처는 `images/`, 이전 디자인 시안은 `images/archive/`에 보관합니다. 파일명은 출처 추적을 위해 유지했습니다.

## 설계도 재생성

```sh
node docs/assets/diagrams/generate.cjs
node docs/assets/diagrams/planning.cjs
node docs/assets/diagrams/catalog.cjs
```

SVG를 그림으로 삽입하므로 Markdown 뷰어의 다이어그램 확장 기능이 없어도 볼 수 있습니다. 원본을 수정한 뒤 글자 잘림·링크·실제 문서 렌더링을 확인합니다.

[문서 목록](../README.md) · [검증 기록](../05-validation/CHARACTER_VALIDATION.md)
