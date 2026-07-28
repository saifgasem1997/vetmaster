"use strict";

(function exposeVetMasterImport(root, factory) {
  const api = factory();
  root.VetMasterImport = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createImportApi() {
  const HEADER_ALIASES = {
    topic: [
      "الموضوع الرئيسي",
      "الموضوع",
      "القسم",
      "topic",
      "topic name",
      "category",
      "section",
    ],
    subtopic: [
      "المقطع او المرض",
      "المقطع",
      "المرض",
      "الموضوع الفرعي",
      "subtopic",
      "subtopic name",
      "disease",
    ],
    question: ["السؤال", "نص السؤال", "question", "question text", "question_text"],
    optionA: [
      "الخيار a",
      "الاختيار a",
      "الخيار 1",
      "الاختيار الاول",
      "option a",
      "option_a",
      "option 1",
    ],
    optionB: [
      "الخيار b",
      "الاختيار b",
      "الخيار 2",
      "الاختيار الثاني",
      "option b",
      "option_b",
      "option 2",
    ],
    optionC: [
      "الخيار c",
      "الاختيار c",
      "الخيار 3",
      "الاختيار الثالث",
      "option c",
      "option_c",
      "option 3",
    ],
    optionD: [
      "الخيار d",
      "الاختيار d",
      "الخيار 4",
      "الاختيار الرابع",
      "option d",
      "option_d",
      "option 4",
    ],
    correctAnswer: [
      "الاجابه الصحيحه",
      "الجواب الصحيح",
      "correct answer",
      "correct_answer",
      "answer",
    ],
    explanation: ["الشرح", "التفسير", "explanation"],
    difficulty: ["الصعوبه", "difficulty"],
    priority: ["الاهميه", "الاولويه", "priority", "importance"],
    source: ["المصدر", "ملاحظه المصدر", "source", "source note", "source_note"],
    imageUrl: ["رابط الصوره", "image url", "image_url"],
    active: ["فعال", "الحاله", "active", "is active", "is_active"],
  };

  function toWesternDigits(value) {
    return String(value ?? "")
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  }

  function normalizeHeader(value) {
    return toWesternDigits(value)
      .replace(/^\uFEFF/, "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[()[\]{}]/g, " ")
      .replace(/[_./\\-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  const normalizedAliases = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      aliases.map(normalizeHeader),
    ]),
  );

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function rowLookup(row) {
    const lookup = new Map();
    Object.entries(row ?? {}).forEach(([key, value]) => {
      lookup.set(normalizeHeader(key), value);
    });
    return lookup;
  }

  function findValue(lookup, aliasKey) {
    for (const alias of normalizedAliases[aliasKey]) {
      if (lookup.has(alias)) return lookup.get(alias);
    }
    return "";
  }

  function parseCorrectAnswer(value, options) {
    const rawValue = String(value ?? "").trim();
    const normalizedValue = normalizeHeader(rawValue);
    const letters = {
      a: 0,
      b: 1,
      c: 2,
      d: 3,
      ا: 0,
      ب: 1,
      ج: 2,
      د: 3,
    };

    if (Object.hasOwn(letters, normalizedValue)) {
      return letters[normalizedValue];
    }

    if (/^\d+$/.test(normalizedValue)) {
      const numericAnswer = Number(normalizedValue);
      if (numericAnswer >= 1 && numericAnswer <= 4) return numericAnswer - 1;
      if (numericAnswer === 0) return 0;
    }

    return options.findIndex(
      (option) => normalizeHeader(option) === normalizedValue && normalizedValue,
    );
  }

  function normalizeDifficulty(value) {
    const normalized = normalizeHeader(value);
    if (["easy", "سهل"].includes(normalized)) return "easy";
    if (["hard", "صعب"].includes(normalized)) return "hard";
    return "medium";
  }

  function normalizePriority(value) {
    const priority = Number(toWesternDigits(value));
    if (!Number.isFinite(priority)) return 3;
    return Math.min(Math.max(Math.round(priority), 1), 5);
  }

  function normalizeActive(value) {
    if (isBlank(value)) return true;
    const normalized = normalizeHeader(value);
    return !["لا", "no", "false", "0", "غير فعال", "inactive"].includes(normalized);
  }

  function spreadsheetRowToQuestion(row) {
    const lookup = rowLookup(row);
    const options = ["optionA", "optionB", "optionC", "optionD"].map((key) =>
      String(findValue(lookup, key) ?? "").trim(),
    );

    return {
      topic: String(findValue(lookup, "topic") ?? "").trim(),
      subtopic: String(findValue(lookup, "subtopic") ?? "").trim(),
      question: String(findValue(lookup, "question") ?? "").trim(),
      options,
      answer: parseCorrectAnswer(findValue(lookup, "correctAnswer"), options),
      explanation: String(findValue(lookup, "explanation") ?? "").trim(),
      difficulty: normalizeDifficulty(findValue(lookup, "difficulty")),
      priority: normalizePriority(findValue(lookup, "priority")),
      source_note: String(findValue(lookup, "source") ?? "").trim() || null,
      image_url: String(findValue(lookup, "imageUrl") ?? "").trim() || null,
      is_active: normalizeActive(findValue(lookup, "active")),
    };
  }

  function detectDelimiter(text) {
    const firstLine = String(text).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
    const candidates = [",", ";", "\t"];
    let bestDelimiter = ",";
    let bestCount = -1;

    candidates.forEach((delimiter) => {
      let count = 0;
      let inQuotes = false;
      for (let index = 0; index < firstLine.length; index += 1) {
        const character = firstLine[index];
        if (character === '"') {
          if (inQuotes && firstLine[index + 1] === '"') index += 1;
          else inQuotes = !inQuotes;
        } else if (!inQuotes && character === delimiter) {
          count += 1;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestDelimiter = delimiter;
      }
    });

    return bestDelimiter;
  }

  function parseDelimitedRows(text, delimiter = detectDelimiter(text)) {
    const source = String(text ?? "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];

      if (inQuotes) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          inQuotes = false;
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        inQuotes = true;
      } else if (character === delimiter) {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((cell) => !isBlank(cell))) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    row.push(field);
    if (row.some((cell) => !isBlank(cell))) rows.push(row);
    return rows;
  }

  function gridToObjects(grid) {
    const populatedRows = (grid ?? []).filter(
      (row) => Array.isArray(row) && row.some((cell) => !isBlank(cell)),
    );
    if (!populatedRows.length) return [];

    const headers = populatedRows[0].map((header) => String(header ?? "").trim());
    return populatedRows.slice(1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    );
  }

  async function parseQuestionFile(file, xlsxApi) {
    const extension = String(file?.name ?? "")
      .split(".")
      .pop()
      .toLowerCase();

    if (extension === "json") {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) {
        throw new Error("ملف JSON يجب أن يحتوي قائمة أسئلة.");
      }
      return parsed;
    }

    let grid;
    if (extension === "csv" || extension === "tsv") {
      grid = parseDelimitedRows(await file.text(), extension === "tsv" ? "\t" : undefined);
    } else if (extension === "xlsx" || extension === "xls") {
      if (!xlsxApi?.read || !xlsxApi?.utils?.sheet_to_json) {
        throw new Error("تعذّرت قراءة Excel. احفظ الملف بصيغة CSV UTF-8 وحاول مجددًا.");
      }
      const workbook = xlsxApi.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) throw new Error("ملف Excel لا يحتوي أوراقًا.");
      grid = xlsxApi.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      });
    } else {
      throw new Error("اختر ملف Excel أو CSV أو JSON.");
    }

    return gridToObjects(grid).map(spreadsheetRowToQuestion);
  }

  return {
    detectDelimiter,
    gridToObjects,
    normalizeHeader,
    parseCorrectAnswer,
    parseDelimitedRows,
    parseQuestionFile,
    spreadsheetRowToQuestion,
    toWesternDigits,
  };
});
