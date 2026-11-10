import express from "express";
import {
  authorizeProjectPayment,
  completeAuthorization,
  captureMilestonePayment,
  getProjectPayments,
  voidProjectPayment,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/projects/:projectId/authorize", authorize("client"), authorizeProjectPayment);
router.post("/complete-authorization", authorize("client"), completeAuthorization);
router.post("/milestones/:milestoneId/capture", authorize("client"), captureMilestonePayment);
router.get("/projects/:projectId", getProjectPayments);
router.post("/projects/:projectId/void", authorize("client"), voidProjectPayment);

export default router;

