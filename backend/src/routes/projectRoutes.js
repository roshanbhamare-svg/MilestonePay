import express from "express";
import {
  createProject,
  getMyProjects,
  getProjectById,
  updateProject,
  cancelProject,
  assignFreelancer,
  acceptAgreement,
  rejectAgreement,
  getFreelancers,
} from "../controllers/projectController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/", authorize("client"), createProject);
router.get("/", getMyProjects);
router.get("/freelancers", getFreelancers);
router.get("/:projectId", getProjectById);
router.put("/:projectId", authorize("client"), updateProject);
router.post("/:projectId/cancel", authorize("client"), cancelProject);
router.post("/:projectId/assign", authorize("client"), assignFreelancer);
router.post("/:projectId/accept", acceptAgreement);
router.post("/:projectId/reject", rejectAgreement);

export default router;
