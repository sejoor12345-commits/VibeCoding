// ===== state =====
// 앱 전체 상태: 할 일 목록과 현재 필터
const state = {
  todos: [],
  filter: { category: "all", status: "all" },
};

// ===== storage =====
const STORAGE_KEY = "todo-app:v1"; // 정상 데이터를 저장할 localStorage 키
const CORRUPT_KEY = "todo-app:v1:corrupt"; // 손상된 데이터를 옮겨둘 키
const SETTINGS_KEY = "todo-app:settings"; // 테마 등 앱 설정을 저장할 키 (할 일 데이터와 분리)

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

// 테마를 라이트/다크로 바꾸고 저장한다 (할 일 데이터와 별개인 설정 키를 쓴다)
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const settings = loadSettings();
  settings.theme = theme;
  saveSettings(settings);
  updateThemeToggleIcon(theme);
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

// 수정/삭제/추가/테마/격언 새로고침 버튼에 쓰는 인라인 SVG 아이콘 (고정된 마크업이라 innerHTML로 넣어도 안전하다)
const ICONS = {
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  delete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  emptyState: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="m9 13 2 2 4-4"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>',
  refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
};

let editingId = null; // 지금 수정 중인 할 일 id (저장되지 않는 화면 전용 상태)

// 현재 state를 기준으로 필터 탭, 진행률, 할 일 목록을 다시 그린다
function render() {
  renderFilterTabs();
  refreshProgress();

  const listEl = document.getElementById("todo-list");
  listEl.textContent = ""; // 기존 목록을 비운 뒤 새로 그린다

  const todos = getVisibleTodos();

  if (todos.length === 0) {
    const message = state.todos.length === 0
      ? "아직 할 일이 없어요. 위에서 첫 할 일을 추가해 보세요."
      : "이 카테고리에는 할 일이 없어요.";
    listEl.appendChild(createEmptyState(message));
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
    button.setAttribute("aria-pressed", tab.value === state.filter.category ? "true" : "false");
    button.dataset.category = tab.value;
    button.textContent = tab.label;
    tabsEl.appendChild(button);
  });
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

// 완료 체크박스, 내용, 카테고리 배지, 수정/삭제 아이콘 버튼이 있는 한 줄을 만든다
function createTodoItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.dataset.id = todo.id;
  if (todo.done) li.classList.add("done");

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

  li.append(checkbox, text, badge, actions);
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

// 목록 클릭을 위임 처리한다: 수정 시작, 삭제 (아이콘 버튼 안쪽 클릭도 인식하도록 closest 사용)
function handleListClick(event) {
  const li = event.target.closest("li[data-id]");
  if (!li) return;
  const id = li.dataset.id;

  if (event.target.closest(".todo-delete")) {
    deleteTodo(id);
  } else if (event.target.closest(".todo-edit")) {
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

// 테마 버튼 클릭을 처리한다: 라이트/다크를 서로 바꾼다
function handleThemeToggleClick() {
  setTheme(getCurrentTheme() === "dark" ? "light" : "dark");
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
  renderDate();
  renderQuote();
  document.getElementById("quote-next").innerHTML = ICONS.refresh;
  updateThemeToggleIcon(getCurrentTheme());

  state.todos = load();

  buildProgressSkeleton();
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

  document.getElementById("theme-toggle").addEventListener("click", handleThemeToggleClick);
  document.getElementById("quote-next").addEventListener("click", showNextQuote);
}

document.addEventListener("DOMContentLoaded", init);
