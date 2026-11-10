import express from "express";
import {
  generateMilestonesHandler,
  evaluateSubmissionHandler,
  getEvaluation,
} from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/projects/:projectId/generate-milestones", generateMilestonesHandler);
router.post("/milestones/:milestoneId/evaluate", evaluateSubmissionHandler);
router.get("/milestones/:milestoneId/evaluation", getEvaluation);

export default router;

