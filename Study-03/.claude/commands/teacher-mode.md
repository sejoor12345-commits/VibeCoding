---
description: teacher-import → teacher-summary → teacher-rank → teacher-topics를 실행해 리포트를 만들고, teacher-report.html로 저장한 뒤 CSV/PDF까지 내보내는 통합 명령어
argument-hint: [학생별 quiz:records를 합친 JSON 배열]
---

기록 JSON: $ARGUMENTS

이 명령어는 선생님 모드 명령어 4개를 한 번에 실행해서 학급 리포트 하나로 합쳐 보여준다.
입력이 비어있거나 파싱이 안 되면 `teacher-import.md`의 인자 검증과 똑같이 처리하고 멈춰라.

아래 순서로 실행해서, 각 결과를 그 명령어의 출력 형식 그대로 이어붙여 하나의 리포트로
보여줘라. 네 명령어 모두 같은 입력(JSON 파싱 → 형식 확인 → 예전 형식 제외 → 같은
nickname+mode+difficulty는 최고 점수만 유지)을 한 번만 정리해서 재사용해라(중복으로 네 번
정리하지 말 것).

1. **`teacher-import.md`**: 학생 목록과 정리 결과(원본/제외/중복 제거 후 기록 수)
2. **`teacher-summary.md`**: 학생별 요약표 + 학급 통계
3. **`teacher-rank.md`**: 모드별 학급 전체 순위표 + 학급 평균
4. **`teacher-topics.md`**: 카테고리·난이도별 학급 평균 정답률과 보강 필요 주제

각 단계 결과 앞에 `## 1. 학생 데이터 가져오기`, `## 2. 학생별 요약`, `## 3. 학급 순위`,
`## 4. 취약 주제 분석` 같은 제목을 붙여서 구분해라.

맨 마지막에 아래를 한 줄로 요약하는 `## 종합 요약`을 추가해라: 학생 수, 전체 기록 수, 학급
평균 정답률, 가장 취약한 카테고리·난이도, 이번 리포트에서 선생님이 가장 먼저 봐야 할 것
한 가지(예: "전체 평균 정답률이 낮은 학생 이름" 또는 "정답률이 가장 낮은 주제").

## 5. HTML 리포트로 저장

1~4단계 결과를 `Study-03/teacher-report.html`에 그대로 반영해라. 그 파일이 이미 있으면 같은
페이지 구조와 스타일(카드, 표, "학급 평균"/"보강 필요"/"최저" 강조 표시)을 유지한 채 내용만
이번 실행 결과로 덮어써라. 파일이 없으면 그 구조를 새로 만들어라.

## 6. CSV/PDF로 내보내기

5단계에서 저장한 `teacher-report.html`을 대상으로 `export-report.md`를 두 번 실행해라: 한 번은
`csv`로, 한 번은 `pdf`로. 각각의 검증(csv는 표 개수·행 수 일치, pdf는 파일 생성·크기)도 그대로
따라라.

## 종합 요약에 추가할 내용

`## 종합 요약`의 마지막 줄에 "HTML 리포트: Study-03/teacher-report.html", "CSV: Study-03/exports/
안 파일 개수", "PDF: Study-03/exports/teacher-report.pdf"를 덧붙여라.
