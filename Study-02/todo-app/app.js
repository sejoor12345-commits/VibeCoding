// ===== state =====
// 앱 전체 상태: 할 일 목록, 필터/검색, 정렬
const state = {
  todos: [],
  filter: { category: "all", status: "all", search: "", importantOnly: false },
  sort: "custom", // init()에서 저장된 설정 값으로 덮어쓴다
};

// ===== storage =====
const STORAGE_KEY = "todo-app:v1"; // 정상 데이터를 저장할 localStorage 키
const CORRUPT_KEY = "todo-app:v1:corrupt"; // 손상된 데이터를 옮겨둘 키
const BACKUP_KEY = "todo-app:v1:backup"; // 가져오기로 목록을 대체하기 전 백업해 두는 키
const SETTINGS_KEY = "todo-app:settings"; // 테마/정렬 등 앱 설정을 저장할 키 (할 일 데이터와 분리)

let hadCorruptData = false; // load()에서 손상된 데이터를 만났는지 (init()이 배너를 띄울지 판단하는 데 쓴다)

// localStorage에 저장된 todos 배열을 불러온다 (없거나 손상됐으면 빈 배열)
// v1 데이터나 important가 없는 항목은 important: false를 채워서 그대로 불러온다
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.todos)) {
      throw new Error("invalid shape");
    }
    return parsed.todos.map((todo) => ({ important: false, ...todo }));
  } catch (error) {
    localStorage.setItem(CORRUPT_KEY, raw); // 손상된 원본은 따로 보관해 둔다
    hadCorruptData = true;
    return [];
  }
}

// todos 배열을 localStorage에 저장한다 (성공하면 true, 실패하면 배너를 띄우고 false)
function save(todos) {
  try {
    const data = { version: 2, todos };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    showSaveFailedBanner();
    return false;
  }
}

// 저장된 설정을 불러온다 (없거나 손상됐으면 빈 객체)
function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

// 설정을 localStorage에 저장한다
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

// 새 할 일을 추가한다 (앞뒤 공백을 지우고 100자로 자른 뒤 비어 있으면 무시한다)
function addTodo(text, category) {
  const trimmed = text.trim().slice(0, 100);
  if (!trimmed) return;

  const todo = {
    id: createId(),
    text: trimmed,
    category,
    done: false,
    important: false,
    createdAt: Date.now(),
    completedAt: null,
  };

  state.todos.push(todo);
  save(state.todos);
  render();
}

// 할 일의 텍스트/카테고리를 수정한다 (text가 있으면 100자로 잘라 저장한다)
function updateTodo(id, changes) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  const safeChanges = { ...changes };
  if (typeof safeChanges.text === "string") {
    safeChanges.text = safeChanges.text.slice(0, 100);
  }

  Object.assign(todo, safeChanges);
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

// 중요 표시를 토글한다
function toggleImportant(id) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  todo.important = !todo.important;
  save(state.todos);
  render();
}

// id 목록에 해당하는 항목들을 한 번에 지우고, 실행 취소 토스트를 보여준다
// (개수와 상관없이 이 호출 전체가 "한 번의 삭제 동작"이며, 되살리면 원래 위치로 되돌아간다)
function deleteTodosWithUndo(ids) {
  const idSet = new Set(ids);
  const removed = [];
  state.todos.forEach((todo, index) => {
    if (idSet.has(todo.id)) removed.push({ todo, index });
  });
  if (removed.length === 0) return;

  state.todos = state.todos.filter((todo) => !idSet.has(todo.id));
  save(state.todos);
  render();

  showToast({
    message: "삭제했어요.",
    actionLabel: "실행 취소",
    onAction: () => restoreDeleted(removed),
    duration: 5000,
  });
}

// deleteTodosWithUndo가 지운 항목들을 원래 있던 위치 그대로 되살린다
function restoreDeleted(removed) {
  removed.forEach(({ todo, index }) => {
    const insertAt = Math.min(index, state.todos.length);
    state.todos.splice(insertAt, 0, todo);
  });
  save(state.todos);
  render();
}

// 항목 하나를 삭제한다 (실행 취소 가능)
function deleteTodo(id) {
  deleteTodosWithUndo([id]);
}

// 완료된 항목을 모두 삭제한다 (실행 취소 가능)
function deleteCompletedTodos() {
  const ids = state.todos.filter((todo) => todo.done).map((todo) => todo.id);
  deleteTodosWithUndo(ids);
}

// 오늘 0시 이전에 완료된("어제까지 끝낸") 항목을 모두 삭제한다 (실행 취소 가능)
function cleanupStaleCompleted() {
  const ids = getStaleCompletedTodos().map((todo) => todo.id);
  deleteTodosWithUndo(ids);
}

// sourceId 항목을 targetId 항목 앞/뒤로 옮긴다 ("내 순서"인 state.todos 배열 자체를 바꾼다)
function reorderTodo(sourceId, targetId, insertAfter) {
  const sourceIndex = state.todos.findIndex((todo) => todo.id === sourceId);
  if (sourceIndex === -1) return;

  const [moved] = state.todos.splice(sourceIndex, 1);
  let targetIndex = state.todos.findIndex((todo) => todo.id === targetId);

  if (targetIndex === -1) {
    state.todos.push(moved);
  } else {
    if (insertAfter) targetIndex += 1;
    state.todos.splice(targetIndex, 0, moved);
  }

  save(state.todos);
  render();
}

// 항목을 한 칸 위(-1) 또는 아래(+1)로 옮긴다 (키보드 Alt+화살표용)
function moveTodoBy(id, direction) {
  const index = state.todos.findIndex((todo) => todo.id === id);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= state.todos.length) return;

  const [moved] = state.todos.splice(index, 1);
  state.todos.splice(newIndex, 0, moved);

  save(state.todos);
  render();

  // 이동한 뒤에도 그 항목의 핸들에 포커스가 남아 있게 한다
  const listEl = document.getElementById("todo-list");
  const handle = listEl.querySelector(`.todo-item[data-id="${CSS.escape(id)}"] .drag-handle`);
  if (handle) handle.focus();
}

// 정렬 방식을 바꾸고 저장한다 (할 일 데이터와 별개인 설정 키를 쓴다)
function setSort(sort) {
  state.sort = sort;
  const settings = loadSettings();
  settings.sort = sort;
  saveSettings(settings);
  render();
}

// 테마를 라이트/다크로 바꾸고 저장한다 (할 일 데이터와 별개인 설정 키를 쓴다)
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const settings = loadSettings();
  settings.theme = theme;
  saveSettings(settings);
  updateThemeToggleIcon(theme);
}

// 지금 데이터를 JSON 파일로 내려받는다 (서버로 보내지 않는다)
function exportTodos() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    todos: state.todos,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `todo-backup-${getTodayDateString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast({ message: `${state.todos.length}개를 내보냈어요` });
}

// 가져온 항목 중 id가 같은 것은 건너뛰고 나머지를 현재 목록 뒤에 추가한다
function mergeImportedTodos(importedTodos) {
  const existingIds = new Set(state.todos.map((todo) => todo.id));
  const toAdd = importedTodos.filter((todo) => !existingIds.has(todo.id));

  state.todos = [...state.todos, ...toAdd];
  save(state.todos);
  render();

  return toAdd.length;
}

// 현재 목록을 가져온 목록으로 완전히 바꾼다 (바꾸기 전 현재 데이터를 백업 키에 남긴다)
function replaceAllTodos(importedTodos) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ version: 2, todos: state.todos }));
  } catch (error) {
    // 백업이 실패해도 사용자가 대체를 선택했으므로 계속 진행한다
  }

  state.todos = importedTodos;
  save(state.todos);
  render();
}

// ===== selectors =====
// 지금 필터/검색 조건에 맞는 todos만 골라, state.sort에 맞게 정렬한 사본을 돌려준다.
// state.todos 자체(내 순서)는 절대 바꾸지 않는다.
function getVisibleTodos() {
  const todos = state.todos.filter((todo) => {
    if (state.filter.category !== "all" && todo.category !== state.filter.category) return false;
    if (state.filter.status === "active" && todo.done) return false;
    if (state.filter.status === "done" && !todo.done) return false;
    if (state.filter.importantOnly && !todo.important) return false;
    if (state.filter.search && !todo.text.toLowerCase().includes(state.filter.search.toLowerCase())) return false;
    return true;
  });

  return sortTodos(todos, state.sort);
}

// todos 배열의 정렬된 사본을 만든다 (원본 순서는 값이 같을 때의 동점 처리 기준으로 그대로 유지된다)
function sortTodos(todos, sort) {
  const copy = [...todos];
  const categoryRank = (todo) => CATEGORY_ORDER.indexOf(todo.category);

  switch (sort) {
    case "newest":
      copy.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "oldest":
      copy.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "category":
      copy.sort((a, b) => categoryRank(a) - categoryRank(b));
      break;
    case "important":
      copy.sort((a, b) => Number(b.important) - Number(a.important));
      break;
    case "incomplete":
      copy.sort((a, b) => Number(a.done) - Number(b.done));
      break;
    case "alphabetical":
      copy.sort((a, b) => a.text.localeCompare(b.text, "ko"));
      break;
    default:
      // "custom": 정렬하지 않고 내 순서를 그대로 쓴다
      break;
  }

  return copy;
}

// 지금 드래그/키보드로 순서를 바꿀 수 있는 상태인지: 정렬이 "내 순서"이고 모든 필터/검색이 꺼져 있어야 한다
function canReorder() {
  return state.sort === "custom"
    && state.filter.category === "all"
    && state.filter.status === "all"
    && !state.filter.search
    && !state.filter.importantOnly;
}

// 전체와 카테고리별(work/personal/study) 완료 진행률을 계산한다 (필터/검색과 무관하게 항상 전체 기준)
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

// 오늘 0시 이전에 완료된("어제까지 끝낸") 항목을 찾는다
function getStaleCompletedTodos() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const cutoff = todayStart.getTime();

  return state.todos.filter((todo) => todo.done && typeof todo.completedAt === "number" && todo.completedAt < cutoff);
}

// 오늘 날짜를 "YYYY-MM-DD" 문자열로 돌려준다 (파일 이름, 하루 정리 건너뛰기 저장에 쓴다)
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 가져온 todos 배열에서 형식이 맞는 항목만 골라 안전한 형태로 만든다
function validateImportedTodos(rawTodos) {
  const validTodos = [];
  let skippedCount = 0;

  rawTodos.forEach((item) => {
    const isValid = item
      && typeof item === "object"
      && typeof item.id === "string"
      && typeof item.text === "string"
      && CATEGORY_ORDER.includes(item.category)
      && typeof item.done === "boolean"
      && typeof item.createdAt === "number"
      && (item.completedAt === null || typeof item.completedAt === "number");

    if (!isValid) {
      skippedCount += 1;
      return;
    }

    validTodos.push({
      id: item.id,
      text: item.text.slice(0, 100),
      category: item.category,
      done: item.done,
      important: typeof item.important === "boolean" ? item.important : false,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    });
  });

  return { validTodos, skippedCount };
}

// 지금 적용된 테마를 읽는다 (head의 인라인 스크립트가 이미 정해 둔 값)
function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

// 올해 1월 1일부터 오늘까지 며칠째인지 구한다 (격언을 날짜로 고르는 데 쓴다)
function getDayOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diffMs = date - startOfYear;
  return Math.floor(diffMs / 86400000);
}

// 사용자가 애니메이션을 줄이도록 설정했는지 확인한다
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
const STATUS_TABS = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "done", label: "완료" },
];

// 오늘 시작, 꾸준함, 집중, 휴식에 관한 짧은 격언 30개. 말한 사람이 확실하지 않으면 "속담"/"작자 미상"으로 적는다.
const QUOTES = [
  { text: "천 리 길도 한 걸음부터", author: "노자" },
  { text: "시작이 반이다", author: "속담" },
  { text: "일단 시작하면 반은 끝난 것이다", author: "속담" },
  { text: "완벽한 때란 없다, 지금이 그때다", author: "작자 미상" },
  { text: "가장 큰 위험은 아무 위험도 감수하지 않는 것이다", author: "작자 미상" },
  { text: "첫걸음을 내딛는 용기가 모든 것을 바꾼다", author: "작자 미상" },
  { text: "시작하지 않으면 아무 일도 일어나지 않는다", author: "작자 미상" },
  { text: "낙숫물이 댓돌을 뚫는다", author: "속담" },
  { text: "우물을 파도 한 우물을 파라", author: "속담" },
  { text: "꾸준함이 재능을 이긴다", author: "작자 미상" },
  { text: "느려도 꾸준히 가는 자가 결국 이긴다", author: "작자 미상" },
  { text: "작은 노력이 쌓이면 큰 힘이 된다", author: "작자 미상" },
  { text: "티끌 모아 태산", author: "속담" },
  { text: "매일 한 걸음씩이면 언젠가 도착한다", author: "작자 미상" },
  { text: "포기하지 않는 한 실패한 것이 아니다", author: "작자 미상" },
  { text: "한 우물만 깊게 파라", author: "속담" },
  { text: "지금 이 순간에 집중하라", author: "작자 미상" },
  { text: "산만함은 목표를 흐리게 한다", author: "작자 미상" },
  { text: "하나에 집중할 때 비로소 보인다", author: "작자 미상" },
  { text: "두 마리 토끼를 잡으려다 둘 다 놓친다", author: "속담" },
  { text: "집중은 가장 강력한 무기다", author: "작자 미상" },
  { text: "곁눈질하지 말고 앞만 보고 가라", author: "작자 미상" },
  { text: "쉬는 것도 일의 일부다", author: "작자 미상" },
  { text: "급할수록 돌아가라", author: "속담" },
  { text: "잠시 멈추는 것은 후퇴가 아니다", author: "작자 미상" },
  { text: "충분히 쉬어야 멀리 갈 수 있다", author: "작자 미상" },
  { text: "휴식 없는 노력은 오래가지 못한다", author: "작자 미상" },
  { text: "숨 고르기도 전진의 한 방법이다", author: "작자 미상" },
  { text: "오늘 할 수 있는 일을 내일로 미루지 마라", author: "속담" },
  { text: "작은 성취가 모여 큰 자신감이 된다", author: "작자 미상" },
];

// 여러 아이콘 버튼에 쓰는 인라인 SVG (고정된 마크업이라 innerHTML로 넣어도 안전하다)
const ICONS = {
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  delete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  emptyState: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="m9 13 2 2 4-4"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>',
  refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  dragHandle: '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="14" r="1.3"/><circle cx="7" cy="14" r="1.3"/></svg>',
  starOutline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

let editingId = null; // 지금 수정 중인 할 일 id (저장되지 않는 화면 전용 상태)

// 현재 state를 기준으로 필터 탭, 목록 컨트롤, 진행률, 할 일 목록을 다시 그린다
function render() {
  renderFilterTabs();
  renderStatusTabs();
  updateListControls();
  updateMoreMenuState();
  refreshProgress();

  const listEl = document.getElementById("todo-list");
  listEl.textContent = ""; // 기존 목록을 비운 뒤 새로 그린다

  const todos = getVisibleTodos();

  if (todos.length === 0) {
    let message = "이 카테고리에는 할 일이 없어요.";
    if (state.todos.length === 0) {
      message = "아직 할 일이 없어요. 위에서 첫 할 일을 추가해 보세요.";
    } else if (state.filter.search) {
      message = "검색 결과가 없어요.";
    }
    listEl.appendChild(createEmptyState(message));
    return;
  }

  todos.forEach((todo) => {
    const li = todo.id === editingId ? createEditItem(todo) : createTodoItem(todo);
    listEl.appendChild(li);
  });
}

// 카테고리 필터 탭 버튼을 그리고 현재 선택된 탭을 표시한다
function renderFilterTabs() {
  const tabsEl = document.getElementById("filter-tabs");
  tabsEl.textContent = "";

  FILTER_TABS.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-tab";
    if (tab.value === state.filter.category) button.classList.add("active");
    button.setAttribute("aria-pressed", tab.value === state.filter.category ? "true" : "false");
    button.dataset.category = tab.value;
    button.textContent = tab.label;
    tabsEl.appendChild(button);
  });
}

// 상태 필터(전체/진행 중/완료) 버튼을 그리고 현재 선택된 탭을 표시한다
function renderStatusTabs() {
  const tabsEl = document.getElementById("status-tabs");
  tabsEl.textContent = "";

  STATUS_TABS.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-tab";
    if (tab.value === state.filter.status) button.classList.add("active");
    button.setAttribute("aria-pressed", tab.value === state.filter.status ? "true" : "false");
    button.dataset.status = tab.value;
    button.textContent = tab.label;
    tabsEl.appendChild(button);
  });
}

// 검색창/정렬 select/중요만 칩처럼 한 번만 만들어진 요소의 상태(값, 활성 여부)만 갱신한다
function updateListControls() {
  document.getElementById("sort-select").value = state.sort;

  const importantBtn = document.getElementById("important-only-toggle");
  importantBtn.classList.toggle("active", state.filter.importantOnly);
  importantBtn.setAttribute("aria-pressed", String(state.filter.importantOnly));

  document.getElementById("search-clear").hidden = !state.filter.search;
}

// 더보기 메뉴의 "완료 항목 모두 삭제"를 완료 항목이 있을 때만 눌리게 한다
function updateMoreMenuState() {
  const hasCompleted = state.todos.some((todo) => todo.done);
  document.getElementById("menu-clear-completed").disabled = !hasCompleted;
}

// 오늘 날짜를 헤더에 표시한다 (페이지를 여는 동안 바뀌지 않으므로 처음 한 번만 호출한다)
function renderDate() {
  const dateEl = document.getElementById("today-date");
  dateEl.textContent = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

// 테마 버튼 아이콘을 지금 테마에 맞게 바꾼다 (라이트면 해, 다크면 달)
function updateThemeToggleIcon(theme) {
  const buttonEl = document.getElementById("theme-toggle");
  buttonEl.innerHTML = theme === "dark" ? ICONS.moon : ICONS.sun;
}

let currentQuoteIndex = getDayOfYear(new Date()) % QUOTES.length; // 오늘의 격언 (날짜로 고정, 새로고침해도 같은 날엔 같다)

// 지금 선택된 격언을 화면에 표시한다
function renderQuote() {
  const quote = QUOTES[currentQuoteIndex];
  document.getElementById("quote-text").textContent = `${quote.text} — ${quote.author}`;
}

// "다른 격언 보기"를 누르면 다음 격언으로 0.3초 페이드로 바꾼다 (이 선택은 저장하지 않는다)
function showNextQuote() {
  currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
  const quoteTextEl = document.getElementById("quote-text");

  if (prefersReducedMotion()) {
    renderQuote();
    return;
  }

  quoteTextEl.style.opacity = "0";
  window.setTimeout(() => {
    renderQuote();
    quoteTextEl.style.opacity = "1";
  }, 150);
}

// 진행률 카드의 뼈대(퍼센트, 진행 바, 카테고리별 미니 바)를 페이지를 열 때 한 번만 만든다.
// 이후에는 이 요소들의 텍스트/width만 바꿔서, width에 걸린 transition이 실제로 보이게 한다.
let progressEls = null;

function buildProgressSkeleton() {
  const progressEl = document.getElementById("progress");
  progressEl.textContent = "";

  const summary = document.createElement("div");
  summary.className = "progress-summary";

  const percentEl = document.createElement("div");
  percentEl.className = "progress-percent";
  percentEl.textContent = "0%";

  const countEl = document.createElement("div");
  countEl.className = "progress-count";
  countEl.textContent = "0/0 완료";

  summary.append(percentEl, countEl);

  const trackEl = document.createElement("div");
  trackEl.className = "progress-track";
  const fillEl = document.createElement("div");
  fillEl.className = "progress-fill";
  trackEl.appendChild(fillEl);

  const categoriesEl = document.createElement("div");
  categoriesEl.className = "progress-categories";
  const categoryEls = {};

  CATEGORY_ORDER.forEach((category) => {
    const col = document.createElement("div");
    col.className = "progress-category-item";

    const label = document.createElement("span");
    label.className = "progress-category-label";
    label.textContent = CATEGORY_LABELS[category];

    const countLabelEl = document.createElement("span");
    countLabelEl.className = "progress-category-count";
    countLabelEl.textContent = "0/0";

    const miniTrack = document.createElement("div");
    miniTrack.className = "progress-mini-track";
    const miniFillEl = document.createElement("div");
    miniFillEl.className = "progress-mini-fill";
    miniTrack.appendChild(miniFillEl);

    col.append(label, countLabelEl, miniTrack);
    categoriesEl.appendChild(col);

    categoryEls[category] = { countEl: countLabelEl, fillEl: miniFillEl };
  });

  const completeMsgEl = document.createElement("p");
  completeMsgEl.className = "progress-complete";
  completeMsgEl.textContent = "오늘 할 일을 모두 끝냈어요";
  completeMsgEl.hidden = true;

  progressEl.append(summary, trackEl, categoriesEl, completeMsgEl);

  progressEls = { percentEl, countEl, trackEl, fillEl, categoryEls, completeMsgEl };
}

let previousPercent = 0; // 퍼센트 숫자가 올라가거나 내려갈 때 시작점으로 쓴다
let previousAllDone = null; // null이면 아직 한 번도 갱신 전이라는 뜻 (앱을 막 열었을 때 축하 효과가 뜨지 않도록)
let percentAnimationId = 0; // 진행 중인 퍼센트 숫자 애니메이션을 새 갱신이 덮어쓸 수 있게 하는 토큰

// 이전 값에서 새 값까지 숫자를 0.6초 동안 부드럽게 세면서 콜백으로 전달한다
function animatePercentNumber(fromValue, toValue, durationMs, onUpdate) {
  if (prefersReducedMotion()) {
    onUpdate(toValue);
    return;
  }

  const runId = ++percentAnimationId;
  const startTime = performance.now();

  function step(now) {
    if (runId !== percentAnimationId) return; // 더 최신 갱신이 시작됐으면 이 애니메이션은 멈춘다
    const t = Math.min((now - startTime) / durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out
    onUpdate(Math.round(fromValue + (toValue - fromValue) * eased));
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// 진행률 카드의 숫자/바 width만 갱신한다 (요소를 다시 만들지 않아 transition이 실제로 보인다)
function updateProgress() {
  const progress = getProgress();
  const { done, total, percent } = progress.all;
  const allDone = total > 0 && done === total;

  progressEls.countEl.textContent = `${done}/${total} 완료`;
  progressEls.fillEl.style.width = `${percent}%`;
  progressEls.trackEl.classList.toggle("complete", allDone);
  progressEls.percentEl.classList.toggle("complete", allDone);

  animatePercentNumber(previousPercent, percent, 600, (value) => {
    progressEls.percentEl.textContent = `${value}%`;
  });
  previousPercent = percent;

  CATEGORY_ORDER.forEach((category) => {
    const item = progress[category];
    const els = progressEls.categoryEls[category];
    els.countEl.textContent = `${item.done}/${item.total}`;
    els.fillEl.style.width = `${item.percent}%`;
  });

  progressEls.completeMsgEl.hidden = !allDone;

  // 100%가 아니었다가 100%가 되는 순간에만 축하 효과를 보여준다 (앱을 열자마자 이미 100%면 건너뛴다)
  if (previousAllDone !== null && allDone && !previousAllDone && !prefersReducedMotion()) {
    triggerConfetti();
  }
  previousAllDone = allDone;
}

let isFirstProgressUpdate = true; // 첫 갱신만 0%에서 차오르는 모습이 보이도록 한 프레임 늦춘다

// render()가 부르는 진행률 갱신 진입점. 첫 갱신은 0% 상태가 실제로 화면에 그려진 뒤에 값을 바꿔야
// transition이 걸리므로, requestAnimationFrame으로 한 프레임(정확히는 두 프레임) 늦춘다.
function refreshProgress() {
  if (isFirstProgressUpdate) {
    isFirstProgressUpdate = false;
    requestAnimationFrame(() => requestAnimationFrame(updateProgress));
    return;
  }
  updateProgress();
}

// 진행률이 100%가 되는 순간 진행률 카드 위에 색종이 조각을 2초간 뿌리고 지운다
function triggerConfetti() {
  const progressCardEl = document.querySelector(".progress-card");
  if (!progressCardEl) return;

  const container = document.createElement("div");
  container.className = "confetti-container";

  const colors = ["var(--primary)", "var(--success)", "var(--work-text)", "var(--personal-text)", "var(--study-text)"];

  for (let i = 0; i < 30; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--fall-delay", `${Math.random() * 0.3}s`);
    piece.style.setProperty("--fall-x", `${(Math.random() - 0.5) * 120}px`);
    piece.style.setProperty("--fall-rotate", `${Math.random() * 720 - 360}deg`);
    container.appendChild(piece);
  }

  progressCardEl.appendChild(container);
  window.setTimeout(() => container.remove(), 2000);
}

// 완료 체크박스, 내용, 카테고리 배지, 중요 별, 수정/삭제 아이콘 버튼, 드래그 핸들이 있는 한 줄을 만든다
function createTodoItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.dataset.id = todo.id;
  if (todo.done) li.classList.add("done");

  const reorderAllowed = canReorder();

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "drag-handle";
  handle.innerHTML = ICONS.dragHandle;
  handle.setAttribute("aria-label", "순서 바꾸기");
  handle.tabIndex = 0;
  if (!reorderAllowed) {
    handle.classList.add("disabled");
    handle.setAttribute("aria-disabled", "true");
    handle.title = "정렬을 '내 순서'로, 필터를 '전체'로 바꾸면 순서를 바꿀 수 있어요";
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-toggle";
  checkbox.checked = todo.done;
  checkbox.setAttribute("aria-label", "완료 체크");

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;

  const badge = document.createElement("span");
  badge.className = `todo-category todo-category-${todo.category}`;
  badge.textContent = CATEGORY_LABELS[todo.category] || todo.category;

  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = "icon-button star-toggle";
  if (todo.important) starBtn.classList.add("active");
  starBtn.setAttribute("aria-pressed", String(todo.important));
  starBtn.setAttribute("aria-label", "중요 표시");
  starBtn.innerHTML = todo.important ? ICONS.starFilled : ICONS.starOutline;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-button todo-edit";
  editBtn.setAttribute("aria-label", "수정");
  editBtn.innerHTML = ICONS.edit;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-button todo-delete";
  deleteBtn.setAttribute("aria-label", "삭제");
  deleteBtn.innerHTML = ICONS.delete;

  const actions = document.createElement("div");
  actions.className = "todo-actions";
  actions.append(editBtn, deleteBtn);

  li.append(handle, checkbox, text, badge, starBtn, actions);
  return li;
}

// 수정 중인 할 일을 입력창 + 카테고리 select로 보여준다
function createEditItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item editing";
  li.dataset.id = todo.id;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.maxLength = 100;
  input.value = todo.text;

  const select = document.createElement("select");
  select.className = "todo-edit-category";
  CATEGORY_ORDER.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = CATEGORY_LABELS[category];
    if (category === todo.category) option.selected = true;
    select.appendChild(option);
  });

  li.append(input, select);
  return li;
}

// 목록이 비어 있을 때 아이콘과 안내 문구를 보여준다
function createEmptyState(message) {
  const li = document.createElement("li");
  li.className = "empty-message";

  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.innerHTML = ICONS.emptyState;

  const text = document.createElement("p");
  text.textContent = message;

  li.append(icon, text);
  return li;
}

// ----- 토스트 (삭제 실행 취소, 내보내기/가져오기 알림 등에 공용으로 쓴다) -----
let toastEl = null; // 페이지에 하나만 두고 재사용한다
let toastTimeoutId = null;

function ensureToastEl() {
  if (toastEl) return toastEl;
  toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  document.body.appendChild(toastEl);
  return toastEl;
}

// 토스트를 보여준다. actionLabel/onAction을 주면 클릭 가능한 버튼이 함께 뜬다.
// 이미 다른 토스트가 떠 있으면 그 토스트(와 실행 취소 기회)는 사라지고 이번 토스트로 바뀐다.
function showToast({ message, actionLabel, onAction, duration = 3000 }) {
  const el = ensureToastEl();
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }

  el.textContent = "";
  const messageSpan = document.createElement("span");
  messageSpan.textContent = message;
  el.appendChild(messageSpan);

  if (actionLabel && onAction) {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "toast-action";
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener("click", () => {
      hideToast();
      onAction();
    });
    el.appendChild(actionBtn);
  }

  // 연속으로 뜰 때도 슬라이드업 애니메이션이 처음부터 재생되도록 클래스를 뗐다 붙인다
  el.classList.remove("visible");
  void el.offsetWidth; // 강제로 리플로우를 일으켜 transition이 다시 걸리게 한다
  el.classList.add("visible");

  toastTimeoutId = window.setTimeout(hideToast, duration);
}

function hideToast() {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
  if (toastEl) toastEl.classList.remove("visible");
}

// ----- 배너 (손상된 데이터, 저장 실패, 하루 정리 제안) -----
// 같은 id의 배너가 이미 떠 있으면 새로 만들지 않는다
function showDismissibleBanner(id, message) {
  if (document.getElementById(id)) return;

  const banner = document.createElement("div");
  banner.className = "banner banner-warning";
  banner.id = id;

  const text = document.createElement("p");
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "icon-button";
  closeBtn.setAttribute("aria-label", "닫기");
  closeBtn.innerHTML = ICONS.close;
  closeBtn.addEventListener("click", () => banner.remove());

  banner.append(text, closeBtn);
  document.getElementById("banner").appendChild(banner);
}

function showCorruptDataBanner() {
  showDismissibleBanner(
    "corrupt-data-banner",
    "저장된 데이터를 읽지 못해 빈 목록으로 시작했어요. 원본은 브라우저에 보관되어 있어요."
  );
}

function showSaveFailedBanner() {
  showDismissibleBanner(
    "save-failed-banner",
    "지금은 새로고침하면 데이터가 사라져요. 내보내기로 백업해 두세요."
  );
}

// 어제까지 끝낸 할 일을 정리할지 묻는 배너를 보여준다
function showCleanupBanner(count) {
  if (document.getElementById("cleanup-banner")) return;

  const banner = document.createElement("div");
  banner.className = "banner banner-info";
  banner.id = "cleanup-banner";

  const text = document.createElement("p");
  text.textContent = `어제까지 끝낸 할 일이 ${count}개 있어요. 정리할까요?`;

  const actions = document.createElement("div");
  actions.className = "banner-actions";

  const cleanupBtn = document.createElement("button");
  cleanupBtn.type = "button";
  cleanupBtn.className = "btn-primary";
  cleanupBtn.textContent = "정리하기";
  cleanupBtn.addEventListener("click", () => {
    banner.remove();
    cleanupStaleCompleted();
  });

  const laterBtn = document.createElement("button");
  laterBtn.type = "button";
  laterBtn.className = "btn-secondary";
  laterBtn.textContent = "나중에";
  laterBtn.addEventListener("click", () => {
    banner.remove();
    const settings = loadSettings();
    settings.snoozeDate = getTodayDateString();
    saveSettings(settings);
  });

  actions.append(cleanupBtn, laterBtn);
  banner.append(text, actions);
  document.getElementById("banner").appendChild(banner);
}

// 앱을 열 때 어제까지 끝낸 완료 항목이 있으면(그리고 오늘 이미 "나중에"를 누르지 않았으면) 정리 배너를 띄운다
function checkDayCleanup() {
  const settings = loadSettings();
  if (settings.snoozeDate === getTodayDateString()) return;

  const staleTodos = getStaleCompletedTodos();
  if (staleTodos.length === 0) return;

  showCleanupBanner(staleTodos.length);
}

// ----- 더보기 메뉴 -----
function openMoreMenu() {
  const menu = document.getElementById("more-menu");
  menu.hidden = false;
  document.getElementById("more-menu-toggle").setAttribute("aria-expanded", "true");

  const firstItem = menu.querySelector(".more-menu-item:not(:disabled)");
  if (firstItem) firstItem.focus();
}

function closeMoreMenu() {
  const menu = document.getElementById("more-menu");
  if (menu.hidden) return;
  menu.hidden = true;
  document.getElementById("more-menu-toggle").setAttribute("aria-expanded", "false");
}

// ----- 가져오기 확인 dialog -----
let pendingImport = null; // { validTodos, skippedCount } - 검증을 통과해 dialog에서 확인을 기다리는 가져오기

function openImportDialog(validTodos, skippedCount) {
  pendingImport = validTodos;

  let message = `${validTodos.length}개를 가져올게요`;
  if (skippedCount > 0) {
    message += ` (형식이 맞지 않는 ${skippedCount}개는 건너뛰어요)`;
  }
  document.getElementById("import-dialog-message").textContent = message;
  document.getElementById("import-dialog").showModal();
}

// ===== events =====
let isCancelingEdit = false; // Esc로 취소할 때 뒤이은 focusout이 다시 저장하지 않도록 막는 플래그

// 입력값을 정리해서 새 할 일을 추가하고 입력창을 초기화한다
function handleFormSubmit(event) {
  event.preventDefault();

  const inputEl = document.getElementById("todo-input");
  const categoryInput = document.querySelector('input[name="category"]:checked');

  addTodo(inputEl.value, categoryInput.value);

  inputEl.value = "";
  inputEl.focus();
}

// 목록 클릭을 위임 처리한다: 수정 시작, 삭제, 중요 표시 토글 (아이콘 버튼 안쪽 클릭도 인식하도록 closest 사용)
function handleListClick(event) {
  const li = event.target.closest("li[data-id]");
  if (!li) return;
  const id = li.dataset.id;

  if (event.target.closest(".todo-delete")) {
    deleteTodo(id);
  } else if (event.target.closest(".todo-edit")) {
    enterEditMode(id);
  } else if (event.target.closest(".star-toggle")) {
    toggleImportant(id);
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

// 카테고리 필터 탭 클릭을 위임 처리한다
function handleFilterClick(event) {
  const button = event.target.closest(".filter-tab");
  if (!button) return;
  state.filter.category = button.dataset.category;
  render();
}

// 상태 필터 탭 클릭을 위임 처리한다
function handleStatusClick(event) {
  const button = event.target.closest(".status-tab");
  if (!button) return;
  state.filter.status = button.dataset.status;
  render();
}

// "중요만" 칩 클릭을 처리한다
function handleImportantOnlyClick() {
  state.filter.importantOnly = !state.filter.importantOnly;
  render();
}

// 검색어 입력을 처리한다 (검색창은 render()가 다시 만들지 않는 요소라 포커스가 유지된다)
function handleSearchInput(event) {
  state.filter.search = event.target.value;
  render();
}

// 검색어 지우기(X) 버튼을 처리한다
function handleSearchClear() {
  state.filter.search = "";
  const inputEl = document.getElementById("search-input");
  inputEl.value = "";
  inputEl.focus();
  render();
}

// 정렬 select 변경을 처리한다
function handleSortChange(event) {
  setSort(event.target.value);
}

// 테마 버튼 클릭을 처리한다: 라이트/다크를 서로 바꾼다
function handleThemeToggleClick() {
  setTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}

// 더보기 버튼 클릭을 처리한다: 메뉴를 열거나 닫는다
function handleMoreMenuToggleClick() {
  const menu = document.getElementById("more-menu");
  if (menu.hidden) openMoreMenu();
  else closeMoreMenu();
}

// 메뉴 바깥을 누르면 메뉴를 닫는다
function handleDocumentClick(event) {
  const wrapper = document.querySelector(".more-menu-wrapper");
  if (wrapper && !wrapper.contains(event.target)) closeMoreMenu();
}

// 메뉴가 열려 있을 때 Esc로 닫거나 위/아래 화살표로 항목 사이를 이동한다
function handleMoreMenuKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMoreMenu();
    document.getElementById("more-menu-toggle").focus();
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();

  const items = Array.from(document.querySelectorAll(".more-menu-item:not(:disabled)"));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement);
  const step = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + step + items.length) % items.length;
  items[nextIndex].focus();
}

// "내보내기" 메뉴 클릭을 처리한다
function handleMenuExportClick() {
  closeMoreMenu();
  exportTodos();
}

// "가져오기" 메뉴 클릭을 처리한다: 숨겨진 파일 선택창을 연다
function handleMenuImportClick() {
  closeMoreMenu();
  document.getElementById("import-file-input").click();
}

// "완료 항목 모두 삭제" 메뉴 클릭을 처리한다
function handleMenuClearCompletedClick() {
  closeMoreMenu();
  const completedCount = state.todos.filter((todo) => todo.done).length;
  if (completedCount === 0) return;
  if (window.confirm(`완료된 ${completedCount}개를 삭제할까요?`)) {
    deleteCompletedTodos();
  }
}

// 가져오기 파일을 선택하면 읽어서 검증한다
function handleImportFileChange(event) {
  const file = event.target.files[0];
  event.target.value = ""; // 같은 파일을 다시 골라도 change가 발생하도록 비운다
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (error) {
      showToast({ message: "가져올 수 없는 파일이에요" });
      return;
    }

    if (!parsed || !Array.isArray(parsed.todos)) {
      showToast({ message: "가져올 수 없는 파일이에요" });
      return;
    }

    const { validTodos, skippedCount } = validateImportedTodos(parsed.todos);
    if (validTodos.length === 0) {
      showToast({ message: "가져올 수 없는 파일이에요" });
      return;
    }

    openImportDialog(validTodos, skippedCount);
  };
  reader.onerror = () => {
    showToast({ message: "가져올 수 없는 파일이에요" });
  };
  reader.readAsText(file);
}

// 가져오기 dialog의 "현재 목록에 추가" 버튼을 처리한다
function handleImportMergeClick() {
  if (!pendingImport) return;
  const addedCount = mergeImportedTodos(pendingImport);
  document.getElementById("import-dialog").close();
  showToast({ message: `${addedCount}개를 추가했어요` });
}

// 가져오기 dialog의 "현재 목록 대체" 버튼을 처리한다
function handleImportReplaceClick() {
  if (!pendingImport) return;
  replaceAllTodos(pendingImport);
  document.getElementById("import-dialog").close();
  showToast({ message: `${state.todos.length}개로 대체했어요` });
}

// 가져오기 dialog의 "취소" 버튼을 처리한다
function handleImportCancelClick() {
  document.getElementById("import-dialog").close();
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

// 드래그 핸들에 포커스가 있을 때 Alt+위/아래 화살표로 순서를 바꾼다
function handleDragHandleKeydown(event) {
  if (!event.target.classList.contains("drag-handle")) return;
  if (!event.altKey || !canReorder()) return;

  const li = event.target.closest("li[data-id]");
  if (!li) return;

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveTodoBy(li.dataset.id, -1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveTodoBy(li.dataset.id, 1);
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

// 드래그 핸들을 누르는 순간에만 그 항목(li)을 draggable로 만든다 (핸들 밖에서 시작하는 드래그는 막는다)
function handleListMouseDown(event) {
  const handle = event.target.closest(".drag-handle");
  if (!handle || handle.classList.contains("disabled")) return;
  const li = handle.closest("li[data-id]");
  if (li) li.draggable = true;
}

let dragSourceId = null; // 지금 드래그 중인 항목의 id
let dropTargetEl = null; // 드롭 위치 표시선이 걸려 있는 요소

// 드롭 위치 표시선을 목표 li 위/아래에 보여준다
function showDropIndicator(li, isAfter) {
  if (dropTargetEl && dropTargetEl !== li) {
    dropTargetEl.classList.remove("drop-before", "drop-after");
  }
  li.classList.toggle("drop-before", !isAfter);
  li.classList.toggle("drop-after", isAfter);
  dropTargetEl = li;
}

// 드롭 위치 표시선을 지운다
function clearDropIndicator() {
  if (dropTargetEl) {
    dropTargetEl.classList.remove("drop-before", "drop-after");
    dropTargetEl = null;
  }
}

// 드래그를 시작한다 (순서를 바꿀 수 없는 상태면 막는다)
function handleListDragStart(event) {
  const li = event.target.closest("li[data-id]");
  if (!li || !canReorder()) {
    event.preventDefault();
    return;
  }
  dragSourceId = li.dataset.id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", li.dataset.id);
  requestAnimationFrame(() => li.classList.add("dragging"));
}

// 드래그 중인 항목이 다른 항목 위를 지날 때 놓을 위치(위/아래)를 계산해 표시선을 그린다
function handleListDragOver(event) {
  if (!dragSourceId) return;
  event.preventDefault(); // 이걸 해야 drop 이벤트가 발생한다

  const li = event.target.closest("li[data-id]");
  if (!li || li.dataset.id === dragSourceId) {
    clearDropIndicator();
    return;
  }

  const rect = li.getBoundingClientRect();
  const isAfter = event.clientY > rect.top + rect.height / 2;
  showDropIndicator(li, isAfter);
}

// 항목을 놓으면 실제로 순서를 바꾼다
function handleListDrop(event) {
  if (!dragSourceId) return;
  event.preventDefault();

  const li = event.target.closest("li[data-id]");
  clearDropIndicator();

  if (li && li.dataset.id !== dragSourceId) {
    const rect = li.getBoundingClientRect();
    const isAfter = event.clientY > rect.top + rect.height / 2;
    reorderTodo(dragSourceId, li.dataset.id, isAfter);
  }

  dragSourceId = null;
}

// 드래그가 끝나면(성공/취소 모두) 시각 효과와 상태를 정리한다
function handleListDragEnd(event) {
  const li = event.target.closest("li[data-id]");
  if (li) {
    li.draggable = false;
    li.classList.remove("dragging");
  }
  clearDropIndicator();
  dragSourceId = null;
}

// 페이지 로드 시 저장된 데이터/설정을 불러와 상태에 채우고 화면을 그린다
function init() {
  renderDate();
  renderQuote();
  document.getElementById("quote-next").innerHTML = ICONS.refresh;
  updateThemeToggleIcon(getCurrentTheme());

  const settings = loadSettings();
  state.sort = settings.sort || "custom";
  state.todos = load();

  if (hadCorruptData) showCorruptDataBanner();
  checkDayCleanup();

  buildProgressSkeleton();
  render();

  const formEl = document.getElementById("todo-form");
  formEl.addEventListener("submit", handleFormSubmit);

  const listEl = document.getElementById("todo-list");
  listEl.addEventListener("click", handleListClick);
  listEl.addEventListener("dblclick", handleListDblClick);
  listEl.addEventListener("change", handleListChange);
  listEl.addEventListener("keydown", handleListKeydown);
  listEl.addEventListener("keydown", handleDragHandleKeydown);
  listEl.addEventListener("focusout", handleListFocusout);
  listEl.addEventListener("mousedown", handleListMouseDown);
  listEl.addEventListener("dragstart", handleListDragStart);
  listEl.addEventListener("dragover", handleListDragOver);
  listEl.addEventListener("drop", handleListDrop);
  listEl.addEventListener("dragend", handleListDragEnd);

  document.getElementById("filter-tabs").addEventListener("click", handleFilterClick);
  document.getElementById("status-tabs").addEventListener("click", handleStatusClick);
  document.getElementById("important-only-toggle").addEventListener("click", handleImportantOnlyClick);
  document.getElementById("search-input").addEventListener("input", handleSearchInput);
  document.getElementById("search-clear").addEventListener("click", handleSearchClear);
  document.getElementById("sort-select").addEventListener("change", handleSortChange);

  document.getElementById("theme-toggle").addEventListener("click", handleThemeToggleClick);
  document.getElementById("quote-next").addEventListener("click", showNextQuote);

  document.getElementById("more-menu-toggle").addEventListener("click", handleMoreMenuToggleClick);
  document.getElementById("more-menu").addEventListener("keydown", handleMoreMenuKeydown);
  document.addEventListener("click", handleDocumentClick);

  document.getElementById("menu-export").addEventListener("click", handleMenuExportClick);
  document.getElementById("menu-import").addEventListener("click", handleMenuImportClick);
  document.getElementById("menu-clear-completed").addEventListener("click", handleMenuClearCompletedClick);
  document.getElementById("import-file-input").addEventListener("change", handleImportFileChange);

  document.getElementById("import-merge-btn").addEventListener("click", handleImportMergeClick);
  document.getElementById("import-replace-btn").addEventListener("click", handleImportReplaceClick);
  document.getElementById("import-cancel-btn").addEventListener("click", handleImportCancelClick);
  document.getElementById("import-dialog").addEventListener("close", () => { pendingImport = null; });
}

document.addEventListener("DOMContentLoaded", init);
