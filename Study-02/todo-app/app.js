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

// 새 할 일을 추가한다 (앞뒤 공백을 지운 뒤 비어 있으면 무시한다)
function addTodo(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const todo = {
    id: createId(),
    text: trimmed,
    category,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
  };

  state.todos.push(todo);
  save(state.todos);
  render();
}

// 할 일의 텍스트/카테고리를 수정한다
function updateTodo(id, changes) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  Object.assign(todo, changes);
  save(state.todos);
  render();
}

// 완료 여부를 토글하고 완료 시각을 함께 갱신한다
function toggleTodo(id) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  todo.done = !todo.done;
  todo.completedAt = todo.done ? Date.now() : null;
  save(state.todos);
  render();
}

// 할 일을 목록에서 삭제한다
function deleteTodo(id) {
  state.todos = state.todos.filter((item) => item.id !== id);
  save(state.todos);
  render();
}

// ===== selectors =====
// 화면에 그릴 todos 목록을 고른다 (필터의 카테고리에 맞는 항목만 반환)
function getVisibleTodos() {
  if (state.filter.category === "all") return state.todos;
  return state.todos.filter((todo) => todo.category === state.filter.category);
}

// 전체와 카테고리별(work/personal/study) 완료 진행률을 계산한다
function getProgress() {
  const buildProgress = (todos) => {
    const total = todos.length;
    const done = todos.filter((todo) => todo.done).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  };

  const progress = { all: buildProgress(state.todos) };
  CATEGORY_ORDER.forEach((category) => {
    progress[category] = buildProgress(state.todos.filter((todo) => todo.category === category));
  });

  return progress;
}

// ===== render =====
const CATEGORY_LABELS = { work: "업무", personal: "개인", study: "공부" }; // 카테고리 값을 화면 표시용 텍스트로 변환
const CATEGORY_ORDER = ["work", "personal", "study"]; // 카테고리를 항상 같은 순서로 다루기 위한 목록
const FILTER_TABS = [
  { value: "all", label: "전체" },
  { value: "work", label: "업무" },
  { value: "personal", label: "개인" },
  { value: "study", label: "공부" },
];

let editingId = null; // 지금 수정 중인 할 일 id (저장되지 않는 화면 전용 상태)

// 현재 state를 기준으로 필터 탭, 진행률, 할 일 목록을 다시 그린다
function render() {
  renderFilterTabs();
  renderProgress();

  const listEl = document.getElementById("todo-list");
  listEl.textContent = ""; // 기존 목록을 비운 뒤 새로 그린다

  const todos = getVisibleTodos();

  if (todos.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "empty-message";
    emptyLi.textContent = state.todos.length === 0
      ? "아직 할 일이 없어요. 위에서 첫 할 일을 추가해 보세요."
      : "이 카테고리에는 할 일이 없어요.";
    listEl.appendChild(emptyLi);
    return;
  }

  todos.forEach((todo) => {
    const li = todo.id === editingId ? createEditItem(todo) : createTodoItem(todo);
    listEl.appendChild(li);
  });
}

// 필터 탭 버튼을 그리고 현재 선택된 탭을 표시한다
function renderFilterTabs() {
  const tabsEl = document.getElementById("filter-tabs");
  tabsEl.textContent = "";

  FILTER_TABS.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-tab";
    if (tab.value === state.filter.category) button.classList.add("active");
    button.dataset.category = tab.value;
    button.textContent = tab.label;
    tabsEl.appendChild(button);
  });
}

// 전체 진행률 바/텍스트와 카테고리별 진행 상황을 그린다 (필터와 무관하게 항상 전체 기준)
function renderProgress() {
  const progressEl = document.getElementById("progress");
  progressEl.textContent = "";

  const progress = getProgress();
  const { done, total, percent } = progress.all;

  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${percent}%`;
  track.appendChild(fill);

  const summary = document.createElement("p");
  summary.className = "progress-summary";
  summary.textContent = `${done}/${total} 완료 (${percent}%)`;

  const byCategory = document.createElement("p");
  byCategory.className = "progress-by-category";
  byCategory.textContent = CATEGORY_ORDER
    .map((category) => `${CATEGORY_LABELS[category]} ${progress[category].done}/${progress[category].total}`)
    .join(" · ");

  progressEl.append(track, summary, byCategory);

  if (total > 0 && done === total) {
    const completeMsg = document.createElement("p");
    completeMsg.className = "progress-complete";
    completeMsg.textContent = "오늘 할 일을 모두 끝냈어요";
    progressEl.appendChild(completeMsg);
  }
}

// 완료 체크박스, 카테고리 배지, 수정/삭제 버튼이 있는 한 줄을 만든다
function createTodoItem(todo) {
  const li = document.createElement("li");
  li.dataset.id = todo.id;
  if (todo.done) li.className = "done";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-toggle";
  checkbox.checked = todo.done;

  const badge = document.createElement("span");
  badge.className = "todo-category";
  badge.textContent = CATEGORY_LABELS[todo.category] || todo.category;

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "todo-edit";
  editBtn.textContent = "수정";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "todo-delete";
  deleteBtn.textContent = "삭제";

  li.append(checkbox, badge, text, editBtn, deleteBtn);
  return li;
}

// 수정 중인 할 일을 입력창 + 카테고리 select로 보여준다
function createEditItem(todo) {
  const li = document.createElement("li");
  li.dataset.id = todo.id;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.maxLength = 100;
  input.value = todo.text;

  const select = document.createElement("select");
  select.className = "todo-edit-category";
  Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === todo.category) option.selected = true;
    select.appendChild(option);
  });

  li.append(input, select);
  return li;
}

// ===== events =====
let isCancelingEdit = false; // Esc로 취소할 때 뒤이은 focusout이 다시 저장하지 않도록 막는 플래그

// 입력값을 정리해서 새 할 일을 추가하고 입력창을 초기화한다
function handleFormSubmit(event) {
  event.preventDefault();

  const inputEl = document.getElementById("todo-input");
  const categoryEl = document.getElementById("todo-category");

  addTodo(inputEl.value, categoryEl.value);

  inputEl.value = "";
  inputEl.focus();
}

// 목록 클릭을 위임 처리한다: 수정 시작, 삭제
function handleListClick(event) {
  const li = event.target.closest("li[data-id]");
  if (!li) return;
  const id = li.dataset.id;

  if (event.target.classList.contains("todo-delete")) {
    deleteTodo(id);
  } else if (event.target.classList.contains("todo-edit")) {
    enterEditMode(id);
  }
}

// 할 일 텍스트를 더블클릭하면 수정 모드로 전환한다
function handleListDblClick(event) {
  if (!event.target.classList.contains("todo-text")) return;
  const li = event.target.closest("li[data-id]");
  if (!li) return;
  enterEditMode(li.dataset.id);
}

// 완료 체크박스 상태 변경을 위임 처리한다
function handleListChange(event) {
  if (!event.target.classList.contains("todo-toggle")) return;
  const li = event.target.closest("li[data-id]");
  if (!li) return;
  toggleTodo(li.dataset.id);
}

// 필터 탭 클릭을 위임 처리한다: 선택한 카테고리를 state.filter에 반영한다
function handleFilterClick(event) {
  const button = event.target.closest(".filter-tab");
  if (!button) return;
  state.filter.category = button.dataset.category;
  render();
}

// 수정 모드로 전환하고 입력창에 포커스를 준다
function enterEditMode(id) {
  isCancelingEdit = false; // 이전에 남아 있을 수 있는 취소 플래그를 초기화
  editingId = id;
  render();

  const listEl = document.getElementById("todo-list");
  const inputEl = listEl.querySelector(".todo-edit-input");
  if (inputEl) inputEl.focus();
}

// 수정 입력창에서 Enter(저장)와 Esc(취소)를 처리한다
function handleListKeydown(event) {
  if (!event.target.classList.contains("todo-edit-input")) return;

  if (event.key === "Enter") {
    event.preventDefault();
    event.target.blur(); // 실제 저장은 focusout에서 처리한다
  } else if (event.key === "Escape") {
    event.preventDefault();
    isCancelingEdit = true;
    event.target.blur(); // 실제 취소는 focusout에서 처리한다
  }
}

// 수정 입력창에서 포커스가 빠지면 저장한다 (Esc로 취소한 경우는 건너뛴다)
function handleListFocusout(event) {
  if (!event.target.classList.contains("todo-edit-input")) return;

  if (isCancelingEdit) {
    isCancelingEdit = false;
    editingId = null;
    render();
    return;
  }

  commitEdit(event.target);
}

// 수정 입력창의 값을 저장한다 (비어 있으면 저장하지 않고 원래 내용으로 되돌린다)
function commitEdit(inputEl) {
  const li = inputEl.closest("li[data-id]");
  if (!li) return;

  const id = li.dataset.id;
  const selectEl = li.querySelector(".todo-edit-category");
  const trimmed = inputEl.value.trim();

  editingId = null;

  if (!trimmed) {
    render();
    return;
  }

  updateTodo(id, { text: trimmed, category: selectEl.value });
}

// 페이지 로드 시 저장된 데이터를 불러와 상태에 채우고 화면을 그린다
function init() {
  state.todos = load();
  render();

  const formEl = document.getElementById("todo-form");
  formEl.addEventListener("submit", handleFormSubmit);

  const listEl = document.getElementById("todo-list");
  listEl.addEventListener("click", handleListClick);
  listEl.addEventListener("dblclick", handleListDblClick);
  listEl.addEventListener("change", handleListChange);
  listEl.addEventListener("keydown", handleListKeydown);
  listEl.addEventListener("focusout", handleListFocusout);

  const tabsEl = document.getElementById("filter-tabs");
  tabsEl.addEventListener("click", handleFilterClick);
}

document.addEventListener("DOMContentLoaded", init);
