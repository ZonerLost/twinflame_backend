const { supabase } = require("../config/supabase");

class ModerationService {
  async checkTextContent(text) {
    if (!text) return { isClean: true, flaggedWords: [] };
    const { data: bannedWords } = await supabase.from("banned_words").select("word");
    const words = (bannedWords || []).map((w) => w.word.toLowerCase());
    const textLower = text.toLowerCase();
    const flaggedWords = words.filter((w) => textLower.includes(w));
    return { isClean: flaggedWords.length === 0, flaggedWords };
  }

  async reportUser(reporterId, { reportedUserId, reason, description }) {
    if (reporterId === reportedUserId) throw Object.assign(new Error("Cannot report yourself"), { statusCode: 400 });
    const { data: existing } = await supabase.from("reports").select("id").eq("reporter_id", reporterId).eq("reported_user_id", reportedUserId).eq("status", "pending").single();
    if (existing) throw Object.assign(new Error("You have already reported this user"), { statusCode: 400 });
    const { data, error } = await supabase.from("reports").insert({ reporter_id: reporterId, reported_user_id: reportedUserId, reason, description }).select().single();
    if (error) throw new Error(error.message);
    await this._logAction(reportedUserId, null, "user_reported", "Reported for: " + reason);
    return data;
  }

  async getReports({ status, limit = 20, offset = 0 }) {
    let query = supabase.from("reports").select("*").range(offset, offset + limit - 1).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async resolveReport(moderatorId, { reportId, status, action }) {
    const { data: report, error } = await supabase.from("reports").update({ status }).eq("id", reportId).select().single();
    if (error) throw new Error(error.message);
    if (action === "suspend") await this.suspendAccount(moderatorId, report.reported_user_id, "Report resolved - account suspended");
    else if (action === "ban") await this.banAccount(moderatorId, report.reported_user_id, "Report resolved - account banned");
    return report;
  }

  async approveContent(moderatorId, { contentType, contentId }) {
    if (contentType === "photo") await supabase.from("profile_photos").update({ moderation_status: "approved" }).eq("id", contentId);
    else if (contentType === "bio") await supabase.from("profiles").update({ bio_moderation_status: "approved" }).eq("id", contentId);
    let userId;
    if (contentType === "photo") { const { data } = await supabase.from("profile_photos").select("user_id").eq("id", contentId).single(); userId = data?.user_id; }
    else { const { data } = await supabase.from("profiles").select("user_id").eq("id", contentId).single(); userId = data?.user_id; }
    if (userId) await this._logAction(userId, moderatorId, "content_approved", contentType + " approved");
    return { message: "Content approved" };
  }

  async rejectContent(moderatorId, { contentType, contentId, reason }) {
    if (contentType === "photo") await supabase.from("profile_photos").update({ moderation_status: "rejected", rejection_reason: reason }).eq("id", contentId);
    else if (contentType === "bio") await supabase.from("profiles").update({ bio_moderation_status: "rejected" }).eq("id", contentId);
    let userId;
    if (contentType === "photo") { const { data } = await supabase.from("profile_photos").select("user_id").eq("id", contentId).single(); userId = data?.user_id; }
    else { const { data } = await supabase.from("profiles").select("user_id").eq("id", contentId).single(); userId = data?.user_id; }
    if (userId) await this._logAction(userId, moderatorId, "content_rejected", reason || contentType + " rejected");
    return { message: "Content rejected" };
  }

  async suspendAccount(moderatorId, userId, reason) {
    await supabase.from("users").update({ account_status: "suspended" }).eq("id", userId);
    await this._logAction(userId, moderatorId, "account_suspended", reason);
    await supabase.from("notifications").insert({ user_id: userId, title: "Account Suspended", subtitle: "Your account has been suspended. Contact support for more info.", type: "system" });
    return { message: "Account suspended" };
  }

  async banAccount(moderatorId, userId, reason) {
    await supabase.from("users").update({ account_status: "banned" }).eq("id", userId);
    await supabase.from("user_subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
    await this._logAction(userId, moderatorId, "account_banned", reason);
    return { message: "Account banned" };
  }

  async reactivateAccount(moderatorId, userId, reason) {
    await supabase.from("users").update({ account_status: "active" }).eq("id", userId);
    await this._logAction(userId, moderatorId, "account_reactivated", reason);
    return { message: "Account reactivated" };
  }

  async getModerationLogs({ userId, limit = 50, offset = 0 }) {
    let query = supabase.from("moderation_logs").select("*").range(offset, offset + limit - 1).order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async getPendingContent({ limit = 20, offset = 0 }) {
    const [photosRes, profilesRes] = await Promise.all([
      supabase.from("profile_photos").select("id, user_id, photo_url, created_at").eq("moderation_status", "pending_review").range(offset, offset + limit - 1).order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, user_id, biography, created_at").eq("bio_moderation_status", "pending_review").not("biography", "is", null).range(offset, offset + limit - 1).order("created_at", { ascending: true }),
    ]);
    return { photos: photosRes.data || [], bios: profilesRes.data || [] };
  }

  async getAccountStatus(userId) {
    const { data, error } = await supabase.from("users").select("account_status").eq("id", userId).single();
    if (error) throw new Error(error.message);
    return data;
  }

  async _logAction(userId, moderatorId, action, reason) {
    await supabase.from("moderation_logs").insert({ user_id: userId, moderator_id: moderatorId, action, reason });
  }
}
module.exports = new ModerationService();
