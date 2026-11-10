import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    githubUrl: {
      type: String,
      default: "",
    },
    files: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String, default: "document" },
      },
    ],
    notes: {
      type: String,
      maxlength: 3000,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "CHANGES_REQUESTED"],
      default: "SUBMITTED",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Submission = mongoose.model("Submission", submissionSchema);

export default Submission;

