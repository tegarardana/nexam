import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("Phase 5 - Reporting, Deployment, and Hardening", () => {
  describe("Security Hardening & Rate Limiting", () => {
    it("should allow requests under the defined rate limit", () => {
      const id = "test_ip_normal";
      const result1 = checkRateLimit(id, { limit: 5, windowMs: 10000 });
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = checkRateLimit(id, { limit: 5, windowMs: 10000 });
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it("should block requests when rate limit threshold is exceeded", () => {
      const id = "test_ip_attacker";
      for (let i = 0; i < 3; i++) {
        checkRateLimit(id, { limit: 3, windowMs: 10000 });
      }

      const blocked = checkRateLimit(id, { limit: 3, windowMs: 10000 });
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetMs).toBeGreaterThan(0);
    });
  });

  describe("Reporting & Gradebook Aggregations", () => {
    it("should calculate correct gradebook metrics for pass and remedial students", () => {
      const scores = [85, 90, 70, 60, 100];
      const passingScore = 75;

      const totalParticipants = scores.length;
      const averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / totalParticipants) * 10) / 10;
      const highestScore = Math.max(...scores);
      const lowestScore = Math.min(...scores);
      const passedCount = scores.filter((s) => s >= passingScore).length;
      const failedCount = scores.filter((s) => s < passingScore).length;
      const passRate = Math.round((passedCount / totalParticipants) * 100);

      expect(averageScore).toBe(81);
      expect(highestScore).toBe(100);
      expect(lowestScore).toBe(60);
      expect(passedCount).toBe(3); // 85, 90, 100
      expect(failedCount).toBe(2); // 70, 60
      expect(passRate).toBe(60);
    });

    it("should properly format CSV values with escaping and UTF-8 BOM", () => {
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const BOM = "\uFEFF";
      const studentName = 'Ahmad "Budi" Santoso';
      const escaped = escapeCsv(studentName);

      expect(escaped).toBe('"Ahmad ""Budi"" Santoso"');

      const csvContent = BOM + `No,Nama\r\n1,${escaped}`;
      expect(csvContent.startsWith("\uFEFF")).toBe(true);
      expect(csvContent).toContain('""Budi""');
    });
  });
});
