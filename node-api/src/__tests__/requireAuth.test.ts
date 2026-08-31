import type { Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { signToken } from "../utils/auth";
import { AppError } from "../utils/AppError";

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}
const res = {} as Response;

describe("requireAuth middleware", () => {
  it("rejects a request with no Authorization header (401)", () => {
    const next = jest.fn();
    requireAuth(mockReq(), res, next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it("rejects a malformed scheme (401)", () => {
    const next = jest.fn();
    requireAuth(mockReq({ authorization: "Basic abc" }), res, next);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it("rejects an invalid token (401)", () => {
    const next = jest.fn();
    requireAuth(mockReq({ authorization: "Bearer garbage" }), res, next);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it("accepts a valid token and attaches req.user", () => {
    const token = signToken({ sub: "u1", role: "driver", phone: "+91900" });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(); // no error
    expect(req.user?.sub).toBe("u1");
  });
});

describe("requireRole middleware", () => {
  it("allows a permitted role", () => {
    const req = { user: { sub: "u1", role: "admin", phone: "x" } } as Request;
    const next = jest.fn();
    requireRole("admin", "dispatcher")(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks a disallowed role (403)", () => {
    const req = { user: { sub: "u1", role: "driver", phone: "x" } } as Request;
    const next = jest.fn();
    requireRole("admin")(req, res, next);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
  });
});
