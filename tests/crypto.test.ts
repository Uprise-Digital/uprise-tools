import { expect, test, describe, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "../src/lib/crypto";

describe("Crypto Utility Tests", () => {
  beforeAll(() => {
    // 32-byte hex encryption key (64 characters)
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  test("should encrypt and decrypt a token correctly", () => {
    const rawToken = "ya29.a0AfH6SMA-xyz-google-ads-refresh-token";
    const encrypted = encryptToken(rawToken);
    
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe("string");
    expect(encrypted.split(":").length).toBe(3); // iv:tag:ciphertext

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  test("should throw an error for malformed encrypted text", () => {
    expect(() => decryptToken("malformed-text")).toThrow();
  });
});
