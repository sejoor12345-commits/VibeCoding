# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-01` is a handwritten digit recognizer (scikit-learn `MLPClassifier` trained on MNIST, Gradio
drawing canvas UI), from working through "혼자 공부하는 바이브코딩 with 클로드 코드" (repo root:
`VibeCoding/`). It has two independent builds, each with its own `CLAUDE.md` with real detail — read the
one for the build you're touching before making changes:

- **`desktop_version/`** — runs locally via Python, `.bat` launchers for double-click use on Windows, and
  a GitHub Actions workflow that packages it into a standalone `.exe`.
- **`web_version/`** — the same recognizer packaged for permanent public hosting (Hugging Face Spaces).

The two share the same `predict_digit()` / `load_or_train_model()` logic but are otherwise separate app
entry points with different dependencies and deployment mechanics — don't merge them into one file.
