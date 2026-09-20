// ===== state =====
// 앱 전체 상태: 할 일 목록과 현재 필터
const state = {
  todos: [],
  filter: { category: "all", status: "all" },
};

// ===== storage =====
const STORAGE_KEY = "todo-app:v1"; // 정상 데이터를 저장할 localStorage 키
const CORRUPT_KEY = "todo-app:v1:corrupt"; // 손상된 데이터를 옮겨둘 키

// localStorage에 저장된 todos 배열을 불러온다 (없거나 손상됐으면 빈 배열)
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.todos)) return [];
    return parsed.todos;
  } catch (error) {
    localStorage.setItem(CORRUPT_KEY, raw); // 손상된 원본은 따로 보관해 둔다
    return [];
  }
}

// todos 배열을 localStorage에 저장한다 (성공하면 true, 실패하면 false)
function save(todos) {
  try {
    const data = { version: 1, todos };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

// ===== actions =====
// 할 일 항목에 쓸 고유 id를 만든다 (crypto.randomUUID 미지원 시 대체 방식 사용)
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}`;
}

// ===== selectors =====
// 화면에 그릴 todos 목록을 고른다 (지금은 필터 없이 전체를 그대로 반환)
function getVisibleTodos() {
  return state.todos;
}

// ===== render =====
const CATEGORY_LABELS = { work: "업무", personal: "개인", study: "공부" }; // 카테고리 값을 화면 표시용 텍스트로 변환

// 현재 state를 기준으로 할 일 목록을 다시 그린다
function render() {
  const listEl = document.getElementById("todo-list");
  listEl.textContent = ""; // 기존 목록을 비운 뒤 새로 그린다

  getVisibleTodos().forEach((todo) => {
    const li = document.createElement("li");
    const label = CATEGORY_LABELS[todo.category] || todo.category;
    li.textContent = `${label} · ${todo.text}`;
    listEl.appendChild(li);
  });
}

// ===== events =====
// 폼 제출 시 페이지가 새로고침되는 것만 막는다 (추가 기능은 다음 단계에서 구현)
function handleFormSubmit(event) {
  event.preventDefault();
}

// 페이지 로드 시 저장된 데이터를 불러와 상태에 채우고 화면을 그린다
function init() {
  state.todos = load();
  render();

  const formEl = document.getElementById("todo-form");
  formEl.addEventListener("submit", handleFormSubmit);
}

document.addEventListener("DOMContentLoaded", init);
