"use strict";

const STORAGE_KEYS = {
  bestScore: "vetmaster.bestScore",
  lastScore: "vetmaster.lastScore",
  mistakes: "vetmaster.mistakes",
  favorites: "vetmaster.favorites",
  draft: "vetmaster.examDraft.v2",
};

const OPTION_LETTERS = ["A", "B", "C", "D"];
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const DIFFICULTY_LABELS = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const DEFAULT_SETTINGS = {
  count: 10,
  timerMode: "total",
  totalMinutes: 15,
  questionSeconds: 60,
  difficulty: "mixed",
  feedbackMode: "exam",
  shuffleQuestions: true,
  shuffleOptions: true,
};

const state = {
  allQuestions: [],
  questions: [],
  answers: [],
  locked: [],
  flags: new Set(),
  currentIndex: 0,
  secondsRemaining: DEFAULT_SETTINGS.totalMinutes * 60,
  perQuestionRemaining: [],
  timerId: null,
  timerTicks: 0,
  setupSource: "all",
  source: "all",
  settings: { ...DEFAULT_SETTINGS },
  finished: true,
  db: null,
  dataSource: "loading",
};

const elements = {
  screens: [...document.querySelectorAll(".screen")],
  startExam: document.querySelector("#start-exam"),
  practiceMistakes: document.querySelector("#practice-mistakes"),
  practiceFavorites: document.querySelector("#practice-favorites"),
  mistakesBadge: document.querySelector("#mistakes-badge"),
  favoritesBadge: document.querySelector("#favorites-badge"),
  mistakeCount: document.querySelector("#mistake-count"),
  favoriteCount: document.querySelector("#favorite-count"),
  bestScore: document.querySelector("#best-score"),
  bestScoreRing: document.querySelector("#best-score-ring"),
  lastScore: document.querySelector("#last-score"),
  bankStatus: document.querySelector("#bank-status"),
  resumeBanner: document.querySelector("#resume-banner"),
  resumeSummary: document.querySelector("#resume-summary"),
  resumeExam: document.querySelector("#resume-exam"),
  discardExam: document.querySelector("#discard-exam"),
  setupKicker: document.querySelector("#setup-kicker"),
  cancelSetup: document.querySelector("#cancel-setup"),
  examSettings: document.querySelector("#exam-settings"),
  topicOptions: document.querySelector("#topic-options"),
  selectAllTopics: document.querySelector("#select-all-topics"),
  clearAllTopics: document.querySelector("#clear-all-topics"),
  totalTimeField: document.querySelector("#total-time-field"),
  questionTimeField: document.querySelector("#question-time-field"),
  totalMinutes: document.querySelector("#total-minutes"),
  questionSeconds: document.querySelector("#question-seconds"),
  shuffleQuestions: document.querySelector("#shuffle-questions"),
  shuffleOptions: document.querySelector("#shuffle-options"),
  availableCount: document.querySelector("#available-count"),
  launchExam: document.querySelector("#launch-exam"),
  quizMode: document.querySelector("#quiz-mode"),
  questionCounter: document.querySelector("#question-counter"),
  questionCategory: document.querySelector("#question-category"),
  questionSubtopic: document.querySelector("#question-subtopic"),
  questionNumberMark: document.querySelector("#question-number-mark"),
  questionText: document.querySelector("#question-text"),
  questionImage: document.querySelector("#question-image"),
  optionsList: document.querySelector("#options-list"),
  studyFeedback: document.querySelector("#study-feedback"),
  progressTrack: document.querySelector(".progress-track"),
  progressValue: document.querySelector("#progress-value"),
  timer: document.querySelector("#timer"),
  timerValue: document.querySelector("#timer-value"),
  previousQuestion: document.querySelector("#previous-question"),
  nextQuestion: document.querySelector("#next-question"),
  finishExam: document.querySelector("#finish-exam"),
  answerStatus: document.querySelector("#answer-status"),
  favoriteQuestion: document.querySelector("#favorite-question"),
  flagQuestion: document.querySelector("#flag-question"),
  questionNavigator: document.querySelector("#question-navigator"),
  resultLabel: document.querySelector("#result-label"),
  resultMessage: document.querySelector("#result-message"),
  resultPercent: document.querySelector("#result-percent"),
  resultFraction: document.querySelector("#result-fraction"),
  resultRingValue: document.querySelector("#result-ring-value"),
  correctCount: document.querySelector("#correct-count"),
  wrongCount: document.querySelector("#wrong-count"),
  topicBreakdown: document.querySelector("#topic-breakdown"),
  reviewList: document.querySelector("#review-list"),
  toggleReview: document.querySelector("#toggle-review"),
  newExam: document.querySelector("#new-exam"),
  goHome: document.querySelector("#go-home"),
  brandHome: document.querySelector("#brand-home"),
  toast: document.querySelector("#toast"),
};

let toastTimer = null;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // The app remains usable when storage is blocked.
  }
}

function readNumber(key, fallback = 0) {
  try {
    const value = Number.parseInt(localStorage.getItem(key) ?? "", 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The app remains usable when storage is blocked.
  }
}

function readIdSet(key) {
  const values = readJson(key, []);
  return new Set(
    Array.isArray(values) ? values.filter((value) => typeof value === "string") : [],
  );
}

function writeIdSet(key, ids) {
  writeJson(key, [...ids]);
}

function cleanStoredQuestionIds() {
  const validIds = new Set(state.allQuestions.map((question) => question.id));
  [STORAGE_KEYS.mistakes, STORAGE_KEYS.favorites].forEach((key) => {
    const storedIds = readIdSet(key);
    const cleanedIds = new Set([...storedIds].filter((id) => validIds.has(id)));
    if (cleanedIds.size !== storedIds.size) writeIdSet(key, cleanedIds);
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function simpleHash(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function stableLegacyId(label, prefix) {
  return `${prefix}-${simpleHash(label || "general")}`;
}

function normalizeQuestion(rawQuestion, topicMap = new Map(), subtopicMap = new Map()) {
  if (!rawQuestion || typeof rawQuestion !== "object") return null;

  const topic = topicMap.get(String(rawQuestion.topic_id)) ?? rawQuestion.topic ?? null;
  const subtopic =
    subtopicMap.get(String(rawQuestion.subtopic_id)) ?? rawQuestion.subtopic ?? null;
  const topicName =
    topic?.name || rawQuestion.topic_name || rawQuestion.category || "General";
  const subtopicName =
    subtopic?.name || rawQuestion.subtopic_name || rawQuestion.disease || "General";
  const options = Array.isArray(rawQuestion.options)
    ? rawQuestion.options.map((option) => String(option))
    : [];
  const answer = Number(rawQuestion.correct_index ?? rawQuestion.answer);
  const id = String(rawQuestion.id ?? stableLegacyId(rawQuestion.question_text, "question"));
  const questionText = String(rawQuestion.question_text ?? rawQuestion.question ?? "").trim();

  if (
    !id ||
    !questionText ||
    options.length !== 4 ||
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer >= options.length
  ) {
    return null;
  }

  const topicId =
    rawQuestion.topic_id != null
      ? String(rawQuestion.topic_id)
      : String(topic?.id ?? stableLegacyId(topicName, "topic"));
  const subtopicId =
    rawQuestion.subtopic_id != null
      ? String(rawQuestion.subtopic_id)
      : String(subtopic?.id ?? stableLegacyId(`${topicId}:${subtopicName}`, "subtopic"));

  return {
    id,
    topicId,
    topicName,
    subtopicId,
    subtopicName,
    question: questionText,
    options,
    answer,
    explanation: String(rawQuestion.explanation ?? "").trim(),
    difficulty: ["easy", "medium", "hard"].includes(rawQuestion.difficulty)
      ? rawQuestion.difficulty
      : "medium",
    priority: Number(rawQuestion.priority ?? 3),
    imageUrl: rawQuestion.image_url || rawQuestion.imageUrl || "",
    sourceNote: String(rawQuestion.source_note ?? rawQuestion.sourceNote ?? "").trim(),
  };
}

function createDatabaseClient() {
  const config = window.VETMASTER_SUPABASE;
  const createClient = window.supabase?.createClient;
  if (!config?.url || !config?.publishableKey || typeof createClient !== "function") {
    return null;
  }

  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

async function loadQuestionsFromDatabase() {
  if (!state.db) return [];

  const [topicsResult, subtopicsResult, questionsResult] = await Promise.all([
    state.db.from("topics").select("id,name,slug").eq("is_active", true),
    state.db
      .from("subtopics")
      .select("id,topic_id,name,slug")
      .eq("is_active", true),
    state.db
      .from("questions")
      .select(
        "id,topic_id,subtopic_id,question_text,options,correct_index,explanation,difficulty,priority,image_url,source_note,created_at",
      )
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  const firstError = topicsResult.error || subtopicsResult.error || questionsResult.error;
  if (firstError) throw firstError;

  const topicMap = new Map(
    (topicsResult.data ?? []).map((topic) => [String(topic.id), topic]),
  );
  const subtopicMap = new Map(
    (subtopicsResult.data ?? []).map((subtopic) => [String(subtopic.id), subtopic]),
  );

  return (questionsResult.data ?? [])
    .map((question) => normalizeQuestion(question, topicMap, subtopicMap))
    .filter(Boolean);
}

async function loadFallbackQuestions() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const questions = await response.json();
  if (!Array.isArray(questions)) throw new Error("Question bank format is invalid");
  return questions.map((question) => normalizeQuestion(question)).filter(Boolean);
}

function showScreen(screenId) {
  elements.screens.forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2800);
}

function getSourceQuestions(source = state.setupSource) {
  if (source === "mistakes") {
    const ids = readIdSet(STORAGE_KEYS.mistakes);
    return state.allQuestions.filter((question) => ids.has(question.id));
  }
  if (source === "favorites") {
    const ids = readIdSet(STORAGE_KEYS.favorites);
    return state.allQuestions.filter((question) => ids.has(question.id));
  }
  return state.allQuestions;
}

function updateHomeStats() {
  const best = readNumber(STORAGE_KEYS.bestScore, -1);
  const last = readNumber(STORAGE_KEYS.lastScore, -1);
  const mistakeIds = readIdSet(STORAGE_KEYS.mistakes);
  const favoriteIds = readIdSet(STORAGE_KEYS.favorites);

  elements.bestScore.textContent = best >= 0 ? `${best}%` : "—";
  elements.lastScore.textContent = last >= 0 ? `${last}%` : "—";
  elements.mistakeCount.textContent = String(mistakeIds.size);
  elements.mistakesBadge.textContent = String(mistakeIds.size);
  elements.favoriteCount.textContent = String(favoriteIds.size);
  elements.favoritesBadge.textContent = String(favoriteIds.size);
  elements.practiceMistakes.disabled = mistakeIds.size === 0;
  elements.practiceFavorites.disabled = favoriteIds.size === 0;
  elements.practiceMistakes.title =
    mistakeIds.size === 0 ? "لا توجد أسئلة خاطئة محفوظة بعد" : "";
  elements.practiceFavorites.title =
    favoriteIds.size === 0 ? "لم تضف أسئلة للمفضلة بعد" : "";

  const circumference = 314.16;
  const progress = best >= 0 ? best / 100 : 0;
  elements.bestScoreRing.style.strokeDashoffset = String(circumference * (1 - progress));
}

function getSavedDraft() {
  const draft = readJson(STORAGE_KEYS.draft, null);
  if (
    !draft ||
    draft.version !== 2 ||
    !Array.isArray(draft.questions) ||
    draft.questions.length === 0 ||
    Date.now() - Number(draft.savedAt ?? 0) > DRAFT_MAX_AGE
  ) {
    removeStorage(STORAGE_KEYS.draft);
    return null;
  }
  return draft;
}

function updateResumeBanner() {
  const draft = getSavedDraft();
  elements.resumeBanner.classList.toggle("hidden", !draft);
  if (!draft) return;

  const answered = Array.isArray(draft.answers)
    ? draft.answers.filter((answer) => answer !== null).length
    : 0;
  elements.resumeSummary.textContent = `${answered} من ${draft.questions.length} أسئلة مُجابة — كمّل من مكانك.`;
}

function saveDraft() {
  if (state.finished || !document.querySelector("#quiz-screen").classList.contains("active")) {
    return;
  }

  writeJson(STORAGE_KEYS.draft, {
    version: 2,
    savedAt: Date.now(),
    source: state.source,
    questions: state.questions,
    answers: state.answers,
    locked: state.locked,
    flags: [...state.flags],
    currentIndex: state.currentIndex,
    secondsRemaining: state.secondsRemaining,
    perQuestionRemaining: state.perQuestionRemaining,
    settings: state.settings,
  });
  updateResumeBanner();
}

function discardDraft(showMessage = true) {
  removeStorage(STORAGE_KEYS.draft);
  updateResumeBanner();
  if (showMessage) showToast("تم حذف المحاولة المحفوظة");
}

function resumeSavedExam() {
  const draft = getSavedDraft();
  if (!draft) {
    showToast("ما في محاولة محفوظة حاليًا");
    updateResumeBanner();
    return;
  }

  const questions = draft.questions.map((question) => normalizeQuestion(question)).filter(Boolean);
  if (questions.length !== draft.questions.length) {
    discardDraft(false);
    showToast("تعذّر استعادة المحاولة القديمة");
    return;
  }

  state.questions = questions;
  state.answers = questions.map((_, index) =>
    Number.isInteger(draft.answers?.[index]) ? draft.answers[index] : null,
  );
  state.locked = questions.map((_, index) => Boolean(draft.locked?.[index]));
  state.flags = new Set(
    Array.isArray(draft.flags) ? draft.flags.filter((id) => typeof id === "string") : [],
  );
  state.currentIndex = Math.min(
    Math.max(Number(draft.currentIndex ?? 0), 0),
    questions.length - 1,
  );
  state.secondsRemaining = Math.max(Number(draft.secondsRemaining ?? 0), 0);
  state.perQuestionRemaining = questions.map((_, index) =>
    Math.max(
      Number(draft.perQuestionRemaining?.[index] ?? draft.settings?.questionSeconds ?? 60),
      0,
    ),
  );
  state.settings = { ...DEFAULT_SETTINGS, ...(draft.settings ?? {}) };
  state.source = draft.source ?? "all";
  state.finished = false;

  elements.progressTrack.setAttribute("aria-valuemax", String(state.questions.length));
  showScreen("quiz-screen");
  renderQuestion();
  startTimer();
  showToast("رجعناك لنفس مكانك 👌");
}

function buildCatalog(questions) {
  const topics = new Map();
  questions.forEach((question) => {
    if (!topics.has(question.topicId)) {
      topics.set(question.topicId, {
        id: question.topicId,
        name: question.topicName,
        subtopics: new Map(),
      });
    }
    const topic = topics.get(question.topicId);
    if (!topic.subtopics.has(question.subtopicId)) {
      topic.subtopics.set(question.subtopicId, {
        id: question.subtopicId,
        name: question.subtopicName,
      });
    }
  });
  return [...topics.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "en"),
  );
}

function renderTopicOptions(questions) {
  const catalog = buildCatalog(questions);
  elements.topicOptions.replaceChildren();

  if (catalog.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "لا توجد مواضيع ضمن هذا القسم بعد.";
    elements.topicOptions.append(empty);
    updateAvailableCount();
    return;
  }

  catalog.forEach((topic) => {
    const group = document.createElement("article");
    group.className = "topic-group";

    const heading = document.createElement("label");
    heading.className = "topic-heading";

    const topicInput = document.createElement("input");
    topicInput.type = "checkbox";
    topicInput.checked = true;
    topicInput.className = "topic-check";
    topicInput.dataset.topicId = topic.id;

    const topicCopy = document.createElement("span");
    const topicName = document.createElement("strong");
    topicName.textContent = topic.name;
    const topicCount = document.createElement("small");
    const count = questions.filter((question) => question.topicId === topic.id).length;
    topicCount.textContent = `${count} سؤال`;
    topicCopy.append(topicName, topicCount);

    heading.append(topicInput, topicCopy);
    group.append(heading);

    const subtopicList = document.createElement("div");
    subtopicList.className = "subtopic-list";
    [...topic.subtopics.values()]
      .sort((first, second) => first.name.localeCompare(second.name, "en"))
      .forEach((subtopic) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.className = "subtopic-check";
        input.dataset.topicId = topic.id;
        input.value = subtopic.id;
        const text = document.createElement("span");
        text.textContent = subtopic.name;
        label.append(input, text);
        subtopicList.append(label);
      });
    group.append(subtopicList);
    elements.topicOptions.append(group);

    topicInput.addEventListener("change", () => {
      subtopicList.querySelectorAll(".subtopic-check").forEach((input) => {
        input.checked = topicInput.checked;
      });
      topicInput.indeterminate = false;
      updateAvailableCount();
    });

    subtopicList.addEventListener("change", () => {
      const inputs = [...subtopicList.querySelectorAll(".subtopic-check")];
      const selectedCount = inputs.filter((input) => input.checked).length;
      topicInput.checked = selectedCount > 0;
      topicInput.indeterminate = selectedCount > 0 && selectedCount < inputs.length;
      updateAvailableCount();
    });
  });

  updateAvailableCount();
}

function getSelectedSubtopics() {
  return new Set(
    [...elements.topicOptions.querySelectorAll(".subtopic-check:checked")].map(
      (input) => input.value,
    ),
  );
}

function getSelectedDifficulty() {
  return (
    elements.examSettings.querySelector('input[name="difficulty"]:checked')?.value ??
    "mixed"
  );
}

function getFilteredQuestions() {
  const selectedSubtopics = getSelectedSubtopics();
  const difficulty = getSelectedDifficulty();
  return getSourceQuestions().filter((question) => {
    const subtopicMatches = selectedSubtopics.has(question.subtopicId);
    const difficultyMatches =
      difficulty === "mixed" || question.difficulty === difficulty;
    return subtopicMatches && difficultyMatches;
  });
}

function updateAvailableCount() {
  const count = getFilteredQuestions().length;
  elements.availableCount.textContent = String(count);
  elements.launchExam.disabled = count === 0;
}

function openSetup(source = "all") {
  const sourceQuestions = getSourceQuestions(source);
  if (sourceQuestions.length === 0) {
    showToast(
      source === "mistakes"
        ? "ما عندك أخطاء محفوظة حاليًا 👌"
        : source === "favorites"
          ? "أضف أسئلة للمفضلة أولًا"
          : "بنك الأسئلة فارغ",
    );
    updateHomeStats();
    return;
  }

  state.setupSource = source;
  elements.setupKicker.textContent =
    source === "mistakes"
      ? "تدريب على الأخطاء"
      : source === "favorites"
        ? "الأسئلة المفضلة"
        : "امتحان جديد";
  renderTopicOptions(sourceQuestions);
  showScreen("setup-screen");
}

function readSettings() {
  const rawCount =
    elements.examSettings.querySelector('input[name="question-count"]:checked')?.value ??
    "10";
  const timerMode =
    elements.examSettings.querySelector('input[name="timer-mode"]:checked')?.value ??
    "total";
  const feedbackMode =
    elements.examSettings.querySelector('input[name="feedback-mode"]:checked')?.value ??
    "exam";

  return {
    count: rawCount === "all" ? "all" : Number(rawCount),
    timerMode,
    totalMinutes: Number(elements.totalMinutes.value),
    questionSeconds: Number(elements.questionSeconds.value),
    difficulty: getSelectedDifficulty(),
    feedbackMode,
    shuffleQuestions: elements.shuffleQuestions.checked,
    shuffleOptions: elements.shuffleOptions.checked,
  };
}

function prepareQuestion(question, shouldShuffleOptions) {
  if (!shouldShuffleOptions) return { ...question, options: [...question.options] };

  const orderedOptions = shuffle(
    question.options.map((text, originalIndex) => ({ text, originalIndex })),
  );
  return {
    ...question,
    options: orderedOptions.map((option) => option.text),
    answer: orderedOptions.findIndex(
      (option) => option.originalIndex === question.answer,
    ),
  };
}

function launchExam() {
  const filteredQuestions = getFilteredQuestions();
  if (filteredQuestions.length === 0) {
    showToast("اختَر موضوعًا أو مستوى فيه أسئلة");
    return;
  }

  const settings = readSettings();
  const orderedQuestions = settings.shuffleQuestions
    ? shuffle(filteredQuestions)
    : [...filteredQuestions];
  const requestedCount =
    settings.count === "all" ? orderedQuestions.length : settings.count;
  const selectedQuestions = orderedQuestions.slice(
    0,
    Math.min(requestedCount, orderedQuestions.length),
  );

  state.settings = settings;
  state.source = state.setupSource;
  state.questions = selectedQuestions.map((question) =>
    prepareQuestion(question, settings.shuffleOptions),
  );
  state.answers = Array(state.questions.length).fill(null);
  state.locked = Array(state.questions.length).fill(false);
  state.flags = new Set();
  state.currentIndex = 0;
  state.secondsRemaining = settings.totalMinutes * 60;
  state.perQuestionRemaining = Array(state.questions.length).fill(
    settings.questionSeconds,
  );
  state.finished = false;
  state.timerTicks = 0;

  elements.progressTrack.setAttribute("aria-valuemax", String(state.questions.length));
  showScreen("quiz-screen");
  renderQuestion();
  startTimer();
  saveDraft();

  if (requestedCount > selectedQuestions.length) {
    showToast(`بدأنا بكل الأسئلة المتاحة: ${selectedQuestions.length}`);
  }
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function currentTimerSeconds() {
  if (state.settings.timerMode === "question") {
    return state.perQuestionRemaining[state.currentIndex] ?? 0;
  }
  return state.secondsRemaining;
}

function updateTimer() {
  const withoutTimer = state.settings.timerMode === "none";
  elements.timer.classList.toggle("timer-hidden", withoutTimer);
  if (withoutTimer) {
    elements.timerValue.textContent = "بدون وقت";
    return;
  }

  const seconds = currentTimerSeconds();
  elements.timerValue.textContent = formatTime(seconds);
  const warningLimit = state.settings.timerMode === "question" ? 10 : 60;
  elements.timer.classList.toggle("warning", seconds <= warningLimit);
}

function stopTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function handleQuestionTimeout() {
  state.locked[state.currentIndex] = true;
  showToast("انتهى وقت السؤال");
  if (state.currentIndex >= state.questions.length - 1) {
    submitExam("time");
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
  saveDraft();
}

function startTimer() {
  stopTimer();
  updateTimer();
  if (state.settings.timerMode === "none") return;

  state.timerId = window.setInterval(() => {
    if (state.settings.timerMode === "total") {
      state.secondsRemaining -= 1;
      if (state.secondsRemaining <= 0) {
        submitExam("time");
        return;
      }
    } else {
      state.perQuestionRemaining[state.currentIndex] -= 1;
      if (state.perQuestionRemaining[state.currentIndex] <= 0) {
        handleQuestionTimeout();
        return;
      }
    }

    state.timerTicks += 1;
    updateTimer();
    if (state.timerTicks % 5 === 0) saveDraft();
  }, 1000);
}

function getQuizModeLabel() {
  const sourceLabel =
    state.source === "mistakes"
      ? "تدريب الأخطاء"
      : state.source === "favorites"
        ? "الأسئلة المفضلة"
        : state.settings.feedbackMode === "study"
          ? "Study Mode"
          : "Exam Mode";
  return sourceLabel;
}

function updateQuestionTools(question) {
  const isFavorite = readIdSet(STORAGE_KEYS.favorites).has(question.id);
  const isFlagged = state.flags.has(question.id);

  elements.favoriteQuestion.classList.toggle("active", isFavorite);
  elements.favoriteQuestion.querySelector("span").textContent = isFavorite ? "★" : "☆";
  elements.favoriteQuestion.setAttribute(
    "aria-label",
    isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة",
  );

  elements.flagQuestion.classList.toggle("active", isFlagged);
  elements.flagQuestion.setAttribute("aria-pressed", String(isFlagged));
}

function renderStudyFeedback(question, answerIndex) {
  const shouldShow =
    state.settings.feedbackMode === "study" && state.locked[state.currentIndex];
  elements.studyFeedback.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    elements.studyFeedback.replaceChildren();
    return;
  }

  const isCorrect = answerIndex === question.answer;
  const title = document.createElement("strong");
  title.textContent = isCorrect
    ? "Correct ✓"
    : `Correct answer: ${question.options[question.answer]}`;
  const explanation = document.createElement("p");
  explanation.textContent =
    question.explanation || "No explanation has been added for this question yet.";
  elements.studyFeedback.className = `study-feedback ${isCorrect ? "correct" : "wrong"}`;
  elements.studyFeedback.replaceChildren(title, explanation);
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) return;

  const questionNumber = state.currentIndex + 1;
  const totalQuestions = state.questions.length;
  const savedAnswer = state.answers[state.currentIndex];
  const isStudyLocked =
    state.settings.feedbackMode === "study" && state.locked[state.currentIndex];

  elements.quizMode.textContent = getQuizModeLabel();
  elements.questionCounter.textContent = `السؤال ${questionNumber} من ${totalQuestions}`;
  elements.questionCategory.textContent = question.topicName;
  elements.questionSubtopic.textContent = question.subtopicName;
  elements.questionNumberMark.textContent = String(questionNumber).padStart(2, "0");
  elements.questionText.textContent = question.question;
  elements.progressTrack.setAttribute("aria-valuenow", String(questionNumber));
  elements.progressValue.style.width = `${(questionNumber / totalQuestions) * 100}%`;

  if (question.imageUrl) {
    elements.questionImage.src = question.imageUrl;
    elements.questionImage.alt = `Question ${questionNumber} reference`;
    elements.questionImage.classList.remove("hidden");
  } else {
    elements.questionImage.removeAttribute("src");
    elements.questionImage.alt = "";
    elements.questionImage.classList.add("hidden");
  }

  elements.optionsList.replaceChildren();
  question.options.forEach((option, optionIndex) => {
    const wrap = document.createElement("div");
    wrap.className = "option-wrap";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "question-option";
    input.id = `option-${optionIndex}`;
    input.value = String(optionIndex);
    input.checked = savedAnswer === optionIndex;
    input.disabled = isStudyLocked;

    const label = document.createElement("label");
    label.className = "option";
    label.htmlFor = input.id;

    if (isStudyLocked && optionIndex === question.answer) {
      label.classList.add("correct-option");
    }
    if (
      isStudyLocked &&
      savedAnswer === optionIndex &&
      savedAnswer !== question.answer
    ) {
      label.classList.add("wrong-option");
    }

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = OPTION_LETTERS[optionIndex];

    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = option;

    label.append(letter, text);
    wrap.append(input, label);
    elements.optionsList.append(wrap);

    input.addEventListener("change", () => {
      if (state.settings.feedbackMode === "study" && state.locked[state.currentIndex]) {
        return;
      }
      state.answers[state.currentIndex] = optionIndex;
      if (state.settings.feedbackMode === "study") {
        state.locked[state.currentIndex] = true;
        renderQuestion();
      } else {
        updateAnswerStatus();
        renderQuestionNavigator();
      }
      saveDraft();
    });
  });

  renderStudyFeedback(question, savedAnswer);
  updateQuestionTools(question);
  elements.previousQuestion.disabled = state.currentIndex === 0;
  elements.nextQuestion.textContent =
    state.currentIndex === totalQuestions - 1 ? "إنهاء الامتحان" : "السؤال التالي";
  updateAnswerStatus();
  renderQuestionNavigator();
  updateTimer();
}

function updateAnswerStatus() {
  const hasAnswer = state.answers[state.currentIndex] !== null;
  const isFlagged = state.flags.has(state.questions[state.currentIndex]?.id);
  elements.answerStatus.textContent = hasAnswer
    ? isFlagged
      ? "تم حفظ الإجابة وتحديدها للمراجعة"
      : "تم حفظ إجابتك"
    : isFlagged
      ? "محدد للمراجعة — لم تُجب بعد"
      : "يمكنك الإجابة أو الانتقال للسؤال التالي";
  elements.answerStatus.classList.toggle("answered", hasAnswer);
}

function renderQuestionNavigator() {
  elements.questionNavigator.replaceChildren();
  let activeButton = null;
  state.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    button.className = "navigator-button";
    if (state.answers[index] !== null) button.classList.add("answered");
    if (state.flags.has(question.id)) button.classList.add("flagged");
    if (index === state.currentIndex) {
      button.classList.add("active");
      activeButton = button;
    }
    button.setAttribute("aria-label", `الانتقال إلى السؤال ${index + 1}`);
    button.addEventListener("click", () => {
      state.currentIndex = index;
      renderQuestion();
      scrollCurrentQuestionIntoView();
      saveDraft();
    });
    elements.questionNavigator.append(button);
  });

  if (activeButton) {
    requestAnimationFrame(() => {
      if (!activeButton.isConnected) return;
      const navigatorRect = elements.questionNavigator.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const scrollPadding = 8;

      if (buttonRect.top < navigatorRect.top) {
        elements.questionNavigator.scrollTop -=
          navigatorRect.top - buttonRect.top + scrollPadding;
      } else if (buttonRect.bottom > navigatorRect.bottom) {
        elements.questionNavigator.scrollTop +=
          buttonRect.bottom - navigatorRect.bottom + scrollPadding;
      }
    });
  }
}

function scrollCurrentQuestionIntoView() {
  const questionCard = elements.questionText.closest(".question-card");
  if (!questionCard) return;

  requestAnimationFrame(() => {
    const cardRect = questionCard.getBoundingClientRect();
    const actionBarSpace = 118;
    const isQuestionStartVisible =
      cardRect.top >= 12 && cardRect.top < window.innerHeight - actionBarSpace;

    if (isQuestionStartVisible) return;

    questionCard.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  });
}

function goToPreviousQuestion() {
  if (state.currentIndex === 0) return;
  state.currentIndex -= 1;
  renderQuestion();
  scrollCurrentQuestionIntoView();
  saveDraft();
}

function requestFinishExam(reason = "completed") {
  const unanswered = state.answers.filter((answer) => answer === null).length;
  if (
    unanswered > 0 &&
    !window.confirm(
      `باقي ${unanswered} سؤال بدون إجابة. متأكد إنك بدك تنهي الامتحان؟`,
    )
  ) {
    return;
  }
  submitExam(reason);
}

function goToNextQuestion() {
  if (state.currentIndex >= state.questions.length - 1) {
    requestFinishExam("completed");
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
  scrollCurrentQuestionIntoView();
  saveDraft();
}

function toggleFlag() {
  const question = state.questions[state.currentIndex];
  if (!question) return;
  if (state.flags.has(question.id)) state.flags.delete(question.id);
  else state.flags.add(question.id);
  updateQuestionTools(question);
  updateAnswerStatus();
  renderQuestionNavigator();
  saveDraft();
}

function toggleFavorite() {
  const question = state.questions[state.currentIndex];
  if (!question) return;
  const favorites = readIdSet(STORAGE_KEYS.favorites);
  if (favorites.has(question.id)) {
    favorites.delete(question.id);
    showToast("تمت إزالة السؤال من المفضلة");
  } else {
    favorites.add(question.id);
    showToast("تم حفظ السؤال في المفضلة");
  }
  writeIdSet(STORAGE_KEYS.favorites, favorites);
  updateQuestionTools(question);
  updateHomeStats();
}

function updateMistakeBank() {
  const mistakeIds = readIdSet(STORAGE_KEYS.mistakes);
  state.questions.forEach((question, index) => {
    if (state.answers[index] === question.answer) mistakeIds.delete(question.id);
    else mistakeIds.add(question.id);
  });
  writeIdSet(STORAGE_KEYS.mistakes, mistakeIds);
}

function createReviewCard(question, answerIndex, questionIndex) {
  const isCorrect = answerIndex === question.answer;
  const card = document.createElement("article");
  card.className = `review-card${isCorrect ? "" : " wrong"}`;

  const number = document.createElement("span");
  number.className = "review-number";
  const flagLabel = state.flags.has(question.id) ? " • Flagged" : "";
  number.textContent = `Question ${questionIndex + 1} • ${question.topicName} • ${
    isCorrect ? "Correct" : "Needs review"
  }${flagLabel}`;

  const title = document.createElement("h3");
  title.dir = "ltr";
  title.textContent = question.question;

  const yourAnswer = document.createElement("div");
  yourAnswer.className = "review-answer";
  const yourLabel = document.createElement("span");
  yourLabel.textContent = "Your answer";
  const yourValue = document.createElement("strong");
  yourValue.textContent =
    answerIndex === null ? "Not answered" : question.options[answerIndex];
  yourAnswer.append(yourLabel, yourValue);

  const correctAnswer = document.createElement("div");
  correctAnswer.className = "review-answer";
  const correctLabel = document.createElement("span");
  correctLabel.textContent = "Correct answer";
  const correctValue = document.createElement("strong");
  correctValue.textContent = question.options[question.answer];
  correctAnswer.append(correctLabel, correctValue);

  const explanation = document.createElement("p");
  explanation.className = "review-explanation";
  explanation.textContent =
    question.explanation || "No explanation has been added for this question yet.";

  card.append(number, title, yourAnswer, correctAnswer, explanation);
  return card;
}

function renderTopicBreakdown() {
  const topics = new Map();
  state.questions.forEach((question, index) => {
    if (!topics.has(question.topicName)) {
      topics.set(question.topicName, { total: 0, correct: 0 });
    }
    const stats = topics.get(question.topicName);
    stats.total += 1;
    stats.correct += Number(state.answers[index] === question.answer);
  });

  elements.topicBreakdown.replaceChildren();
  [...topics.entries()]
    .sort(([first], [second]) => first.localeCompare(second, "en"))
    .forEach(([topicName, stats]) => {
      const percent = Math.round((stats.correct / stats.total) * 100);
      const card = document.createElement("article");
      card.className = "topic-result-card";

      const top = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = topicName;
      const score = document.createElement("span");
      score.textContent = `${stats.correct} / ${stats.total} — ${percent}%`;
      top.append(name, score);

      const track = document.createElement("div");
      track.className = "topic-result-track";
      const value = document.createElement("span");
      value.style.width = `${percent}%`;
      track.append(value);
      card.append(top, track);
      elements.topicBreakdown.append(card);
    });
}

function renderResults(reason) {
  const correct = state.questions.reduce(
    (total, question, index) =>
      total + Number(state.answers[index] === question.answer),
    0,
  );
  const total = state.questions.length;
  const wrong = total - correct;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  elements.resultLabel.textContent =
    reason === "time"
      ? "انتهى الوقت"
      : state.source === "mistakes"
        ? "اكتمل تدريب الأخطاء"
        : state.source === "favorites"
          ? "اكتمل تدريب المفضلة"
          : "اكتملت المحاولة";
  elements.resultPercent.textContent = `${percent}%`;
  elements.resultFraction.textContent = `${correct} / ${total}`;
  elements.correctCount.textContent = String(correct);
  elements.wrongCount.textContent = String(wrong);

  if (percent >= 90) {
    elements.resultMessage.textContent = "نتيجة قوية جدًا. راجع التفاصيل وثبّت آخر النقاط.";
  } else if (percent >= 70) {
    elements.resultMessage.textContent = "شغل مرتب. راجع الأخطاء وارجع اختبر حالك مرة ثانية.";
  } else {
    elements.resultMessage.textContent = "هاي المحاولة للتشخيص؛ راجع الأخطاء وخلّينا نرفع العلامة.";
  }

  const circumference = 364.42;
  elements.resultRingValue.style.strokeDashoffset = String(
    circumference * (1 - percent / 100),
  );
  renderTopicBreakdown();
  elements.reviewList.replaceChildren(
    ...state.questions.map((question, index) =>
      createReviewCard(question, state.answers[index], index),
    ),
  );
  elements.reviewList.classList.remove("hidden");
  elements.toggleReview.textContent = "إخفاء المراجعة";

  writeNumber(STORAGE_KEYS.lastScore, percent);
  const currentBest = readNumber(STORAGE_KEYS.bestScore, -1);
  if (percent > currentBest) writeNumber(STORAGE_KEYS.bestScore, percent);
  updateMistakeBank();
  updateHomeStats();
}

function submitExam(reason) {
  if (state.finished) return;
  state.finished = true;
  stopTimer();
  discardDraft(false);
  renderResults(reason);
  showScreen("result-screen");
}

function goHome() {
  stopTimer();
  state.finished = true;
  updateHomeStats();
  updateResumeBanner();
  showScreen("home-screen");
}

function toggleReview() {
  const hidden = elements.reviewList.classList.toggle("hidden");
  elements.toggleReview.textContent = hidden ? "عرض المراجعة" : "إخفاء المراجعة";
}

function updateTimerSettingFields() {
  const timerMode =
    elements.examSettings.querySelector('input[name="timer-mode"]:checked')?.value ??
    "total";
  elements.totalTimeField.classList.toggle("hidden", timerMode !== "total");
  elements.questionTimeField.classList.toggle("hidden", timerMode !== "question");
}

function selectAllTopics(checked) {
  elements.topicOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = checked;
    input.indeterminate = false;
  });
  updateAvailableCount();
}

function handleKeyboard(event) {
  if (!document.querySelector("#quiz-screen").classList.contains("active")) return;
  if (state.settings.feedbackMode === "study" && state.locked[state.currentIndex]) {
    if (event.key === "Enter") goToNextQuestion();
    return;
  }

  const normalizedKey = event.key.toUpperCase();
  const optionIndex = OPTION_LETTERS.indexOf(normalizedKey);
  if (optionIndex >= 0) document.querySelector(`#option-${optionIndex}`)?.click();

  if (event.key === "Enter") {
    event.preventDefault();
    goToNextQuestion();
  }
  if (event.key === "ArrowLeft") goToNextQuestion();
  if (event.key === "ArrowRight") goToPreviousQuestion();
}

async function loadQuestions() {
  elements.startExam.disabled = true;
  elements.practiceMistakes.disabled = true;
  elements.practiceFavorites.disabled = true;

  let questions = [];
  try {
    state.db = createDatabaseClient();
    questions = await loadQuestionsFromDatabase();
    if (questions.length > 0) state.dataSource = "supabase";
  } catch (error) {
    console.warn("Supabase question bank is not available:", error);
  }

  if (questions.length === 0) {
    try {
      questions = await loadFallbackQuestions();
      state.dataSource = "fallback";
    } catch (error) {
      console.error("VetMaster could not load a question bank:", error);
      showScreen("error-screen");
      return;
    }
  }

  state.allQuestions = questions;
  cleanStoredQuestionIds();
  elements.startExam.disabled = questions.length === 0;
  elements.bankStatus.innerHTML = "";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  elements.bankStatus.append(
    dot,
    document.createTextNode(
      state.dataSource === "supabase"
        ? `${questions.length} سؤال • البنك متصل`
        : `${questions.length} أسئلة • بنك تجريبي`,
    ),
  );
  updateHomeStats();
  updateResumeBanner();
}

elements.startExam.addEventListener("click", () => openSetup("all"));
elements.practiceMistakes.addEventListener("click", () => openSetup("mistakes"));
elements.practiceFavorites.addEventListener("click", () => openSetup("favorites"));
elements.resumeExam.addEventListener("click", resumeSavedExam);
elements.discardExam.addEventListener("click", () => discardDraft(true));
elements.cancelSetup.addEventListener("click", () => showScreen("home-screen"));
elements.launchExam.addEventListener("click", launchExam);
elements.examSettings.addEventListener("submit", (event) => {
  event.preventDefault();
  launchExam();
});
elements.selectAllTopics.addEventListener("click", () => selectAllTopics(true));
elements.clearAllTopics.addEventListener("click", () => selectAllTopics(false));
elements.examSettings.addEventListener("change", (event) => {
  if (event.target.name === "timer-mode") updateTimerSettingFields();
  updateAvailableCount();
});
elements.previousQuestion.addEventListener("click", goToPreviousQuestion);
elements.nextQuestion.addEventListener("click", goToNextQuestion);
elements.finishExam.addEventListener("click", () => requestFinishExam("completed"));
elements.favoriteQuestion.addEventListener("click", toggleFavorite);
elements.flagQuestion.addEventListener("click", toggleFlag);
elements.newExam.addEventListener("click", () => openSetup("all"));
elements.goHome.addEventListener("click", goHome);
elements.toggleReview.addEventListener("click", toggleReview);
elements.brandHome.addEventListener("click", (event) => {
  event.preventDefault();
  if (
    document.querySelector("#quiz-screen").classList.contains("active") &&
    !state.finished
  ) {
    saveDraft();
    stopTimer();
    state.finished = true;
    showToast("المحاولة محفوظة؛ تقدر تكملها من الرئيسية");
    showScreen("home-screen");
    updateResumeBanner();
    return;
  }
  goHome();
});
document.addEventListener("keydown", handleKeyboard);
window.addEventListener("beforeunload", saveDraft);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveDraft();
});

updateHomeStats();
updateTimerSettingFields();
updateResumeBanner();
loadQuestions();
