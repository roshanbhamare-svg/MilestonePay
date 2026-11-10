import express from "express";
import {
  approveMilestone,
  requestChanges,
  startReview,
} from "../controllers/approvalController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/:milestoneId/review", authorize("client"), startReview);
router.post("/:milestoneId/approve", authorize("client"), approveMilestone);
router.post("/:milestoneId/request-changes", authorize("client"), requestChanges);

export default router;
