import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "PROJECT_CREATED",
        "FREELANCER_ASSIGNED",
        "AGREEMENT_ACCEPTED",
        "MILESTONE_SUBMITTED",
        "EVALUATION_COMPLETE",
        "MILESTONE_APPROVED",
        "CHANGES_REQUESTED",
        "PAYMENT_CAPTURED",
        "PAYMENT_FAILED",
        "PROJECT_COMPLETED",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

