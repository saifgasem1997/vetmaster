"use strict";

const STORAGE_KEYS = {
  bestScore: "vetmaster.bestScore",
  lastScore: "vetmaster.lastScore",
  mistakes: "vetmaster.mistakes",
};

const EXAM_DURATION_SECONDS = 15 * 60;
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

const state = {
  allQuestions: [],
  questions: [],
  answers: [],
  currentIndex: 0,
  secondsRemaining: EXAM_DURATION_SECONDS,
  timerId: null,
  mode: "all",
  finished: false,
};

const elements = {
  screens: [...document.querySelectorAll(".screen")],
  startExam: document.querySelector("#start-exam"),
  practiceMistakes: document.querySelector("#practice-mistakes"),
  mistakesBadge: document.querySelector("#mistakes-badge"),
  mistakeCount: document.querySelector("#mistake-count"),
  bestScore: document.querySelector("#best-score"),
  bestScoreRing: document.querySelector("#best-score-ring"),
  lastScore: document.querySelector("#last-score"),
  quizMode: document.querySelector("#quiz-mode"),
  questionCounter: document.querySelector("#question-counter"),
  questionCategory: document.querySelector("#question-category"),
  questionNumberMark: document.querySelector("#question-number-mark"),
  questionText: document.querySelector("#question-text"),
  optionsList: document.querySelector("#options-list"),
  progressTrack: document.querySelector(".progress-track"),
  progressValue: document.querySelector("#progress-value"),
  timer: document.querySelector("#timer"),
  timerValue: document.querySelector("#timer-value"),
  previousQuestion: document.querySelector("#previous-question"),
  nextQuestion: document.querySelector("#next-question"),
  answerStatus: document.querySelector("#answer-status"),
  resultLabel: document.querySelector("#result-label"),
  resultMessage: document.querySelector("#result-message"),
  resultPercent: document.querySelector("#result-percent"),
  resultFraction: document.querySelector("#result-fraction"),
  resultRingValue: document.querySelector("#result-ring-value"),
  correctCount: document.querySelector("#correct-count"),
  wrongCount: document.querySelector("#wrong-count"),
  reviewList: document.querySelector("#review-list"),
  toggleReview: document.querySelector("#toggle-review"),
  newExam: document.querySelector("#new-exam"),
  goHome: document.querySelector("#go-home"),
  brandHome: document.querySelector("#brand-home"),
  toast: document.querySelector("#toast"),
};

let toastTimer = null;

function readNumber(key, fallback = 0) {
  try {
    const value = Number.parseInt(localStorage.getItem(key) ?? "", 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The exam still works when browser storage is unavailable.
  }
}

function readMistakes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.mistakes) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeMistakes(ids) {
  try {
    localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify([...ids]));
  } catch {
    // The exam still works when browser storage is unavailable.
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
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
  }, 2600);
}

function updateHomeStats() {
  const best = readNumber(STORAGE_KEYS.bestScore, -1);
  const last = readNumber(STORAGE_KEYS.lastScore, -1);
  const mistakeIds = readMistakes();

  elements.bestScore.textContent = best >= 0 ? `${best}%` : "—";
  elements.lastScore.textContent = last >= 0 ? `${last}%` : "—";
  elements.mistakeCount.textContent = String(mistakeIds.length);
  elements.mistakesBadge.textContent = String(mistakeIds.length);
  elements.practiceMistakes.disabled = mistakeIds.length === 0;
  elements.practiceMistakes.title =
    mistakeIds.length === 0 ? "لا توجد أسئلة خاطئة محفوظة بعد" : "";

  const circumference = 314.16;
  const progress = best >= 0 ? best / 100 : 0;
  elements.bestScoreRing.style.strokeDashoffset = String(circumference * (1 - progress));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimer() {
  elements.timerValue.textContent = formatTime(state.secondsRemaining);
  elements.timer.classList.toggle("warning", state.secondsRemaining <= 60);
}

function stopTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  state.secondsRemaining = EXAM_DURATION_SECONDS;
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.secondsRemaining -= 1;
    updateTimer();
    if (state.secondsRemaining <= 0) {
      submitExam("time");
    }
  }, 1000);
}

function startExam(mode = "all") {
  let sourceQuestions = state.allQuestions;

  if (mode === "mistakes") {
    const mistakeIds = new Set(readMistakes());
    sourceQuestions = state.allQuestions.filter((question) => mistakeIds.has(question.id));
    if (sourceQuestions.length === 0) {
      showToast("ما عندك أسئلة خاطئة محفوظة حاليًا 👌");
      updateHomeStats();
      return;
    }
  }

  state.mode = mode;
  state.questions = shuffle(sourceQuestions);
  state.answers = Array(state.questions.length).fill(null);
  state.currentIndex = 0;
  state.finished = false;

  elements.quizMode.textContent =
    mode === "mistakes" ? "تدريب على الأخطاء" : "امتحان تجريبي";
  elements.progressTrack.setAttribute("aria-valuemax", String(state.questions.length));

  showScreen("quiz-screen");
  renderQuestion();
  startTimer();
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const questionNumber = state.currentIndex + 1;
  const totalQuestions = state.questions.length;
  const savedAnswer = state.answers[state.currentIndex];

  elements.questionCounter.textContent = `السؤال ${questionNumber} من ${totalQuestions}`;
  elements.questionCategory.textContent = question.category;
  elements.questionNumberMark.textContent = String(questionNumber).padStart(2, "0");
  elements.questionText.textContent = question.question;
  elements.progressTrack.setAttribute("aria-valuenow", String(questionNumber));
  elements.progressValue.style.width = `${(questionNumber / totalQuestions) * 100}%`;

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

    const label = document.createElement("label");
    label.className = "option";
    label.htmlFor = input.id;

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
      state.answers[state.currentIndex] = optionIndex;
      updateAnswerStatus();
    });
  });

  elements.previousQuestion.disabled = state.currentIndex === 0;
  elements.nextQuestion.textContent =
    state.currentIndex === totalQuestions - 1 ? "إنهاء الامتحان" : "السؤال التالي";
  updateAnswerStatus();
}

function updateAnswerStatus() {
  const hasAnswer = state.answers[state.currentIndex] !== null;
  elements.answerStatus.textContent = hasAnswer ? "تم حفظ إجابتك" : "اختر إجابة للمتابعة";
  elements.answerStatus.classList.toggle("answered", hasAnswer);
}

function goToPreviousQuestion() {
  if (state.currentIndex === 0) return;
  state.currentIndex -= 1;
  renderQuestion();
}

function goToNextQuestion() {
  if (state.answers[state.currentIndex] === null) {
    showToast("اختَر إجابة أولًا يا دكتور");
    return;
  }

  if (state.currentIndex === state.questions.length - 1) {
    submitExam("completed");
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
}

function updateMistakeBank() {
  const mistakeIds = new Set(readMistakes());

  state.questions.forEach((question, index) => {
    const isCorrect = state.answers[index] === question.answer;
    if (isCorrect) {
      mistakeIds.delete(question.id);
    } else {
      mistakeIds.add(question.id);
    }
  });

  writeMistakes(mistakeIds);
}

function createReviewCard(question, answerIndex, questionIndex) {
  const isCorrect = answerIndex === question.answer;
  const card = document.createElement("article");
  card.className = `review-card${isCorrect ? "" : " wrong"}`;

  const number = document.createElement("span");
  number.className = "review-number";
  number.textContent = `Question ${questionIndex + 1} • ${isCorrect ? "Correct" : "Needs review"}`;

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
  explanation.textContent = question.explanation;

  card.append(number, title, yourAnswer, correctAnswer, explanation);
  return card;
}

function renderResults(reason) {
  const correct = state.questions.reduce((total, question, index) => {
    return total + Number(state.answers[index] === question.answer);
  }, 0);
  const total = state.questions.length;
  const wrong = total - correct;
  const percent = Math.round((correct / total) * 100);

  elements.resultLabel.textContent =
    reason === "time" ? "انتهى الوقت" : state.mode === "mistakes" ? "اكتمل التدريب" : "اكتملت المحاولة";
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

  elements.reviewList.replaceChildren(
    ...state.questions.map((question, index) =>
      createReviewCard(question, state.answers[index], index),
    ),
  );
  elements.reviewList.classList.remove("hidden");
  elements.toggleReview.textContent = "إخفاء المراجعة";

  writeStorage(STORAGE_KEYS.lastScore, percent);
  const currentBest = readNumber(STORAGE_KEYS.bestScore, -1);
  if (percent > currentBest) {
    writeStorage(STORAGE_KEYS.bestScore, percent);
  }
  updateMistakeBank();
}

function submitExam(reason) {
  if (state.finished) return;
  state.finished = true;
  stopTimer();
  renderResults(reason);
  showScreen("result-screen");
}

function goHome() {
  stopTimer();
  state.finished = true;
  updateHomeStats();
  showScreen("home-screen");
}

function toggleReview() {
  const hidden = elements.reviewList.classList.toggle("hidden");
  elements.toggleReview.textContent = hidden ? "عرض المراجعة" : "إخفاء المراجعة";
}

function handleKeyboard(event) {
  if (!document.querySelector("#quiz-screen").classList.contains("active")) return;

  const normalizedKey = event.key.toUpperCase();
  const optionIndex = OPTION_LETTERS.indexOf(normalizedKey);
  if (optionIndex >= 0 && optionIndex < state.questions[state.currentIndex].options.length) {
    const input = document.querySelector(`#option-${optionIndex}`);
    input?.click();
  }

  if (event.key === "Enter") {
    event.preventDefault();
    goToNextQuestion();
  }
}

async function loadQuestions() {
  elements.startExam.disabled = true;
  elements.practiceMistakes.disabled = true;

  try {
    const response = await fetch("questions.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const questions = await response.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Question bank is empty");
    }

    const validQuestions = questions.every(
      (question) =>
        typeof question.id === "string" &&
        typeof question.question === "string" &&
        Array.isArray(question.options) &&
        Number.isInteger(question.answer) &&
        question.answer >= 0 &&
        question.answer < question.options.length,
    );
    if (!validQuestions) throw new Error("Question bank format is invalid");

    state.allQuestions = questions;
    elements.startExam.disabled = false;
    updateHomeStats();
  } catch (error) {
    console.error("VetMaster could not load the question bank:", error);
    showScreen("error-screen");
  }
}

elements.startExam.addEventListener("click", () => startExam("all"));
elements.practiceMistakes.addEventListener("click", () => startExam("mistakes"));
elements.previousQuestion.addEventListener("click", goToPreviousQuestion);
elements.nextQuestion.addEventListener("click", goToNextQuestion);
elements.newExam.addEventListener("click", () => startExam("all"));
elements.goHome.addEventListener("click", goHome);
elements.toggleReview.addEventListener("click", toggleReview);
elements.brandHome.addEventListener("click", (event) => {
  event.preventDefault();
  if (document.querySelector("#quiz-screen").classList.contains("active")) {
    showToast("كمّل الامتحان أولًا حتى تنحفظ نتيجتك");
    return;
  }
  goHome();
});
document.addEventListener("keydown", handleKeyboard);
window.addEventListener("beforeunload", (event) => {
  if (!state.finished && document.querySelector("#quiz-screen").classList.contains("active")) {
    event.preventDefault();
  }
});

updateHomeStats();
loadQuestions();
