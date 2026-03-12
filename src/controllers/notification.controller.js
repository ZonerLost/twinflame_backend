const notificationService = require("../services/notification.service");
const { successResponse } = require("../utils/helpers");

async function getNotifications(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const data = await notificationService.getNotifications(req.userId, {
      limit: parseInt(limit) || 30,
      offset: parseInt(offset) || 0,
    });
    return successResponse(res, data, "Notifications retrieved");
  } catch (err) { next(err); }
}

async function getUnreadCount(req, res, next) {
  try {
    const data = await notificationService.getUnreadCount(req.userId);
    return successResponse(res, data, "Unread count retrieved");
  } catch (err) { next(err); }
}

async function markAsRead(req, res, next) {
  try {
    const data = await notificationService.markAsRead(req.userId, req.params.notificationId);
    return successResponse(res, data, "Marked as read");
  } catch (err) { next(err); }
}

async function markAllAsRead(req, res, next) {
  try {
    const data = await notificationService.markAllAsRead(req.userId);
    return successResponse(res, data, "All marked as read");
  } catch (err) { next(err); }
}

async function deleteNotification(req, res, next) {
  try {
    const data = await notificationService.deleteNotification(req.userId, req.params.notificationId);
    return successResponse(res, data, "Notification deleted");
  } catch (err) { next(err); }
}

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };
