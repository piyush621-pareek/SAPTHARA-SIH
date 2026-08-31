import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
} from "../utils/auth";

describe("auth utils", () => {
  describe("password hashing", () => {
    it("hashes a password to something other than the plaintext", async () => {
      const hash = await hashPassword("s3cret-pass");
      expect(hash).not.toBe("s3cret-pass");
      expect(hash.length).toBeGreaterThan(20);
    });

    it("verifies a correct password", async () => {
      const hash = await hashPassword("correct horse");
      await expect(comparePassword("correct horse", hash)).resolves.toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const hash = await hashPassword("correct horse");
      await expect(comparePassword("wrong horse", hash)).resolves.toBe(false);
    });
  });

  describe("jwt", () => {
    const payload = { sub: "user-1", role: "dispatcher", phone: "+919000000001" };

    it("round-trips a signed token", () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.phone).toBe(payload.phone);
    });

    it("throws on a tampered/invalid token", () => {
      expect(() => verifyToken("not.a.jwt")).toThrow();
    });
  });
});
