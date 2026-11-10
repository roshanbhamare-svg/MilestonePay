import express from "express";
import {
  createMilestone,
  createBulkMilestones,
  getProjectMilestones,
  updateMilestone,
  updateMilestoneStatus,
} from "../controllers/milestoneController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/project/:projectId", authorize("client"), createMilestone);
router.post("/project/:projectId/bulk", authorize("client"), createBulkMilestones);
router.get("/project/:projectId", getProjectMilestones);
router.put("/:milestoneId", authorize("client"), updateMilestone);
router.patch("/:milestoneId/status", updateMilestoneStatus);

export default router;
