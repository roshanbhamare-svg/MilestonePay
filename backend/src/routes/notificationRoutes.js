import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getMyNotifications);
router.patch("/:notificationId/read", markAsRead);
router.patch("/mark-all-read", markAllAsRead);

export default router;
