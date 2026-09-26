# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 개요

`VibeCoding`은 "혼자 공부하는 바이브코딩 with 클로드 코드"를 따라가며 만드는 학습용 저장소다. 각
`Study-NN/` 폴더가 독립된 실습 프로젝트이며, 폴더별 자세한 내용은 그 폴더 안의 `CLAUDE.md`를 먼저
읽는다.

| 폴더 | 내용 | 기술 |
|---|---|---|
| `Study-01/` | 손글씨 숫자 인식기 (`desktop_version/`, `web_version/` 두 빌드) | Python, scikit-learn, Gradio |
| `Study-02/` | 할 일 관리 앱 (`todo-app/`, `todo-app/web_version/`) | HTML/CSS/JS, localStorage |
| `Study-03/` | 상식 퀴즈 게임 + 문제 관리용 커스텀 명령어 | HTML/CSS/JS, localStorage |
| `Study-04/` | API로 AI 서비스 사용하기 (OpenRouter) | Python |

## 저장소 공통 규칙

- 저장소 전체에 빌드 시스템, 테스트, 린터가 없다. 폴더끼리 코드를 공유하지 않으니, 작업은 해당
  `Study-NN/` 안에서만 한다.
- 커스텀 명령어(`.claude/commands/`)는 폴더 안에 둔다 (예: `Study-03/.claude/commands/`). 그 폴더를
  작업 디렉터리로 열었을 때만 불러와진다.
- 책은 로컬 PC 작업을 전제로 설명한다. 사용자는 Colab을 쓰니 책의 절차를 Colab 방식으로 바꿔서
  안내한다. 예를 들어 `.env` 대신 Colab 보안 비밀을 쓴다 (`Study-04/CLAUDE.md` 참고). 나중에 로컬
  PC로 받아 쓸 때를 위해 `.gitignore`와 `.env.example`은 폴더별로 둔다.
- 커밋 메시지는 `Study-NN: 한국어 요약` 형식을 따른다.

## 사용자에게 설명할 때 지킬 것

- 사용자는 코딩을 막 배우기 시작한 초보자이고, 바이브코딩 자체도 처음 배우는 중이다.
- 군대 사지방에서 공부하고 있어 로컬 개발 환경(터미널, 에디터 등)을 쓸 수 없고, Google Colab에서
  코드를 clone해서 실행/확인한다. 실행 방법을 안내할 때는 이 제약을 항상 감안한다 (터미널 명령 대신
  Colab 코드 셀 사용법으로 안내, "git pull 후 새로고침" 같은 절차 등).
- 전문 용어는 쉬운 말로 풀어서 설명한다.
- 지금 이해해두면 앞으로 도움이 되는 개념은 짧고 쉽게 설명한다.
- 지금 당장 몰라도 되거나 넘어가도 되는 세부사항은 깊이 파고들지 말고, "이건 진행하다 보면 자연스럽게
  익숙해질 부분이에요" 식으로 가볍게 짚고 넘어간다.
