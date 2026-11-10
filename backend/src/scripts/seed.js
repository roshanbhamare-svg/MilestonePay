import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import Submission from "../models/Submission.js";
import Payment from "../models/Payment.js";
import Notification from "../models/Notification.js";

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log("Clearing existing demo data...");
    await User.deleteMany({ email: { $in: ["client@milestonepay.com", "freelancer@milestonepay.com"] } });

    console.log("Creating demo users...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("password123", salt);

    const client = await User.create({
      name: "Alex Client",
      email: "client@milestonepay.com",
      passwordHash,
      role: "client",
      profile: {
        bio: "Product Manager looking for full-stack developers.",
        skills: ["Product Strategy", "Management"],
      },
    });

    const freelancer = await User.create({
      name: "Sam Freelancer",
      email: "freelancer@milestonepay.com",
      passwordHash,
      role: "freelancer",
      profile: {
        bio: "Senior Full Stack & AI Developer specializing in MERN and LangChain.",
        skills: ["React", "Node.js", "MongoDB", "Express", "PayPal SDK"],
      },
    });

    console.log("Creating demo project...");
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    const project = await Project.create({
      title: "AI-Powered SaaS Dashboard",
      description: "A complete responsive SaaS web application featuring user auth, payments, and AI analytics.",
      budget: 300,
      currency: "USD",
      deadline,
      clientId: client._id,
      freelancerId: freelancer._id,
      status: "ACTIVE",
      agreement: {
        clientAccepted: true,
        freelancerAccepted: true,
        acceptedAt: new Date(),
      },
    });

    console.log("Creating demo milestones...");
    const m1Deadline = new Date();
    m1Deadline.setDate(m1Deadline.getDate() + 7);

    const m2Deadline = new Date();
    m2Deadline.setDate(m2Deadline.getDate() + 15);

    const m3Deadline = new Date();
    m3Deadline.setDate(m3Deadline.getDate() + 30);

    const m1 = await Milestone.create({
      projectId: project._id,
      title: "Frontend Architecture & Setup",
      description: "Setup React Vite repo, configure Tailwind/CSS components, and setup dashboard layout.",
      paymentAmount: 80,
      deadline: m1Deadline,
      deliverables: [
        { title: "React repo structure", description: "Vite + React with clean folders" },
        { title: "Dashboard layout", description: "Responsive sidebar and header" },
      ],
      acceptanceCriteria: [
        { criteria: "Responsive on mobile and desktop", completed: true },
        { criteria: "Clean build without warnings", completed: true },
      ],
      order: 1,
      status: "PAID",
    });

    const m2 = await Milestone.create({
      projectId: project._id,
      title: "Authentication & Database Integration",
      description: "Implement user authentication with JWT, bcrypt password hashing, and user profiles.",
      paymentAmount: 100,
      deadline: m2Deadline,
      deliverables: [
        { title: "Auth APIs", description: "Register, login, profile endpoints" },
        { title: "MongoDB Schemas", description: "Users and roles configured" },
      ],
      acceptanceCriteria: [
        { criteria: "JWT token issuance and verification", completed: true },
        { criteria: "Password hashed with bcrypt", completed: true },
        { criteria: "Protected route middleware working", completed: false },
      ],
      order: 2,
      status: "UNDER_REVIEW",
    });

    const m3 = await Milestone.create({
      projectId: project._id,
      title: "Payment Gateway & Webhook Notifications",
      description: "Connect PayPal authorization and milestone captures, verify webhook signatures.",
      paymentAmount: 120,
      deadline: m3Deadline,
      deliverables: [
        { title: "PayPal Order & Authorize", description: "Hold project funds securely" },
        { title: "Milestone Captures", description: "Partial capture per milestone" },
      ],
      acceptanceCriteria: [
        { criteria: "Payment authorized via PayPal Sandbox", completed: false },
        { criteria: "Captures executed only after client approval", completed: false },
      ],
      order: 3,
      status: "PENDING",
    });

    console.log("Creating demo submission...");
    const submission = await Submission.create({
      milestoneId: m2._id,
      submittedBy: freelancer._id,
      githubUrl: "https://github.com/roshanbhamare-svg/MilestonePay",
      files: [
        {
          filename: "architecture_diagram.png",
          url: "https://example.com/files/diagram.png",
          fileType: "image",
        },
      ],
      notes: "Implemented complete auth system, JWT tokens, and user profile endpoints.",
      version: 1,
      status: "UNDER_REVIEW",
    });

    console.log("Creating demo payment record...");
    await Payment.create({
      projectId: project._id,
      clientId: client._id,
      freelancerId: freelancer._id,
      paypalOrderId: "DEMO-ORDER-12345",
      authorizationId: "DEMO-AUTH-67890",
      totalAuthorized: 300,
      totalCaptured: 80,
      currency: "USD",
      captures: [
        {
          captureId: "DEMO-CAPTURE-001",
          milestoneId: m1._id,
          amount: 80,
          status: "COMPLETED",
          finalCapture: false,
          capturedAt: new Date(),
        },
      ],
      status: "PARTIALLY_CAPTURED",
    });

    console.log("Creating demo notifications...");
    await Notification.create([
      {
        userId: client._id,
        type: "MILESTONE_SUBMITTED",
        title: "Milestone 2 Submitted",
        message: "Sam Freelancer submitted deliverables for Milestone 2: Authentication & Database Integration.",
        projectId: project._id,
      },
      {
        userId: freelancer._id,
        type: "PAYMENT_CAPTURED",
        title: "Payment Released",
        message: "Payment of $80 for Milestone 1 has been captured and released.",
        projectId: project._id,
      },
    ]);

    console.log("\n=================================");
    console.log("Demo seed data created successfully!");
    console.log("=================================");
    console.log("Demo Client:     client@milestonepay.com     / password123");
    console.log("Demo Freelancer: freelancer@milestonepay.com / password123");
    console.log("Project ID:     ", project._id.toString());
    console.log("=================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
};

seedData();

