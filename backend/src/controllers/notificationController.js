import Notification from "../models/Notification.js";

export const createNotification = async ({ userId, type, title, message, projectId = null }) => {
  try {
    return await Notification.create({
      userId,
      type,
      title,
      message,
      projectId,
    });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
    return null;
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.notificationId,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      data: { notification },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update notification" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to mark notifications as read" });
  }
};
