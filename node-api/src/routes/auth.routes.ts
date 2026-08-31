import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import rateLimit from "express-rate-limit";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../schemas/auth.schema";
import {
  postRegister,
  postLogin,
  postRefresh,
  postLogout,
  getMe,
} from "../controllers/auth.controller";

const router = Router();

// Stricter limiter on credential endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(postRegister));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(postLogin));
router.post("/refresh", authLimiter, validate(refreshSchema), asyncHandler(postRefresh));
router.post("/logout", validate(refreshSchema), asyncHandler(postLogout));
router.get("/me", requireAuth, asyncHandler(getMe));

export default router;
