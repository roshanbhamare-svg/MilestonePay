import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 3000,
    },
    paymentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    deadline: {
      type: Date,
      required: true,
    },
    deliverables: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
      },
    ],
    acceptanceCriteria: [
      {
        criteria: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    order: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "PAID",
        "CHANGES_REQUESTED",
        "RESUBMITTED",
      ],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

const Milestone = mongoose.model("Milestone", milestoneSchema);

export default Milestone;

