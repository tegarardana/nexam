/**
 * Nexam Examination Engine - Grading Engine
 * Handles automatic grading for objective question types:
 * - single_choice
 * - multi_select
 * - true_false
 * - short_answer
 * And registers manual grading requirements for:
 * - essay
 */

export interface QuestionVersionSnapshot {
  id: string;
  questionId: string;
  content: any;
  gradingConfig: {
    points?: number;
    answerKey?: any;
    caseSensitive?: boolean;
    partialGrading?: boolean;
    rubric?: string;
  };
  options?: Array<{
    id: string;
    label: string;
    content: any;
    isCorrect: boolean;
    sortOrder: number;
  }>;
}

export interface AutoGradingResult {
  rawScore: number;
  maxScore: number;
  isCorrect: boolean;
  gradingMethod: "auto" | "manual";
  gradingStatus: "pending" | "finalized";
  feedback?: string;
}

/**
 * Normalizes short answer string for robust comparison.
 */
export function normalizeShortAnswer(text: string, caseSensitive: boolean = false): string {
  if (!text) return "";
  let clean = text.trim();
  if (!caseSensitive) {
    clean = clean.toLowerCase();
  }
  // Normalize consecutive whitespaces
  clean = clean.replace(/\s+/g, " ");
  return clean;
}

/**
 * Evaluates a single answer against the question's version snapshot.
 */
export function evaluateAnswer(
  questionType: string,
  answerValue: any,
  version: QuestionVersionSnapshot,
  questionMaxPoints: number = 1.0
): AutoGradingResult {
  const maxScore = Number(questionMaxPoints) || 1.0;

  // If answer is empty or null
  if (answerValue === null || answerValue === undefined || answerValue === "") {
    if (questionType === "essay") {
      return {
        rawScore: 0,
        maxScore,
        isCorrect: false,
        gradingMethod: "manual",
        gradingStatus: "pending",
        feedback: "Belum dijawab oleh peserta.",
      };
    }
    return {
      rawScore: 0,
      maxScore,
      isCorrect: false,
      gradingMethod: "auto",
      gradingStatus: "finalized",
      feedback: "Tidak ada jawaban.",
    };
  }

  const options = version.options || [];

  switch (questionType) {
    case "single_choice": {
      // answerValue can be option id or label
      const correctOption = options.find((opt) => opt.isCorrect);
      if (!correctOption) {
        return { rawScore: 0, maxScore, isCorrect: false, gradingMethod: "auto", gradingStatus: "finalized" };
      }

      const isMatch =
        String(answerValue).trim() === correctOption.id ||
        String(answerValue).trim().toUpperCase() === correctOption.label.toUpperCase();

      return {
        rawScore: isMatch ? maxScore : 0,
        maxScore,
        isCorrect: isMatch,
        gradingMethod: "auto",
        gradingStatus: "finalized",
      };
    }

    case "true_false": {
      // answerValue: "Benar" | "Salah" | boolean | optionId
      const correctOption = options.find((opt) => opt.isCorrect);
      let isMatch = false;

      if (correctOption) {
        isMatch =
          String(answerValue).trim() === correctOption.id ||
          String(answerValue).trim().toLowerCase() === correctOption.label.toLowerCase();
      } else if (version.gradingConfig?.answerKey !== undefined) {
        const expected = String(version.gradingConfig.answerKey).trim().toLowerCase();
        const actual = String(answerValue).trim().toLowerCase();
        isMatch = actual === expected;
      }

      return {
        rawScore: isMatch ? maxScore : 0,
        maxScore,
        isCorrect: isMatch,
        gradingMethod: "auto",
        gradingStatus: "finalized",
      };
    }

    case "multi_select": {
      // answerValue should be array of option IDs or labels
      const correctOptionIds = options.filter((opt) => opt.isCorrect).map((opt) => opt.id);
      const correctLabels = options.filter((opt) => opt.isCorrect).map((opt) => opt.label.toUpperCase());

      const selected = Array.isArray(answerValue) ? answerValue.map((v) => String(v).trim()) : [String(answerValue).trim()];

      if (correctOptionIds.length === 0 && correctLabels.length === 0) {
        return { rawScore: 0, maxScore, isCorrect: false, gradingMethod: "auto", gradingStatus: "finalized" };
      }

      // Check matches
      const isIdBased = selected.some((s) => correctOptionIds.includes(s));
      const targetList = isIdBased ? correctOptionIds : correctLabels;
      const normalizedSelected = isIdBased ? selected : selected.map((s) => s.toUpperCase());

      const correctSelectedCount = normalizedSelected.filter((s) => targetList.includes(s)).length;
      const incorrectSelectedCount = normalizedSelected.filter((s) => !targetList.includes(s)).length;

      // Partial points support
      if (version.gradingConfig?.partialGrading) {
        const pointPerOption = maxScore / targetList.length;
        const penalty = pointPerOption * incorrectSelectedCount;
        const earned = Math.max(0, correctSelectedCount * pointPerOption - penalty);
        const roundedScore = Math.round(earned * 100) / 100;
        return {
          rawScore: roundedScore,
          maxScore,
          isCorrect: roundedScore === maxScore,
          gradingMethod: "auto",
          gradingStatus: "finalized",
        };
      } else {
        // All-or-nothing
        const exactMatch =
          correctSelectedCount === targetList.length && incorrectSelectedCount === 0;
        return {
          rawScore: exactMatch ? maxScore : 0,
          maxScore,
          isCorrect: exactMatch,
          gradingMethod: "auto",
          gradingStatus: "finalized",
        };
      }
    }

    case "short_answer": {
      // answerValue: string
      const caseSensitive = Boolean(version.gradingConfig?.caseSensitive);
      const studentText = normalizeShortAnswer(String(answerValue), caseSensitive);

      // answerKey can be single string or comma/semicolon separated acceptable answers, or array
      const answerKey = version.gradingConfig?.answerKey;
      let acceptableKeys: string[] = [];

      if (Array.isArray(answerKey)) {
        acceptableKeys = answerKey.map((k) => normalizeShortAnswer(String(k), caseSensitive));
      } else if (typeof answerKey === "string") {
        acceptableKeys = answerKey
          .split(/[,;|]/)
          .map((k) => normalizeShortAnswer(k, caseSensitive))
          .filter((k) => k.length > 0);
      }

      const isMatch = acceptableKeys.includes(studentText);

      return {
        rawScore: isMatch ? maxScore : 0,
        maxScore,
        isCorrect: isMatch,
        gradingMethod: "auto",
        gradingStatus: "finalized",
      };
    }

    case "essay":
    default: {
      // Essay requires manual evaluation by teacher
      return {
        rawScore: 0,
        maxScore,
        isCorrect: false,
        gradingMethod: "manual",
        gradingStatus: "pending",
        feedback: "Menunggu penilaian guru.",
      };
    }
  }
}
