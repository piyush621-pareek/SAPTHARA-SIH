import { Request } from "express";

export interface Page {
  limit: number;
  offset: number;
}

/** Parses ?limit & ?offset with sane defaults and a hard cap. */
export function parsePage(req: Request, defaultLimit = 50, maxLimit = 200): Page {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.trunc(rawLimit)), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;
  return { limit, offset };
}
