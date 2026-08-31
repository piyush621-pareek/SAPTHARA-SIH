import { NextFunction, Request, Response, RequestHandler } from "express";

/**
 * Wraps an async route/controller so any rejected promise is forwarded to
 * Express's error pipeline instead of crashing or hanging the request.
 * This is what lets the centralized error handler catch ALL async errors.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
