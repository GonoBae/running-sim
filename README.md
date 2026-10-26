# running-sim

**내가 만든 러너와 자세로 실제 코스를 달리는 모습을 관찰하는 서비스입니다.**

![실제 코스 주행과 같은 시점 자세 · 구현 화면](docs/assets/images/course-running-side.png)

위 그림은 실제 구현 화면입니다. **신체 세팅 → 자세 세팅 → 코스 세팅 → 백테스팅**으로 이어지며, [항공사진 대조·경로 수정](docs/05-validation/COURSE_IMAGERY.md)와 [목표 페이스·주행](docs/05-validation/COURSE_PACE.md)을 확인할 수 있습니다. 정밀 실측과 자세별 기록 예측은 미검증입니다. [문서 목록](docs/README.md) · [단계별 화면](docs/05-validation/STAGE_PAGES.md).

## 문서

[신체를 직접 잡아 조절하는 현재 화면 →](docs/05-validation/BODY_EDITOR.md)

[몸통·다리·아래팔로 자세를 조절하는 현재 화면 →](docs/05-validation/UPPER_LEAN.md)

[뒤꿈치·미드풋·앞꿈치 선택·양발 접촉 비교 →](docs/05-validation/FOOT_STRIKE.md)

[실제 코스 주행·재생 영상·검증 →](docs/05-validation/COURSE_RUNNING.md)

**[문서 전체 목록과 작성 상태 →](docs/README.md)**

[요구사항 명세서](docs/02-requirements/REQUIREMENTS.md) · [화면 정의서](docs/03-screens/SCREEN_SPEC.md) · [기술내역서](docs/04-technical/TECH_SPEC.md)

[로컬 실행 가이드](docs/06-guides/MODEL_PREVIEW.md) · [검증 기록](docs/05-validation/CHARACTER_VALIDATION.md)

문서 우선으로 진행하며 설명 → 검토 → 작은 작업 → 코드와 설명 → 다음 단계 순서를 따릅니다. 모델 원본·GLB는 Git 제외 파일로 다른 PC에 별도 전달합니다.
