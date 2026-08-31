import request from "supertest";
import { createApp } from "../app";

const app = createApp();
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

// These tests exercise routing, Zod validation, the auth guard, and the
// centralized error handler — all paths that short-circuit BEFORE any DB call,
// so the suite runs green without a live PostGIS instance.
describe("HTTP app (no DB required)", () => {
  it("GET /api/v1/health → 200", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET / → 200 service banner", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toMatch(/NER/i);
  });

  it("unknown route → 404", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  describe("validation (422)", () => {
    it("telemetry batch with no points", async () => {
      const res = await request(app).post("/api/v1/telemetry/batch").send({});
      expect(res.status).toBe(422);
    });

    it("register with missing fields", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({});
      expect(res.status).toBe(422);
    });

    it("login with missing fields", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({});
      expect(res.status).toBe(422);
    });

    it("hazard create with empty body", async () => {
      const res = await request(app).post("/api/v1/hazards").send({});
      expect(res.status).toBe(422);
    });
  });

  describe("emergency decode error paths", () => {
    it("empty decoded payload → 400", async () => {
      const res = await request(app)
        .post("/api/v1/emergency/sms")
        .send({ payload: "%%%" });
      expect(res.status).toBe(400);
    });

    it("too-few-fields frame → 422", async () => {
      const res = await request(app)
        .post("/api/v1/emergency/sms")
        .send({ payload: b64("only-one") });
      expect(res.status).toBe(422);
    });
  });

  describe("auth guard (401)", () => {
    it("GET /api/v1/trips without a token", async () => {
      const res = await request(app).get("/api/v1/trips");
      expect(res.status).toBe(401);
    });

    it("GET /api/v1/auth/me without a token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("PATCH trip status without a token", async () => {
      const res = await request(app)
        .patch("/api/v1/trips/11111111-1111-4111-8111-111111111111/status")
        .send({ status: "in_transit" });
      expect(res.status).toBe(401);
    });
  });
});
