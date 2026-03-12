const { supabase } = require("../config/supabase");

class NotificationService {
  async getNotifications(userId, { limit = 30, offset = 0 }) {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, subtitle, type, is_read, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data;
  }

  async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    return { count };
  }

  async markAsRead(userId, notificationId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { message: "Notification marked as read" };
  }

  async markAllAsRead(userId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    return { message: "All notifications marked as read" };
  }

  async deleteNotification(userId, notificationId) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { message: "Notification deleted" };
  }
}

module.exports = new NotificationService();
