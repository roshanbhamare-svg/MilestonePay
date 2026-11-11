import mongoose from "mongoose";

const criteriaResultSchema = new mongoose.Schema(
  {
    criteria: { type: String, required: true },
    met: { type: Boolean, default: false },
    comments: { type: String, default: "" },
  },
  { _id: false }
);

const aiEvaluationSchema = new mongoose.Schema(
  {
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      required: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
    },
    criteriaResults: [criteriaResultSchema],
    completedRequirements: [{ type: String }],
    missingRequirements: [{ type: String }],
    improvementSuggestions: [{ type: String }],
    recommendations: {
      type: String,
      default: "",
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    analysisMetadata: {
      githubUrl: { type: String, default: "" },
      githubAccessible: { type: Boolean, default: false },
      githubError: { type: String, default: null },
      repoFilesInspected: [{ type: String }],
      attachmentsInspected: [
        {
          filename: { type: String },
          fileType: { type: String },
          inspected: { type: Boolean, default: false },
        },
      ],
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

const AIEvaluation = mongoose.model("AIEvaluation", aiEvaluationSchema);

export default AIEvaluation;

