import express from "express";
import { getFreelancers, getUserById } from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get("/freelancers", getFreelancers);
router.get("/:userId", getUserById);

export default router;
