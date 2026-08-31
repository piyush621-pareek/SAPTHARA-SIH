/**
 * Operational error carrying an HTTP status. Distinguished from programmer
 * errors so the central handler can decide what to expose to clients.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg: string, details?: unknown): AppError {
    return new AppError(msg, 400, details);
  }
  static notFound(msg = "Resource not found"): AppError {
    return new AppError(msg, 404);
  }
  static unprocessable(msg: string, details?: unknown): AppError {
    return new AppError(msg, 422, details);
  }
}
