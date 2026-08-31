import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { isProd } from "../config/env";

/**
 * 404 handler — reached when no route matched.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized error handler. MUST be registered last (4-arg signature).
 * Normalizes Zod, Postgres, and AppError instances into a consistent shape.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = "Internal Server Error";
  let details: unknown;

  if (err instanceof ZodError) {
    statusCode = 422;
    message = "Validation failed";
    details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (isPgError(err)) {
    // Map common Postgres errors to meaningful HTTP codes.
    switch (err.code) {
      case "23505": // unique_violation
        statusCode = 409;
        message = "Duplicate resource";
        break;
      case "23503": // foreign_key_violation
        statusCode = 409;
        message = "Referenced resource does not exist";
        break;
      case "22P02": // invalid_text_representation
        statusCode = 400;
        message = "Malformed identifier or value";
        break;
      default:
        statusCode = 500;
        message = "Database error";
    }
    if (!isProd) details = { code: err.code, detail: err.detail };
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    success: false,
    error: { message, ...(details !== undefined ? { details } : {}) },
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}

interface PgError {
  code: string;
  detail?: string;
}

function isPgError(err: unknown): err is PgError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}
