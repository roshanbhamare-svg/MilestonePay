import User from "../models/User.js";

export const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: "freelancer" }).select(
      "name email profile"
    );

    res.json({
      success: true,
      data: { freelancers },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch freelancers" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("name email role profile");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
};

