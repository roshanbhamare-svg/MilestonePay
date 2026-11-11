import Payment from "../models/Payment.js";
import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import {
  createOrder,
  authorizeOrder,
  captureAuthorization,
  voidAuthorization,
} from "../services/paypalService.js";

export const authorizeProjectPayment = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can authorize payment" });
    }

    if (project.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "Project must be ACTIVE to authorize payment" });
    }

    const existingPayment = await Payment.findOne({
      projectId: project._id,
      status: { $in: ["AUTHORIZED", "PARTIALLY_CAPTURED"] },
    });
    if (existingPayment) {
      return res.status(400).json({ success: false, error: "Payment already authorized for this project" });
    }

    const orderResult = await createOrder(
      project.budget,
      project.currency,
      `MilestonePay – ${project.title}`
    );

    let payment = await Payment.findOne({ projectId: project._id });
    if (!payment) {
      payment = await Payment.create({
        projectId: project._id,
        clientId: project.clientId,
        freelancerId: project.freelancerId,
        paypalOrderId: orderResult.orderId,
        totalAuthorized: project.budget,
        currency: project.currency,
        status: "PENDING",
      });
    } else {
      payment.paypalOrderId = orderResult.orderId;
      payment.totalAuthorized = project.budget;
      payment.currency = project.currency;
      payment.status = "PENDING";
      await payment.save();
    }

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: orderResult.orderId,
        approvalLinks: orderResult.links,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create payment order" });
  }
};

export const completeAuthorization = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: "Order ID is required" });
    }

    const payment = await Payment.findOne({ paypalOrderId: orderId });
    if (!payment) {
      return res.status(404).json({ success: false, error: "Payment record not found" });
    }

    if (payment.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const authResult = await authorizeOrder(orderId);

    payment.authorizationId = authResult.authorizationId;
    payment.status = "AUTHORIZED";
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        authorizationId: authResult.authorizationId,
        status: "AUTHORIZED",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to authorize payment" });
  }
};

export const captureMilestonePayment = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can capture payments" });
    }

    if (milestone.status !== "APPROVED") {
      return res.status(400).json({ success: false, error: "Milestone must be APPROVED before capturing payment" });
    }

    const payment = await Payment.findOne({
      projectId: project._id,
      status: { $in: ["AUTHORIZED", "PARTIALLY_CAPTURED"] },
    });

    if (!payment || !payment.authorizationId) {
      return res.status(400).json({ success: false, error: "No active authorization found for this project" });
    }

    const alreadyCaptured = payment.captures.some(
      (c) => c.milestoneId.toString() === milestone._id.toString() && c.status === "COMPLETED"
    );
    if (alreadyCaptured) {
      return res.status(400).json({ success: false, error: "Payment already captured for this milestone" });
    }

    const allMilestones = await Milestone.find({ projectId: project._id });
    const otherUnpaidMilestones = allMilestones.filter(
      (m) => m._id.toString() !== milestone._id.toString() && m.status !== "PAID"
    );
    const isFinal = otherUnpaidMilestones.length === 0;

    const amount = milestone.paymentAmount.toFixed(2);
    const captureIdempotencyKey = `milestone-${milestone._id}-${payment.captures.length}`;

    const captureResult = await captureAuthorization(
      payment.authorizationId,
      amount,
      isFinal,
      captureIdempotencyKey,
      payment.currency || project.currency
    );

    payment.captures.push({
      captureId: captureResult.captureId,
      milestoneId: milestone._id,
      amount: milestone.paymentAmount,
      status: captureResult.status,
      finalCapture: isFinal,
    });

    payment.totalCaptured = payment.captures
      .filter((c) => c.status === "COMPLETED")
      .reduce((sum, c) => sum + c.amount, 0);

    if (isFinal && captureResult.status === "COMPLETED") {
      payment.status = "COMPLETED";
    } else {
      payment.status = "PARTIALLY_CAPTURED";
    }

    await payment.save();

    milestone.status = "PAID";
    await milestone.save();

    const allPaid = allMilestones.every(
      (m) => m._id.toString() === milestone._id.toString() ? true : m.status === "PAID"
    );
    if (allPaid) {
      project.status = "COMPLETED";
      await project.save();
    }

    res.json({
      success: true,
      data: {
        captureId: captureResult.captureId,
        amount: milestone.paymentAmount,
        milestoneId: milestone._id,
        paymentStatus: payment.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to capture payment" });
  }
};

export const getProjectPayments = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const userId = req.user._id.toString();
    const isOwner =
      project.clientId.toString() === userId ||
      (project.freelancerId && project.freelancerId.toString() === userId);

    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const payment = await Payment.findOne({ projectId: project._id });

    res.json({
      success: true,
      data: { payment: payment || null },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch payments" });
  }
};

export const voidProjectPayment = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can void payment" });
    }

    const payment = await Payment.findOne({
      projectId: project._id,
      status: "AUTHORIZED",
    });

    if (!payment || !payment.authorizationId) {
      return res.status(400).json({ success: false, error: "No active authorization to void" });
    }

    await voidAuthorization(payment.authorizationId);

    payment.status = "VOIDED";
    await payment.save();

    res.json({
      success: true,
      data: { message: "Authorization voided", paymentId: payment._id },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to void payment" });
  }
};

