import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { hashToken, generateToken } from "../src/lib/auth/session";

describe("Password Hashing & Verification (Argon2id)", () => {
  it("should generate a secure Argon2id hash and verify correctly", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toContain("$argon2id$");

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword123!", hash);
    expect(isInvalid).toBe(false);
  });

  it("should generate unique hashes for the same password due to salting", async () => {
    const password = "SamePassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe("Session Token Hashing", () => {
  it("should generate random tokens and deterministic SHA-256 hashes", () => {
    const token1 = generateToken();
    const token2 = generateToken();

    expect(token1).toHaveLength(64); // 32 bytes hex
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1a = hashToken(token1);
    const hash1b = hashToken(token1);
    const hash2 = hashToken(token2);

    expect(hash1a).toBe(hash1b);
    expect(hash1a).not.toBe(hash2);
    expect(hash1a).toHaveLength(64);
  });
});
