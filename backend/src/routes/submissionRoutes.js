import express from "express";
import {
  submitWork,
  getSubmissions,
  getSubmissionById,
} from "../controllers/submissionController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/milestone/:milestoneId", authorize("freelancer"), submitWork);
router.get("/milestone/:milestoneId", getSubmissions);
router.get("/:submissionId", getSubmissionById);

export default router;

