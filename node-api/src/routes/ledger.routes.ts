import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { appendLedgerSchema } from "../schemas/ledger.schema";
import { postEntry, getEntries, getVerify } from "../controllers/ledger.controller";

const router = Router();

// Verify + read are public (anyone can audit integrity); appends require auth.
router.get("/verify", asyncHandler(getVerify));
router.get("/", asyncHandler(getEntries));
router.post("/", requireAuth, validate(appendLedgerSchema), asyncHandler(postEntry));

export default router;
