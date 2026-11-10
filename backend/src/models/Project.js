import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    budget: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "INR"],
    },
    deadline: {
      type: Date,
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "AGREEMENT_PENDING",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "DRAFT",
    },
    agreement: {
      clientAccepted: { type: Boolean, default: false },
      freelancerAccepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
