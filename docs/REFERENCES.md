# 참고 자료와 후속 검토 목록

원래 대화에서 전달받은 참고 자료와 열람 범위를 보존한 목록입니다. 이번 초기 준비 작업에서는 웹 페이지나 실제 데이터 파일을 새로 검토하지 않았습니다. 아래 설명은 전달받은 맥락이며, 구현 전에 원문·파일·사용 조건을 다시 확인해야 합니다.

## 1. Running with added leg mass (2023)

- 출처: https://data.mendeley.com/datasets/b92bpvp4xd/1
- 배포 설명상 14명이 3m/s로 달리며 추가 질량 조건을 변경했습니다. 동작·힘·VO2·VCO2 자료를 제공합니다.
- 전달받은 라이선스: CC BY 4.0. 실제 파일 검토 전입니다.
- 첫 재현 실험 후보입니다. 추가 질량 위치·크기, 참가자 정보, 측정 단위와 파일 구성을 확인해야 합니다.

## 2. PhysioNet Málaga treadmill dataset

- 출처: https://physionet.org/content/treadmill-exercise-cardioresp/1.0.1/
- 857명, 검사 992회. 속도·심박·호흡가스·키·몸무게 자료입니다.
- 점증부하 검사이며 장거리 달리기 자료는 아닙니다. 참가자 단위 데이터 분할이 필요합니다.
- 실제 파일 구성, 사용 조건, 반복 검사 식별 방법을 후속 확인합니다.

## 3. Bath run-to-exhaustion dataset

- 출처: https://researchdata.bath.ac.uk/1550/
- 장시간 달리기 동작·생리 자료와 분석 코드가 소개되어 있습니다. 실제 파일 검토 전입니다.
- 실험 조건, 측정 기간, 탈진 정의, 라이선스를 확인합니다.

## 4. Smyth (2021): marathon late-race slowdown

- 출처: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0251513
- 400만 건 이상 경기 기록 연구입니다. 피로를 직접 측정하지 않고 후반 감속을 대리지표로 사용합니다.
- 원본 경기 사이트 목록을 제공합니다. 통합 다운로드 제공 여부는 확인되지 않았습니다.

## 5. Emig & Peltonen (2020)

- 출처: https://www.nature.com/articles/s41467-020-18737-6
- 개인 달리기 성능 모델 참고 자료입니다. Polar 원본 데이터는 비공개입니다.
- 모델 맞춤 오차와 미관측 경기 예측 오차를 구분해 검토합니다.

## 6. Minetti et al. (2002)

- 출처: https://pubmed.ncbi.nlm.nih.gov/12183501/
- 러너 10명의 트레드밀 실험에 기반한 경사별 에너지 소모 연구입니다.
- 계산식, 경사·속도 적용 범위, 단위와 외삽 한계를 확인합니다.

## 7. Nazaret et al. (2023)

- 논문: https://www.nature.com/articles/s41746-023-00926-4
- 코드: https://github.com/apple-aiml-research/ml-heart-rate-models
- 개인 심박 반응 모델과 공개 코드가 있습니다. Apple 원본 데이터는 비공개입니다.
- 코드 라이선스, 입력 요구사항과 외부 데이터 검증 가능성을 확인합니다.

## 8. OpenSim Moco (2020)

- 출처: https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008493
- 근골격 시뮬레이션 방법론의 선행 자료입니다. 세부 구현과 본 프로젝트 적용 가능성은 후속 검토 대상입니다.

## 9. Van Wouwe et al. (2024)

- 출처: https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011410
- 체형·근육량과 단거리·장거리 성능의 선행 연구입니다.
- 모델 가정, 검증 범위, 본 프로젝트의 고정 동작 조건과의 관계를 확인합니다.

## 10. AnyBodyRun 소개

- 출처: https://www.anybodytech.com/webcasts/introduction-to-anybodyrun-a-web-application-for-running-biomechanics/
- 전문 연구용 선행 사례입니다. 소개 자료만으로 기능·정확도·사용 조건을 확정하지 않습니다.

## 후속 기록 기준

각 자료를 실제로 검토하면 확인 날짜, 읽은 범위, 데이터 접근 가능 여부, 라이선스, 재현에 필요한 파일과 남은 질문을 기록합니다. 데이터 다운로드나 모델 재현 성공을 아직 완료된 일로 표시하지 않습니다.
