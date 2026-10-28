import { describe, it, expect } from "vitest";

function generateExamToken(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function validateExamToken(
  providedToken: string | undefined | null,
  validToken: string | undefined | null
): boolean {
  if (!validToken) return true;
  if (!providedToken) return false;
  return providedToken.trim().toUpperCase() === validToken.trim().toUpperCase();
}

describe("Exam Token Validation & Generation", () => {
  it("should generate a 6-character alphanumeric token without ambiguous characters (no 0, O, 1, I)", () => {
    for (let i = 0; i < 20; i++) {
      const token = generateExamToken();
      expect(token).toHaveLength(6);
      expect(token).toMatch(/^[A-Z0-9]{6}$/);
      expect(token).not.toMatch(/[01OI]/);
    }
  });

  it("should validate matching token case-insensitively and ignore whitespaces", () => {
    expect(validateExamToken("nex9kt", "NEX9KT")).toBe(true);
    expect(validateExamToken("  NEX9KT  ", "nex9kt")).toBe(true);
    expect(validateExamToken("ABC123", "abc123")).toBe(true);
  });

  it("should reject invalid or mismatched tokens", () => {
    expect(validateExamToken("WRONG1", "NEX9KT")).toBe(false);
    expect(validateExamToken("", "NEX9KT")).toBe(false);
    expect(validateExamToken(null, "NEX9KT")).toBe(false);
    expect(validateExamToken(undefined, "NEX9KT")).toBe(false);
  });
});

