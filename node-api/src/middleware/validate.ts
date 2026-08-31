import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";

/**
 * Zod validation middleware factory. Validates and COERCES the request body,
 * query, and params against a schema. On success the parsed (typed) values
 * overwrite the originals so downstream handlers receive clean data.
 */
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      // req.query / req.params are read-only getters in Express 5-style typings;
      // assign defensively for Express 4 runtime.
      if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
      next();
    } catch (err) {
      // Forward Zod errors to the central handler (mapped to HTTP 422).
      next(err instanceof ZodError ? err : err);
    }
  };
