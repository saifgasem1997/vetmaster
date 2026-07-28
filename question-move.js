"use strict";

(function exposeVetMasterMove(root, factory) {
  const api = factory();
  root.VetMasterMove = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createMoveApi() {
  function normalizeQuestionText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("en");
  }

  function questionTextFromFileRow(row) {
    return row?.question_text ?? row?.question ?? "";
  }

  function matchFileQuestions(fileQuestions, storedQuestions) {
    const storedByText = new Map();
    (storedQuestions ?? []).forEach((question) => {
      const key = normalizeQuestionText(question?.question_text);
      if (!key) return;
      const bucket = storedByText.get(key) ?? [];
      bucket.push(question);
      storedByText.set(key, bucket);
    });

    const uniqueFileRows = new Map();
    let duplicateFileCount = 0;
    let ignoredCount = 0;

    (fileQuestions ?? []).forEach((row) => {
      const key = normalizeQuestionText(questionTextFromFileRow(row));
      if (!key) {
        ignoredCount += 1;
        return;
      }
      if (uniqueFileRows.has(key)) {
        duplicateFileCount += 1;
        return;
      }
      uniqueFileRows.set(key, row);
    });

    const matches = [];
    let unmatchedCount = 0;
    let ambiguousCount = 0;

    uniqueFileRows.forEach((fileQuestion, key) => {
      const candidates = storedByText.get(key) ?? [];
      if (candidates.length === 1) {
        matches.push({ question: candidates[0], fileQuestion });
      } else if (candidates.length === 0) {
        unmatchedCount += 1;
      } else {
        ambiguousCount += 1;
      }
    });

    return {
      matches,
      totalFileQuestions: uniqueFileRows.size,
      unmatchedCount,
      ambiguousCount,
      duplicateFileCount,
      ignoredCount,
    };
  }

  return {
    matchFileQuestions,
    normalizeQuestionText,
    questionTextFromFileRow,
  };
});
