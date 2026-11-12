import { describe, it, expect } from "vitest";
import { formatNameWithTitle } from "../src/lib/format-user";

describe("formatNameWithTitle", () => {
  it("appends academic title when present", () => {
    expect(formatNameWithTitle("Budi Santoso", "S.Pd.")).toBe("Budi Santoso, S.Pd.");
    expect(formatNameWithTitle("Ahmad Fauzi", "S.Pd., M.Kom.")).toBe("Ahmad Fauzi, S.Pd., M.Kom.");
  });

  it("returns displayName alone when title is empty, null, undefined, or dash", () => {
    expect(formatNameWithTitle("Budi Santoso", null)).toBe("Budi Santoso");
    expect(formatNameWithTitle("Budi Santoso", undefined)).toBe("Budi Santoso");
    expect(formatNameWithTitle("Budi Santoso", "")).toBe("Budi Santoso");
    expect(formatNameWithTitle("Budi Santoso", "   ")).toBe("Budi Santoso");
    expect(formatNameWithTitle("Budi Santoso", "-")).toBe("Budi Santoso");
  });

  it("trims whitespace and avoids duplicate titles", () => {
    expect(formatNameWithTitle("  Budi Santoso  ", "  S.Pd.  ")).toBe("Budi Santoso, S.Pd.");
    expect(formatNameWithTitle("Budi Santoso, S.Pd.", "S.Pd.")).toBe("Budi Santoso, S.Pd.");
    expect(formatNameWithTitle("Budi Santoso, s.pd.", "S.Pd.")).toBe("Budi Santoso, s.pd.");
  });

  it("handles trailing comma cleanly", () => {
    expect(formatNameWithTitle("Budi Santoso,", "S.Pd.")).toBe("Budi Santoso, S.Pd.");
  });

  it("returns empty string when displayName is missing", () => {
    expect(formatNameWithTitle("", "S.Pd.")).toBe("");
    expect(formatNameWithTitle(null, "S.Pd.")).toBe("");
  });
});

