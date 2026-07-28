"use strict";

const adminState = {
  db: null,
  session: null,
  topics: [],
  subtopics: [],
  questions: [],
  loading: false,
  moveFile: {
    matches: [],
    totalFileQuestions: 0,
    unmatchedCount: 0,
    ambiguousCount: 0,
    duplicateFileCount: 0,
  },
};

const adminElements = {
  loginView: document.querySelector("#login-view"),
  dashboardView: document.querySelector("#dashboard-view"),
  errorView: document.querySelector("#admin-error-view"),
  errorMessage: document.querySelector("#admin-error-message"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  loginButton: document.querySelector("#login-button"),
  loginError: document.querySelector("#login-error"),
  adminEmail: document.querySelector("#admin-email"),
  signOut: document.querySelector("#sign-out"),
  questionsStat: document.querySelector("#questions-stat"),
  activeQuestionsStat: document.querySelector("#active-questions-stat"),
  topicsStat: document.querySelector("#topics-stat"),
  subtopicsStat: document.querySelector("#subtopics-stat"),
  tabs: [...document.querySelectorAll(".admin-tab")],
  tabPanels: [...document.querySelectorAll(".admin-tab-panel")],
  newQuestion: document.querySelector("#new-question"),
  importQuestions: document.querySelector("#import-questions"),
  importFile: document.querySelector("#import-file"),
  moveQuestionFile: document.querySelector("#move-question-file"),
  moveQuestionsDialog: document.querySelector("#move-questions-dialog"),
  moveQuestionsForm: document.querySelector("#move-questions-form"),
  moveQuestionsFile: document.querySelector("#move-questions-file"),
  moveFileSummary: document.querySelector("#move-file-summary"),
  moveMatchedCount: document.querySelector("#move-matched-count"),
  moveUnmatchedCount: document.querySelector("#move-unmatched-count"),
  moveAmbiguousCount: document.querySelector("#move-ambiguous-count"),
  moveDestinationTopic: document.querySelector("#move-destination-topic"),
  moveNewTopicField: document.querySelector("#move-new-topic-field"),
  moveNewTopicName: document.querySelector("#move-new-topic-name"),
  moveQuestionsError: document.querySelector("#move-questions-error"),
  closeMoveQuestions: document.querySelector("#close-move-questions"),
  cancelMoveQuestions: document.querySelector("#cancel-move-questions"),
  confirmMoveQuestions: document.querySelector("#confirm-move-questions"),
  exportQuestions: document.querySelector("#export-questions"),
  refreshData: document.querySelector("#refresh-data"),
  questionFormPanel: document.querySelector("#question-form-panel"),
  questionForm: document.querySelector("#question-form"),
  questionFormTitle: document.querySelector("#question-form-title"),
  questionFormError: document.querySelector("#question-form-error"),
  questionId: document.querySelector("#question-id"),
  questionTopic: document.querySelector("#question-topic"),
  questionSubtopic: document.querySelector("#question-subtopic"),
  questionText: document.querySelector("#question-text-input"),
  optionInputs: [...document.querySelectorAll(".option-input")],
  correctIndex: document.querySelector("#correct-index"),
  questionDifficulty: document.querySelector("#question-difficulty"),
  questionPriority: document.querySelector("#question-priority"),
  questionExplanation: document.querySelector("#question-explanation"),
  questionImageUrl: document.querySelector("#question-image-url"),
  questionSource: document.querySelector("#question-source"),
  questionActive: document.querySelector("#question-active"),
  saveQuestion: document.querySelector("#save-question"),
  resetQuestion: document.querySelector("#reset-question"),
  questionSearch: document.querySelector("#question-search"),
  filterTopic: document.querySelector("#filter-topic"),
  filterDifficulty: document.querySelector("#filter-difficulty"),
  filterStatus: document.querySelector("#filter-status"),
  questionListCount: document.querySelector("#question-list-count"),
  questionList: document.querySelector("#question-list"),
  topicForm: document.querySelector("#topic-form"),
  topicFormTitle: document.querySelector("#topic-form-title"),
  topicId: document.querySelector("#topic-id"),
  topicName: document.querySelector("#topic-name"),
  topicSlug: document.querySelector("#topic-slug"),
  topicDescription: document.querySelector("#topic-description"),
  topicOrder: document.querySelector("#topic-order"),
  topicActive: document.querySelector("#topic-active"),
  resetTopic: document.querySelector("#reset-topic"),
  topicList: document.querySelector("#topic-list"),
  subtopicForm: document.querySelector("#subtopic-form"),
  subtopicFormTitle: document.querySelector("#subtopic-form-title"),
  subtopicId: document.querySelector("#subtopic-id"),
  subtopicTopic: document.querySelector("#subtopic-topic"),
  subtopicName: document.querySelector("#subtopic-name"),
  subtopicSlug: document.querySelector("#subtopic-slug"),
  subtopicDescription: document.querySelector("#subtopic-description"),
  subtopicOrder: document.querySelector("#subtopic-order"),
  subtopicActive: document.querySelector("#subtopic-active"),
  resetSubtopic: document.querySelector("#reset-subtopic"),
  subtopicList: document.querySelector("#subtopic-list"),
  toast: document.querySelector("#admin-toast"),
};

let adminToastTimer = null;

function createAdminDatabaseClient() {
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

function showAdminToast(message) {
  clearTimeout(adminToastTimer);
  adminElements.toast.textContent = message;
  adminElements.toast.classList.add("show");
  adminToastTimer = window.setTimeout(() => {
    adminElements.toast.classList.remove("show");
  }, 2800);
}

function setFormError(element, message = "") {
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function showFatalError(message) {
  adminElements.loginView.classList.add("hidden");
  adminElements.dashboardView.classList.add("hidden");
  adminElements.errorMessage.textContent = message;
  adminElements.errorView.classList.remove("hidden");
}

function setSelectOptions(select, items, firstLabel, firstValue = "") {
  const previousValue = select.value;
  select.replaceChildren();

  const firstOption = document.createElement("option");
  firstOption.value = firstValue;
  firstOption.textContent = firstLabel;
  select.append(firstOption);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `${item.name}${item.is_active === false ? " — معطّل" : ""}`;
    select.append(option);
  });

  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function topicById(id) {
  return adminState.topics.find((topic) => String(topic.id) === String(id));
}

function subtopicById(id) {
  return adminState.subtopics.find(
    (subtopic) => String(subtopic.id) === String(id),
  );
}

function refreshSelects() {
  const sortedTopics = [...adminState.topics].sort(
    (first, second) =>
      Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
      first.name.localeCompare(second.name, "en"),
  );

  setSelectOptions(
    adminElements.questionTopic,
    sortedTopics,
    "اختر الموضوع",
    "",
  );
  setSelectOptions(
    adminElements.subtopicTopic,
    sortedTopics,
    "اختر الموضوع",
    "",
  );
  setSelectOptions(adminElements.filterTopic, sortedTopics, "كل المواضيع", "all");
  refreshMoveDestinationTopics(sortedTopics);
  refreshQuestionSubtopics();
}

function refreshMoveDestinationTopics(sortedTopics = adminState.topics) {
  const previousValue = adminElements.moveDestinationTopic.value;
  setSelectOptions(
    adminElements.moveDestinationTopic,
    sortedTopics,
    "اختر القسم الجديد",
    "",
  );

  const newTopicOption = document.createElement("option");
  newTopicOption.value = "__new__";
  newTopicOption.textContent = "+ إنشاء قسم جديد";
  adminElements.moveDestinationTopic.append(newTopicOption);

  if (
    [...adminElements.moveDestinationTopic.options].some(
      (option) => option.value === previousValue,
    )
  ) {
    adminElements.moveDestinationTopic.value = previousValue;
  }
}

function refreshQuestionSubtopics(selectedValue = null) {
  const topicId = adminElements.questionTopic.value;
  const matching = adminState.subtopics
    .filter((subtopic) => String(subtopic.topic_id) === String(topicId))
    .sort(
      (first, second) =>
        Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
        first.name.localeCompare(second.name, "en"),
    );
  setSelectOptions(
    adminElements.questionSubtopic,
    matching,
    "بدون مقطع محدد",
    "",
  );
  if (
    selectedValue != null &&
    matching.some((subtopic) => String(subtopic.id) === String(selectedValue))
  ) {
    adminElements.questionSubtopic.value = String(selectedValue);
  }
}

function updateAdminStats() {
  adminElements.questionsStat.textContent = String(adminState.questions.length);
  adminElements.activeQuestionsStat.textContent = `${
    adminState.questions.filter((question) => question.is_active).length
  } فعّالة`;
  adminElements.topicsStat.textContent = String(adminState.topics.length);
  adminElements.subtopicsStat.textContent = String(adminState.subtopics.length);
}

function getFilteredAdminQuestions() {
  const query = adminElements.questionSearch.value.trim().toLowerCase();
  const topicId = adminElements.filterTopic.value;
  const difficulty = adminElements.filterDifficulty.value;
  const status = adminElements.filterStatus.value;

  return adminState.questions.filter((question) => {
    const searchMatches =
      !query ||
      String(question.question_text).toLowerCase().includes(query) ||
      String(question.explanation ?? "").toLowerCase().includes(query);
    const topicMatches = topicId === "all" || String(question.topic_id) === topicId;
    const difficultyMatches =
      difficulty === "all" || question.difficulty === difficulty;
    const statusMatches =
      status === "all" ||
      (status === "active" && question.is_active) ||
      (status === "inactive" && !question.is_active);
    return searchMatches && topicMatches && difficultyMatches && statusMatches;
  });
}

function createMetaPill(text, className = "") {
  const pill = document.createElement("span");
  pill.textContent = text;
  if (className) pill.className = className;
  return pill;
}

function createMiniAction(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = `mini-action${className ? ` ${className}` : ""}`;
  button.addEventListener("click", handler);
  return button;
}

function renderQuestionList() {
  const questions = getFilteredAdminQuestions();
  adminElements.questionListCount.textContent = `${questions.length} سؤال`;
  adminElements.questionList.replaceChildren();

  if (questions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-admin-list";
    empty.textContent =
      adminState.questions.length === 0
        ? "بنك الأسئلة فارغ. أضف أول سؤال أو استورد ملف JSON."
        : "لا توجد نتائج مطابقة للفلاتر.";
    adminElements.questionList.append(empty);
    return;
  }

  questions.forEach((question) => {
    const topic = topicById(question.topic_id);
    const subtopic = subtopicById(question.subtopic_id);
    const card = document.createElement("article");
    card.className = `admin-question-card${question.is_active ? "" : " inactive"}`;

    const copy = document.createElement("div");
    copy.className = "admin-question-copy";

    const meta = document.createElement("div");
    meta.className = "admin-question-meta";
    meta.append(
      createMetaPill(topic?.name ?? "No topic"),
      createMetaPill(subtopic?.name ?? "General"),
      createMetaPill(question.difficulty ?? "medium"),
    );
    if (!question.is_active) {
      meta.append(createMetaPill("Inactive", "inactive-pill"));
    }

    const title = document.createElement("h3");
    title.textContent = question.question_text;
    const answer = document.createElement("p");
    const correctIndex = Number(question.correct_index);
    answer.textContent = `Answer: ${question.options?.[correctIndex] ?? "—"}`;
    copy.append(meta, title, answer);

    const actions = document.createElement("div");
    actions.className = "admin-question-actions";
    actions.append(
      createMiniAction("تعديل", () => editQuestion(question.id)),
      createMiniAction(question.is_active ? "تعطيل" : "تفعيل", () =>
        toggleQuestionStatus(question),
      ),
      createMiniAction("حذف", () => deleteQuestion(question), "danger"),
    );

    card.append(copy, actions);
    adminElements.questionList.append(card);
  });
}

function renderTaxonomyLists() {
  adminElements.topicList.replaceChildren();
  adminElements.subtopicList.replaceChildren();

  [...adminState.topics]
    .sort(
      (first, second) =>
        Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
        first.name.localeCompare(second.name, "en"),
    )
    .forEach((topic) => {
      const item = document.createElement("article");
      item.className = `taxonomy-item${topic.is_active ? "" : " inactive"}`;
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = topic.name;
      const details = document.createElement("small");
      const childrenCount = adminState.subtopics.filter(
        (subtopic) => String(subtopic.topic_id) === String(topic.id),
      ).length;
      details.textContent = `${topic.slug} • ${childrenCount} مقطع`;
      copy.append(name, details);

      const actions = document.createElement("div");
      actions.append(
        createMiniAction("تعديل", () => editTopic(topic.id)),
        createMiniAction(topic.is_active ? "تعطيل" : "تفعيل", () =>
          toggleTaxonomyStatus("topics", topic),
        ),
      );
      item.append(copy, actions);
      adminElements.topicList.append(item);
    });

  [...adminState.subtopics]
    .sort(
      (first, second) =>
        Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
        first.name.localeCompare(second.name, "en"),
    )
    .forEach((subtopic) => {
      const item = document.createElement("article");
      item.className = `taxonomy-item${subtopic.is_active ? "" : " inactive"}`;
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = subtopic.name;
      const details = document.createElement("small");
      details.textContent = `${topicById(subtopic.topic_id)?.name ?? "No topic"} • ${
        subtopic.slug
      }`;
      copy.append(name, details);

      const actions = document.createElement("div");
      actions.append(
        createMiniAction("تعديل", () => editSubtopic(subtopic.id)),
        createMiniAction(subtopic.is_active ? "تعطيل" : "تفعيل", () =>
          toggleTaxonomyStatus("subtopics", subtopic),
        ),
      );
      item.append(copy, actions);
      adminElements.subtopicList.append(item);
    });
}

async function loadAdminData({ notify = false } = {}) {
  if (adminState.loading) return;
  adminState.loading = true;
  adminElements.refreshData.disabled = true;

  try {
    const [topicsResult, subtopicsResult, questionsResult] = await Promise.all([
      adminState.db
        .from("topics")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      adminState.db
        .from("subtopics")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      adminState.db
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const error = topicsResult.error || subtopicsResult.error || questionsResult.error;
    if (error) throw error;

    adminState.topics = topicsResult.data ?? [];
    adminState.subtopics = subtopicsResult.data ?? [];
    adminState.questions = questionsResult.data ?? [];
    refreshSelects();
    updateAdminStats();
    renderQuestionList();
    renderTaxonomyLists();
    if (notify) showAdminToast("تم تحديث البيانات");
  } catch (error) {
    console.error("Could not load admin data:", error);
    showAdminToast("تعذّر تحميل البيانات. راجع سياسات Supabase.");
  } finally {
    adminState.loading = false;
    adminElements.refreshData.disabled = false;
  }
}

function resetQuestionForm() {
  adminElements.questionForm.reset();
  adminElements.questionId.value = "";
  adminElements.questionFormTitle.textContent = "إضافة سؤال جديد";
  adminElements.questionDifficulty.value = "medium";
  adminElements.questionPriority.value = "3";
  adminElements.questionActive.checked = true;
  refreshQuestionSubtopics();
  setFormError(adminElements.questionFormError);
}

function editQuestion(questionId) {
  const question = adminState.questions.find(
    (item) => String(item.id) === String(questionId),
  );
  if (!question) return;

  adminElements.questionId.value = question.id;
  adminElements.questionFormTitle.textContent = "تعديل السؤال";
  adminElements.questionTopic.value = String(question.topic_id ?? "");
  refreshQuestionSubtopics(question.subtopic_id);
  adminElements.questionText.value = question.question_text ?? "";
  adminElements.optionInputs.forEach((input, index) => {
    input.value = question.options?.[index] ?? "";
  });
  adminElements.correctIndex.value = String(question.correct_index ?? 0);
  adminElements.questionDifficulty.value = question.difficulty ?? "medium";
  adminElements.questionPriority.value = String(question.priority ?? 3);
  adminElements.questionExplanation.value = question.explanation ?? "";
  adminElements.questionImageUrl.value = question.image_url ?? "";
  adminElements.questionSource.value = question.source_note ?? "";
  adminElements.questionActive.checked = Boolean(question.is_active);
  setFormError(adminElements.questionFormError);
  adminElements.questionFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveQuestion(event) {
  event.preventDefault();
  setFormError(adminElements.questionFormError);

  const options = adminElements.optionInputs.map((input) => input.value.trim());
  if (options.some((option) => !option)) {
    setFormError(adminElements.questionFormError, "اكتب الخيارات الأربعة كاملة.");
    return;
  }
  if (new Set(options.map((option) => option.toLowerCase())).size !== 4) {
    setFormError(adminElements.questionFormError, "يجب أن تكون الخيارات الأربعة مختلفة.");
    return;
  }

  const payload = {
    topic_id: adminElements.questionTopic.value,
    subtopic_id: adminElements.questionSubtopic.value || null,
    question_text: adminElements.questionText.value.trim(),
    options,
    correct_index: Number(adminElements.correctIndex.value),
    explanation: adminElements.questionExplanation.value.trim(),
    difficulty: adminElements.questionDifficulty.value,
    priority: Number(adminElements.questionPriority.value),
    image_url: adminElements.questionImageUrl.value.trim() || null,
    source_note: adminElements.questionSource.value.trim() || null,
    is_active: adminElements.questionActive.checked,
  };

  if (!payload.topic_id || !payload.question_text) {
    setFormError(adminElements.questionFormError, "الموضوع ونص السؤال مطلوبان.");
    return;
  }

  adminElements.saveQuestion.disabled = true;
  adminElements.saveQuestion.textContent = "جاري الحفظ...";
  try {
    const id = adminElements.questionId.value;
    const result = id
      ? await adminState.db.from("questions").update(payload).eq("id", id)
      : await adminState.db.from("questions").insert({
          ...payload,
          created_by: adminState.session.user.id,
        });
    if (result.error) throw result.error;

    resetQuestionForm();
    await loadAdminData();
    showAdminToast(id ? "تم تعديل السؤال" : "تمت إضافة السؤال");
  } catch (error) {
    console.error("Could not save question:", error);
    setFormError(
      adminElements.questionFormError,
      `تعذّر حفظ السؤال: ${error.message ?? "خطأ غير معروف"}`,
    );
  } finally {
    adminElements.saveQuestion.disabled = false;
    adminElements.saveQuestion.textContent = "حفظ السؤال";
  }
}

async function toggleQuestionStatus(question) {
  const result = await adminState.db
    .from("questions")
    .update({ is_active: !question.is_active })
    .eq("id", question.id);
  if (result.error) {
    showAdminToast("تعذّر تغيير حالة السؤال");
    return;
  }
  await loadAdminData();
  showAdminToast(question.is_active ? "تم تعطيل السؤال" : "تم تفعيل السؤال");
}

async function deleteQuestion(question) {
  const confirmed = window.confirm(
    "سيتم حذف هذا السؤال نهائيًا من بنك الأسئلة. هل أنت متأكد؟",
  );
  if (!confirmed) return;

  const result = await adminState.db.from("questions").delete().eq("id", question.id);
  if (result.error) {
    showAdminToast("تعذّر حذف السؤال");
    return;
  }
  if (adminElements.questionId.value === String(question.id)) resetQuestionForm();
  await loadAdminData();
  showAdminToast("تم حذف السؤال");
}

function slugify(value, fallbackPrefix) {
  const slug = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  if (slug) return slug;

  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `${fallbackPrefix}-${hash.toString(36)}`;
}

function resetTopicForm() {
  adminElements.topicForm.reset();
  adminElements.topicId.value = "";
  adminElements.topicFormTitle.textContent = "إضافة موضوع";
  adminElements.topicOrder.value = "0";
  adminElements.topicActive.checked = true;
}

function editTopic(topicId) {
  const topic = topicById(topicId);
  if (!topic) return;
  adminElements.topicId.value = topic.id;
  adminElements.topicFormTitle.textContent = "تعديل الموضوع";
  adminElements.topicName.value = topic.name ?? "";
  adminElements.topicSlug.value = topic.slug ?? "";
  adminElements.topicDescription.value = topic.description ?? "";
  adminElements.topicOrder.value = String(topic.sort_order ?? 0);
  adminElements.topicActive.checked = Boolean(topic.is_active);
  adminElements.topicForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveTopic(event) {
  event.preventDefault();
  const name = adminElements.topicName.value.trim();
  const payload = {
    name,
    slug: slugify(adminElements.topicSlug.value.trim() || name, "topic"),
    description: adminElements.topicDescription.value.trim() || null,
    sort_order: Number(adminElements.topicOrder.value || 0),
    is_active: adminElements.topicActive.checked,
  };
  const id = adminElements.topicId.value;
  const result = id
    ? await adminState.db.from("topics").update(payload).eq("id", id)
    : await adminState.db.from("topics").insert(payload);

  if (result.error) {
    showAdminToast(`تعذّر حفظ الموضوع: ${result.error.message}`);
    return;
  }
  resetTopicForm();
  await loadAdminData();
  showAdminToast(id ? "تم تعديل الموضوع" : "تمت إضافة الموضوع");
}

function resetSubtopicForm() {
  adminElements.subtopicForm.reset();
  adminElements.subtopicId.value = "";
  adminElements.subtopicFormTitle.textContent = "إضافة مقطع";
  adminElements.subtopicOrder.value = "0";
  adminElements.subtopicActive.checked = true;
}

function editSubtopic(subtopicId) {
  const subtopic = subtopicById(subtopicId);
  if (!subtopic) return;
  adminElements.subtopicId.value = subtopic.id;
  adminElements.subtopicFormTitle.textContent = "تعديل المقطع";
  adminElements.subtopicTopic.value = String(subtopic.topic_id ?? "");
  adminElements.subtopicName.value = subtopic.name ?? "";
  adminElements.subtopicSlug.value = subtopic.slug ?? "";
  adminElements.subtopicDescription.value = subtopic.description ?? "";
  adminElements.subtopicOrder.value = String(subtopic.sort_order ?? 0);
  adminElements.subtopicActive.checked = Boolean(subtopic.is_active);
  adminElements.subtopicForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveSubtopic(event) {
  event.preventDefault();
  const name = adminElements.subtopicName.value.trim();
  const payload = {
    topic_id: adminElements.subtopicTopic.value,
    name,
    slug: slugify(adminElements.subtopicSlug.value.trim() || name, "section"),
    description: adminElements.subtopicDescription.value.trim() || null,
    sort_order: Number(adminElements.subtopicOrder.value || 0),
    is_active: adminElements.subtopicActive.checked,
  };
  const id = adminElements.subtopicId.value;
  const result = id
    ? await adminState.db.from("subtopics").update(payload).eq("id", id)
    : await adminState.db.from("subtopics").insert(payload);

  if (result.error) {
    showAdminToast(`تعذّر حفظ المقطع: ${result.error.message}`);
    return;
  }
  resetSubtopicForm();
  await loadAdminData();
  showAdminToast(id ? "تم تعديل المقطع" : "تمت إضافة المقطع");
}

async function toggleTaxonomyStatus(table, item) {
  const result = await adminState.db
    .from(table)
    .update({ is_active: !item.is_active })
    .eq("id", item.id);
  if (result.error) {
    showAdminToast("تعذّر تغيير الحالة");
    return;
  }
  await loadAdminData();
  showAdminToast(item.is_active ? "تم التعطيل" : "تم التفعيل");
}

function switchAdminTab(tabName) {
  adminElements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  adminElements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}-tab`);
  });
}

function exportQuestionBank() {
  const exportData = adminState.questions.map((question) => ({
    id: question.id,
    topic: topicById(question.topic_id)?.name ?? "",
    subtopic: subtopicById(question.subtopic_id)?.name ?? "",
    question: question.question_text,
    options: question.options,
    answer: question.correct_index,
    explanation: question.explanation ?? "",
    difficulty: question.difficulty,
    priority: question.priority,
    image_url: question.image_url,
    source_note: question.source_note,
    is_active: question.is_active,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vetmaster-questions-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showAdminToast("تم تجهيز ملف الأسئلة");
}

async function ensureImportTopic(name, topicCache) {
  const cacheKey = name.trim().toLowerCase();
  if (topicCache.has(cacheKey)) return topicCache.get(cacheKey);

  let slug = slugify(name, "topic");
  if (adminState.topics.some((topic) => topic.slug === slug)) {
    slug = `${slug}-${slugify(name, "t").slice(-5)}`;
  }
  const result = await adminState.db
    .from("topics")
    .insert({
      name,
      slug,
      sort_order: adminState.topics.length + topicCache.size,
      is_active: true,
    })
    .select()
    .single();
  if (result.error) throw result.error;
  topicCache.set(cacheKey, result.data);
  return result.data;
}

async function ensureImportSubtopic(name, topicId, subtopicCache) {
  const cacheKey = `${topicId}:${name.trim().toLowerCase()}`;
  if (subtopicCache.has(cacheKey)) return subtopicCache.get(cacheKey);

  let slug = slugify(name, "general");
  const hasConflict = adminState.subtopics.some(
    (subtopic) =>
      String(subtopic.topic_id) === String(topicId) && subtopic.slug === slug,
  );
  if (hasConflict) slug = `${slug}-${slugify(name, "s").slice(-5)}`;

  const result = await adminState.db
    .from("subtopics")
    .insert({
      topic_id: topicId,
      name,
      slug,
      sort_order: adminState.subtopics.length + subtopicCache.size,
      is_active: true,
    })
    .select()
    .single();
  if (result.error) throw result.error;
  subtopicCache.set(cacheKey, result.data);
  return result.data;
}

function emptyMoveFileState() {
  return {
    matches: [],
    totalFileQuestions: 0,
    unmatchedCount: 0,
    ambiguousCount: 0,
    duplicateFileCount: 0,
  };
}

function updateMoveButtonState() {
  if (adminElements.confirmMoveQuestions.dataset.busy === "true") return;
  const destinationValue = adminElements.moveDestinationTopic.value;
  const destinationReady =
    Boolean(destinationValue) &&
    (destinationValue !== "__new__" ||
      Boolean(adminElements.moveNewTopicName.value.trim()));
  adminElements.confirmMoveQuestions.disabled =
    adminState.moveFile.matches.length === 0 || !destinationReady;
}

function handleMoveDestinationChange() {
  const createsTopic = adminElements.moveDestinationTopic.value === "__new__";
  adminElements.moveNewTopicField.classList.toggle("hidden", !createsTopic);
  adminElements.moveNewTopicName.required = createsTopic;
  if (!createsTopic) adminElements.moveNewTopicName.value = "";
  updateMoveButtonState();
}

function resetMoveQuestionsForm() {
  adminElements.moveQuestionsForm.reset();
  adminState.moveFile = emptyMoveFileState();
  adminElements.moveFileSummary.classList.add("hidden");
  adminElements.moveMatchedCount.textContent = "0";
  adminElements.moveUnmatchedCount.textContent = "0";
  adminElements.moveAmbiguousCount.textContent = "0";
  adminElements.moveNewTopicField.classList.add("hidden");
  adminElements.moveNewTopicName.required = false;
  adminElements.confirmMoveQuestions.dataset.busy = "false";
  adminElements.confirmMoveQuestions.textContent = "نقل الأسئلة";
  setFormError(adminElements.moveQuestionsError);
  updateMoveButtonState();
}

function openMoveQuestionsDialog() {
  refreshMoveDestinationTopics(
    [...adminState.topics].sort(
      (first, second) =>
        Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
        first.name.localeCompare(second.name, "en"),
    ),
  );
  resetMoveQuestionsForm();
  if (typeof adminElements.moveQuestionsDialog.showModal === "function") {
    adminElements.moveQuestionsDialog.showModal();
  } else {
    adminElements.moveQuestionsDialog.setAttribute("open", "");
  }
}

function closeMoveQuestionsDialog() {
  if (adminElements.confirmMoveQuestions.dataset.busy === "true") return;
  if (typeof adminElements.moveQuestionsDialog.close === "function") {
    adminElements.moveQuestionsDialog.close();
  } else {
    adminElements.moveQuestionsDialog.removeAttribute("open");
  }
  resetMoveQuestionsForm();
}

async function inspectMoveQuestionsFile() {
  const [file] = adminElements.moveQuestionsFile.files;
  adminState.moveFile = emptyMoveFileState();
  adminElements.moveFileSummary.classList.add("hidden");
  setFormError(adminElements.moveQuestionsError);
  updateMoveButtonState();
  if (!file) return;

  try {
    if (
      !window.VetMasterImport?.parseQuestionFile ||
      !window.VetMasterMove?.matchFileQuestions
    ) {
      throw new Error("أداة قراءة الملف غير متاحة. أعد تحميل الصفحة.");
    }

    const parsed = await window.VetMasterImport.parseQuestionFile(file, window.XLSX);
    if (!parsed.length) throw new Error("الملف لا يحتوي أسئلة.");

    adminState.moveFile = window.VetMasterMove.matchFileQuestions(
      parsed,
      adminState.questions,
    );
    adminElements.moveMatchedCount.textContent = String(
      adminState.moveFile.matches.length,
    );
    adminElements.moveUnmatchedCount.textContent = String(
      adminState.moveFile.unmatchedCount,
    );
    adminElements.moveAmbiguousCount.textContent = String(
      adminState.moveFile.ambiguousCount +
        adminState.moveFile.duplicateFileCount,
    );
    adminElements.moveFileSummary.classList.remove("hidden");

    if (adminState.moveFile.matches.length === 0) {
      setFormError(
        adminElements.moveQuestionsError,
        "لم يتم العثور على أي سؤال من هذا الملف داخل بنك الأسئلة.",
      );
    }
  } catch (error) {
    console.error("Could not inspect move file:", error);
    adminState.moveFile = emptyMoveFileState();
    setFormError(
      adminElements.moveQuestionsError,
      `تعذّرت قراءة الملف: ${error.message ?? "ملف غير صالح"}`,
    );
  } finally {
    updateMoveButtonState();
  }
}

function chunkItems(items, chunkSize = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function updateMovedQuestionChunk(questions, payload) {
  const result = await adminState.db
    .from("questions")
    .update(payload)
    .in(
      "id",
      questions.map((question) => question.id),
    );
  if (result.error) throw result.error;
}

async function rollbackMovedQuestions(questions) {
  const originalGroups = new Map();
  questions.forEach((question) => {
    const key = `${question.topic_id}:${question.subtopic_id ?? ""}`;
    const group = originalGroups.get(key) ?? {
      topicId: question.topic_id,
      subtopicId: question.subtopic_id ?? null,
      questions: [],
    };
    group.questions.push(question);
    originalGroups.set(key, group);
  });

  try {
    for (const group of originalGroups.values()) {
      for (const chunk of chunkItems(group.questions)) {
        await updateMovedQuestionChunk(chunk, {
          topic_id: group.topicId,
          subtopic_id: group.subtopicId,
        });
      }
    }
    return true;
  } catch (error) {
    console.error("Could not roll back moved questions:", error);
    return false;
  }
}

function moveFileSubtopicName(fileQuestion) {
  return String(
    fileQuestion?.subtopic_name ??
      fileQuestion?.subtopic ??
      fileQuestion?.disease ??
      "",
  ).trim();
}

function setMoveQuestionsBusy(isBusy) {
  adminElements.confirmMoveQuestions.dataset.busy = String(isBusy);
  adminElements.moveQuestionsFile.disabled = isBusy;
  adminElements.moveDestinationTopic.disabled = isBusy;
  adminElements.moveNewTopicName.disabled = isBusy;
  adminElements.closeMoveQuestions.disabled = isBusy;
  adminElements.cancelMoveQuestions.disabled = isBusy;
  adminElements.confirmMoveQuestions.textContent = isBusy
    ? "جاري النقل..."
    : "نقل الأسئلة";
  if (isBusy) {
    adminElements.confirmMoveQuestions.disabled = true;
  } else {
    updateMoveButtonState();
  }
}

async function moveQuestionsFromFile(event) {
  event.preventDefault();
  setFormError(adminElements.moveQuestionsError);

  const matches = adminState.moveFile.matches;
  const destinationValue = adminElements.moveDestinationTopic.value;
  const selectedTopic =
    destinationValue === "__new__" ? null : topicById(destinationValue);
  const destinationName =
    destinationValue === "__new__"
      ? adminElements.moveNewTopicName.value.trim()
      : selectedTopic?.name ?? "";

  if (!matches.length || !destinationName) {
    setFormError(
      adminElements.moveQuestionsError,
      "اختر الملف والقسم الجديد قبل النقل.",
    );
    return;
  }

  const confirmed = window.confirm(
    `سيتم نقل ${matches.length} سؤال إلى قسم "${destinationName}". هل تريد المتابعة؟`,
  );
  if (!confirmed) return;

  setMoveQuestionsBusy(true);
  const movedQuestions = [];

  try {
    const topicCache = new Map(
      adminState.topics.map((topic) => [topic.name.trim().toLowerCase(), topic]),
    );
    const destinationTopic =
      selectedTopic ?? (await ensureImportTopic(destinationName, topicCache));
    const subtopicCache = new Map(
      adminState.subtopics.map((subtopic) => [
        `${subtopic.topic_id}:${subtopic.name.trim().toLowerCase()}`,
        subtopic,
      ]),
    );
    const destinationGroups = new Map();

    for (const match of matches) {
      const currentSubtopic = subtopicById(match.question.subtopic_id);
      const subtopicName =
        currentSubtopic?.name ?? moveFileSubtopicName(match.fileQuestion);
      let destinationSubtopicId = null;

      if (subtopicName) {
        const destinationSubtopic = await ensureImportSubtopic(
          subtopicName,
          destinationTopic.id,
          subtopicCache,
        );
        destinationSubtopicId = destinationSubtopic.id;
      }

      const groupKey = destinationSubtopicId ?? "__none__";
      const group = destinationGroups.get(groupKey) ?? {
        subtopicId: destinationSubtopicId,
        questions: [],
      };
      group.questions.push(match.question);
      destinationGroups.set(groupKey, group);
    }

    for (const group of destinationGroups.values()) {
      for (const chunk of chunkItems(group.questions)) {
        await updateMovedQuestionChunk(chunk, {
          topic_id: destinationTopic.id,
          subtopic_id: group.subtopicId,
        });
        movedQuestions.push(...chunk);
      }
    }

    await loadAdminData();
    setMoveQuestionsBusy(false);
    closeMoveQuestionsDialog();
    showAdminToast(`تم نقل ${matches.length} سؤال إلى ${destinationTopic.name}`);
  } catch (error) {
    console.error("Could not move question file:", error);
    const rolledBack =
      movedQuestions.length === 0 || (await rollbackMovedQuestions(movedQuestions));
    setFormError(
      adminElements.moveQuestionsError,
      rolledBack
        ? `تعذّر النقل ولم تتغيّر الأسئلة: ${error.message ?? "خطأ غير معروف"}`
        : "توقف النقل قبل اكتماله وتعذّر التراجع تلقائيًا. حدّث البيانات وتحقق من الأقسام.",
    );
    setMoveQuestionsBusy(false);
  }
}

async function importQuestionBank(file) {
  adminElements.importQuestions.disabled = true;
  adminElements.importQuestions.textContent = "جاري الاستيراد...";

  try {
    if (!window.VetMasterImport?.parseQuestionFile) {
      throw new Error("أداة قراءة الملفات غير متاحة. أعد تحميل الصفحة.");
    }
    const parsed = await window.VetMasterImport.parseQuestionFile(file, window.XLSX);
    if (!parsed.length) throw new Error("الملف لا يحتوي أسئلة.");

    const topicCache = new Map(
      adminState.topics.map((topic) => [topic.name.trim().toLowerCase(), topic]),
    );
    const subtopicCache = new Map(
      adminState.subtopics.map((subtopic) => [
        `${subtopic.topic_id}:${subtopic.name.trim().toLowerCase()}`,
        subtopic,
      ]),
    );
    const existingQuestions = new Set(
      adminState.questions.map((question) =>
        question.question_text.trim().toLowerCase(),
      ),
    );
    const payloads = [];
    let skipped = 0;

    for (const raw of parsed) {
      const questionText = String(raw.question_text ?? raw.question ?? "").trim();
      const options = Array.isArray(raw.options)
        ? raw.options.map((option) => String(option).trim())
        : [];
      const correctIndex = Number(raw.correct_index ?? raw.answer);
      if (
        !questionText ||
        options.length !== 4 ||
        options.some((option) => !option) ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex > 3 ||
        existingQuestions.has(questionText.toLowerCase())
      ) {
        skipped += 1;
        continue;
      }

      const topicName = String(
        raw.topic_name ?? raw.topic ?? raw.category ?? "General",
      ).trim();
      const subtopicName = String(
        raw.subtopic_name ?? raw.subtopic ?? raw.disease ?? "General",
      ).trim();
      const topic = await ensureImportTopic(topicName || "General", topicCache);
      const subtopic = await ensureImportSubtopic(
        subtopicName || "General",
        topic.id,
        subtopicCache,
      );

      payloads.push({
        topic_id: topic.id,
        subtopic_id: subtopic.id,
        question_text: questionText,
        options,
        correct_index: correctIndex,
        explanation: String(raw.explanation ?? "").trim(),
        difficulty: ["easy", "medium", "hard"].includes(raw.difficulty)
          ? raw.difficulty
          : "medium",
        priority: Math.min(Math.max(Number(raw.priority ?? 3), 1), 5),
        image_url: raw.image_url || null,
        source_note: raw.source_note || null,
        is_active: raw.is_active !== false,
        created_by: adminState.session.user.id,
      });
      existingQuestions.add(questionText.toLowerCase());
    }

    for (let index = 0; index < payloads.length; index += 100) {
      const result = await adminState.db
        .from("questions")
        .insert(payloads.slice(index, index + 100));
      if (result.error) throw result.error;
    }

    await loadAdminData();
    showAdminToast(`تم استيراد ${payloads.length} سؤال وتجاوز ${skipped}`);
  } catch (error) {
    console.error("Could not import questions:", error);
    showAdminToast(`فشل الاستيراد: ${error.message ?? "ملف غير صالح"}`);
  } finally {
    adminElements.importQuestions.disabled = false;
    adminElements.importQuestions.textContent = "استيراد Excel";
    adminElements.importFile.value = "";
  }
}

async function signIn(event) {
  event.preventDefault();
  setFormError(adminElements.loginError);
  adminElements.loginButton.disabled = true;
  adminElements.loginButton.textContent = "جاري التحقق...";

  try {
    const { data, error } = await adminState.db.auth.signInWithPassword({
      email: adminElements.loginEmail.value.trim(),
      password: adminElements.loginPassword.value,
    });
    if (error) throw error;
    adminState.session = data.session;
    await showDashboard();
  } catch (error) {
    console.error("Admin sign-in failed:", error);
    setFormError(
      adminElements.loginError,
      "بيانات الدخول غير صحيحة أو تعذّر الاتصال. حاول مرة ثانية.",
    );
  } finally {
    adminElements.loginButton.disabled = false;
    adminElements.loginButton.textContent = "تسجيل الدخول";
  }
}

async function showDashboard() {
  adminElements.loginView.classList.add("hidden");
  adminElements.errorView.classList.add("hidden");
  adminElements.dashboardView.classList.remove("hidden");
  adminElements.adminEmail.textContent = adminState.session?.user?.email ?? "Admin";
  await loadAdminData();
}

async function signOut() {
  await adminState.db.auth.signOut();
  adminState.session = null;
  adminState.topics = [];
  adminState.subtopics = [];
  adminState.questions = [];
  adminElements.dashboardView.classList.add("hidden");
  adminElements.loginView.classList.remove("hidden");
  adminElements.loginForm.reset();
  showAdminToast("تم تسجيل الخروج");
}

async function initializeAdmin() {
  adminState.db = createAdminDatabaseClient();
  if (!adminState.db) {
    showFatalError("تعذّر تحميل اتصال Supabase. تأكد من الإنترنت ثم أعد المحاولة.");
    return;
  }

  try {
    const {
      data: { session },
      error,
    } = await adminState.db.auth.getSession();
    if (error) throw error;
    adminState.session = session;
    if (session) await showDashboard();
  } catch (error) {
    console.error("Could not initialize admin session:", error);
    showFatalError("تعذّر التحقق من جلسة المدير. أعد تحميل الصفحة.");
  }
}

adminElements.loginForm.addEventListener("submit", signIn);
adminElements.signOut.addEventListener("click", signOut);
adminElements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchAdminTab(tab.dataset.tab));
});
adminElements.newQuestion.addEventListener("click", () => {
  resetQuestionForm();
  adminElements.questionFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  adminElements.questionText.focus({ preventScroll: true });
});
adminElements.resetQuestion.addEventListener("click", resetQuestionForm);
adminElements.questionTopic.addEventListener("change", () => refreshQuestionSubtopics());
adminElements.questionForm.addEventListener("submit", saveQuestion);
adminElements.refreshData.addEventListener("click", () => loadAdminData({ notify: true }));
[
  adminElements.questionSearch,
  adminElements.filterTopic,
  adminElements.filterDifficulty,
  adminElements.filterStatus,
].forEach((element) => {
  element.addEventListener("input", renderQuestionList);
  element.addEventListener("change", renderQuestionList);
});
adminElements.topicForm.addEventListener("submit", saveTopic);
adminElements.resetTopic.addEventListener("click", resetTopicForm);
adminElements.subtopicForm.addEventListener("submit", saveSubtopic);
adminElements.resetSubtopic.addEventListener("click", resetSubtopicForm);
adminElements.exportQuestions.addEventListener("click", exportQuestionBank);
adminElements.importQuestions.addEventListener("click", () =>
  adminElements.importFile.click(),
);
adminElements.importFile.addEventListener("change", () => {
  const [file] = adminElements.importFile.files;
  if (file) importQuestionBank(file);
});
adminElements.moveQuestionFile.addEventListener("click", openMoveQuestionsDialog);
adminElements.moveQuestionsFile.addEventListener("change", inspectMoveQuestionsFile);
adminElements.moveDestinationTopic.addEventListener(
  "change",
  handleMoveDestinationChange,
);
adminElements.moveNewTopicName.addEventListener("input", updateMoveButtonState);
adminElements.moveQuestionsForm.addEventListener("submit", moveQuestionsFromFile);
adminElements.closeMoveQuestions.addEventListener("click", closeMoveQuestionsDialog);
adminElements.cancelMoveQuestions.addEventListener("click", closeMoveQuestionsDialog);
adminElements.moveQuestionsDialog.addEventListener("cancel", (event) => {
  if (adminElements.confirmMoveQuestions.dataset.busy === "true") {
    event.preventDefault();
    return;
  }
  resetMoveQuestionsForm();
});

initializeAdmin();
