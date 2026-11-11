import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("Server authentication is not configured (missing JWT_SECRET)");
    err.statusCode = 503;
    throw err;
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }

    if (!["client", "freelancer"].includes(role)) {
      return res.status(400).json({ success: false, error: "Role must be client or freelancer" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        success: false,
        error: "Server authentication is not configured (missing JWT_SECRET)",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    console.error("[Auth Controller] Registration failed:", err?.message || err);
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode ? err.message : "Registration failed",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        success: false,
        error: "Server authentication is not configured (missing JWT_SECRET)",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    console.error("[Auth Controller] Login failed:", err?.message || err);
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode ? err.message : "Login failed",
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: { user: req.user },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, bio, skills, avatar } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData["profile.bio"] = bio;
    if (skills !== undefined) updateData["profile.skills"] = skills;
    if (avatar !== undefined) updateData["profile.avatar"] = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
};

