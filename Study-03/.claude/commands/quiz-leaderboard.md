---
description: 브라우저에서 복사한 quiz:records JSON을 붙여넣으면 앱과 동일한 방식으로 순위를 매겨 보여준다
argument-hint: [quiz:records JSON 문자열] (선택)
---

기록 JSON: $ARGUMENTS

이 명령어는 브라우저의 실제 `localStorage`를 직접 볼 수 없다. 플레이어가 브라우저 개발자 도구
콘솔에서 `localStorage.getItem("quiz:records")`를 실행해 나온 값을 복사해서 이 명령어의 인자로
붙여넣어야 한다.

- 기록 JSON이 비어있으면, 위 방법을 안내하고 `/quiz-leaderboard [{"nickname":"철수", ...}]`처럼
  사용법을 보여준 뒤 멈춰라.
- 비어있지 않으면 JSON 배열로 파싱해라. 파싱이 안 되거나 배열이 아니면 무엇이 문제인지 알려주고
  멈춰라.

각 항목이 `Study-03/CLAUDE.md`의 `localStorage keys` 항목에 나온 `{ nickname, mode, difficulty,
score, accuracy, date }` 형식과 맞는지 확인해라. `mode` 필드가 없는 항목은 예전 스키마(모드
기능이 추가되기 전, `category` 필드만 있던 형식)로 저장된 기록이니 "예전 형식(mode 없음)"으로
따로 표시하고 순위 계산에서는 빼라.

나머지 항목으로 `Study-03/index.html`의 `renderLeaderboard()`와 똑같은 방식으로 순위를 만들어라:

1. `mode` 값별로(예: "전체", "스피드", 카테고리명들) 그룹을 나눠라.
2. 같은 `nickname`이 같은 `mode`+`difficulty` 조합으로 여러 번 나오면, 실제 앱은 최고 점수
   하나만 남기므로(`recordResult()`) 여기서도 그 조합은 최고 점수 기록 하나만 남기고 나머지는
   무시해라.
3. 각 그룹 안에서 `score` 내림차순으로 정렬해 상위 10명(`LEADERBOARD_SIZE`)까지만 표로 보여줘라
   (순위, 닉네임, 점수, 난이도(있으면), 정답률, 날짜).

마지막에 "전체 기록 수, 예전 형식이라 제외한 기록 수, 순위표를 만든 모드 개수"를 한 줄로
요약해라. 붙여넣은 원본 데이터를 고치라는 게 아니니 표만 보여줘라.
