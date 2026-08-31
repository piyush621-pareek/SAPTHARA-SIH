import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { createReportSchema, reportIdSchema } from "../schemas/report.schema";
import {
  postReport,
  getReports,
  getReportById,
} from "../controllers/report.controller";

const router = Router();

router.post("/", validate(createReportSchema), asyncHandler(postReport));
router.get("/", asyncHandler(getReports));
router.get("/:id", validate(reportIdSchema), asyncHandler(getReportById));

export default router;
