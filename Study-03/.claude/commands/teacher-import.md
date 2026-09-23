---
description: 여러 학생의 quiz:records를 합친 JSON을 검증하고 학생별로 정리한 학급 데이터셋을 보여준다
argument-hint: [학생별 quiz:records를 합친 JSON 배열]
---

기록 JSON: $ARGUMENTS

이 명령어는 브라우저의 실제 `localStorage`를 직접 볼 수 없다. 각 학생이 자기 브라우저
콘솔에서 `localStorage.getItem("quiz:records")`를 실행해 나온 값을 선생님에게 전달하고,
선생님이 그 값들을 **하나의 배열로 합쳐서**(예: `[...학생1기록, ...학생2기록, ...]`) 이
명령어의 인자로 붙여넣어야 한다. `teacher-summary`, `teacher-rank`, `teacher-topics`,
`teacher-mode`도 전부 같은 형태의 입력을 받는다.

- 기록 JSON이 비어있으면, 위 방법을 안내하고 사용법 예시를 보여준 뒤 멈춰라.
- 비어있지 않으면 JSON 배열로 파싱해라. 파싱이 안 되거나 배열이 아니면 무엇이 문제인지
  알려주고 멈춰라.

각 항목이 `Study-03/CLAUDE.md`의 `localStorage keys` 항목에 나온 `{ nickname, mode,
difficulty, score, accuracy, date }` 형식과 맞는지 확인해라. `nickname`이나 `mode`가 없는
항목은 예전 스키마 기록이니 "예전 형식(제외)"으로 따로 세고, 이후 분석에서는 빼라.

나머지 항목을 `nickname`별로 묶어라. 같은 `nickname`+`mode`+`difficulty` 조합이 여러 번
나오면, 실제 앱(`recordResult()`)과 똑같이 **최고 점수 하나만** 남기고 나머지는 버려라.

아래를 표로 보여줘라.
- **학생 목록**: `nickname`, 정리 후 남은 기록 수, 참여한 mode 종류
- 두 명 이상이 정확히 같은 `nickname`을 썼다면, "닉네임이 겹치면 같은 학생으로 합산됩니다 —
  학생마다 고유한 닉네임을 쓰게 해주세요"라고 눈에 띄게 경고해라 (겹치는지는 판단할 수 없으니,
  같은 nickname으로 들어온 기록은 항상 동일인으로 간주한다는 전제를 알려주는 것).

마지막에 "입력된 원본 기록 수, 예전 형식 제외 수, 중복 제거 후 남은 기록 수, 학생 수"를 한
줄로 요약해라. 원본 데이터를 고치라는 게 아니니 표만 보여줘라.
