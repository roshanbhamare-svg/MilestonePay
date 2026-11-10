import mongoose from "mongoose";

const captureRecordSchema = new mongoose.Schema(
  {
    captureId: { type: String, required: true },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["COMPLETED", "PENDING", "DENIED"],
      default: "PENDING",
    },
    finalCapture: { type: Boolean, default: false },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
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
    paypalOrderId: {
      type: String,
      default: null,
    },
    authorizationId: {
      type: String,
      default: null,
    },
    totalAuthorized: {
      type: Number,
      default: 0,
    },
    totalCaptured: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    captures: [captureRecordSchema],
    status: {
      type: String,
      enum: [
        "PENDING",
        "AUTHORIZED",
        "PARTIALLY_CAPTURED",
        "COMPLETED",
        "FAILED",
        "VOIDED",
      ],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
