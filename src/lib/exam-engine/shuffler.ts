/**
 * Nexam Examination Engine - Deterministic Shuffler
 * Uses Mulberry32 seeded PRNG so that shuffling is reproducible
 * and frozen per student attempt.
 */

function createSeededPRNG(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }

  return function () {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles an array in place or returns a shuffled copy deterministically using seed.
 */
export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const result = [...items];
  const random = createSeededPRNG(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Creates frozen randomization map for an attempt:
 * - questionOrder: array of examination_question IDs
 * - optionOrders: map of questionVersionId -> array of option IDs
 */
export function generateFrozenRandomization(
  examinationQuestions: Array<{
    id: string;
    questionVersion: {
      id: string;
      options?: Array<{ id: string }>;
    };
  }>,
  attemptSeed: string,
  randomizeQuestions: boolean = false,
  randomizeOptions: boolean = false
): {
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
} {
  let orderedQuestions = [...examinationQuestions];

  if (randomizeQuestions) {
    orderedQuestions = shuffleWithSeed(orderedQuestions, `${attemptSeed}_questions`);
  }

  const questionOrder = orderedQuestions.map((q) => q.id);
  const optionOrders: Record<string, string[]> = {};

  if (randomizeOptions) {
    for (const q of examinationQuestions) {
      const opts = q.questionVersion?.options || [];
      if (opts.length > 0) {
        const shuffled = shuffleWithSeed(opts, `${attemptSeed}_opt_${q.id}`);
        optionOrders[q.id] = shuffled.map((o) => o.id);
      }
    }
  }

  return { questionOrder, optionOrders };
}
