import express from "express";
import {
  previewMilestonesHandler,
  generateMilestonesHandler,
  evaluateSubmissionHandler,
  getEvaluation,
  projectAssistantHandler,
} from "../controllers/aiController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/generate-milestones", authorize("client"), previewMilestonesHandler);
router.post("/projects/:projectId/generate-milestones", authorize("client"), generateMilestonesHandler);
router.post("/milestones/:milestoneId/evaluate", evaluateSubmissionHandler);
router.get("/milestones/:milestoneId/evaluation", getEvaluation);
router.post("/projects/:projectId/assistant", projectAssistantHandler);

export default router;

