const { supabase } = require("../config/supabase");

class FriendRequestService {
  async sendRequest(senderId, { receiverId, requestType, message }) {
    if (senderId === receiverId) throw Object.assign(new Error("Cannot send request to yourself"), { statusCode: 400 });
    const { data: sender } = await supabase.from("users").select("account_status").eq("id", senderId).single();
    if (sender?.account_status === "suspended" || sender?.account_status === "banned") throw Object.assign(new Error("Your account is restricted"), { statusCode: 403 });

    const { data: existing } = await supabase.from("friend_requests").select("id, status").eq("sender_id", senderId).eq("receiver_id", receiverId).single();
    if (existing) {
      if (existing.status === "pending") throw Object.assign(new Error("Friend request already sent"), { statusCode: 400 });
      if (existing.status === "accepted") throw Object.assign(new Error("You are already friends"), { statusCode: 400 });
      const { data, error } = await supabase.from("friend_requests").update({ status: "pending", request_type: requestType, message }).eq("id", existing.id).select().single();
      if (error) throw new Error(error.message);
      await this._notifyRequest(senderId, receiverId);
      return data;
    }

    const { data, error } = await supabase.from("friend_requests").insert({ sender_id: senderId, receiver_id: receiverId, request_type: requestType || "like", message }).select().single();
    if (error) throw new Error(error.message);
    await this._notifyRequest(senderId, receiverId);
    return data;
  }

  async getReceivedRequests(userId, { status = "pending", limit = 20, offset = 0 }) {
    const { data: requests, error } = await supabase.from("friend_requests").select("*").eq("receiver_id", userId).eq("status", status).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    const senderIds = requests.map((r) => r.sender_id);
    if (senderIds.length === 0) return [];
    const [profilesRes, photosRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, biography, location_text, date_of_birth").in("user_id", senderIds),
      supabase.from("profile_photos").select("user_id, photo_url").in("user_id", senderIds).eq("is_primary", true),
    ]);
    return requests.map((req) => {
      const profile = (profilesRes.data || []).find((p) => p.user_id === req.sender_id);
      const photo = (photosRes.data || []).find((p) => p.user_id === req.sender_id);
      const age = profile?.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      return { ...req, sender: { id: req.sender_id, name: profile?.full_name, bio: profile?.biography, location: profile?.location_text, photo: photo?.photo_url, age } };
    });
  }

  async getSentRequests(userId, { limit = 20, offset = 0 }) {
    const { data, error } = await supabase.from("friend_requests").select("*").eq("sender_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return data;
  }

  async acceptRequest(userId, requestId) {
    const { data: request, error: fetchErr } = await supabase.from("friend_requests").select("*").eq("id", requestId).eq("receiver_id", userId).eq("status", "pending").single();
    if (fetchErr || !request) throw Object.assign(new Error("Request not found"), { statusCode: 404 });

    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);
    const senderId = request.sender_id;
    await supabase.from("friends").upsert([{ user_id: userId, friend_id: senderId, status: "active" }, { user_id: senderId, friend_id: userId, status: "active" }], { onConflict: "user_id,friend_id" });

    const u1 = userId < senderId ? userId : senderId;
    const u2 = userId < senderId ? senderId : userId;
    const { data: match } = await supabase.from("matches").upsert({ user1_id: u1, user2_id: u2, is_active: true }, { onConflict: "user1_id,user2_id" }).select().single();
    if (match) await supabase.from("conversations").upsert({ match_id: match.id }, { onConflict: "match_id" });

    await supabase.from("notifications").insert({ user_id: senderId, title: "Request Accepted!", subtitle: "Your friend request was accepted. Start chatting now!", type: "match", metadata: { matched_user_id: userId } });
    return { message: "Request accepted", matchId: match?.id };
  }

  async rejectRequest(userId, requestId) {
    const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", requestId).eq("receiver_id", userId);
    if (error) throw new Error(error.message);
    return { message: "Request rejected" };
  }

  async cancelRequest(userId, requestId) {
    await supabase.from("friend_requests").delete().eq("id", requestId).eq("sender_id", userId);
    return { message: "Request cancelled" };
  }

  async getPendingCount(userId) {
    const { count, error } = await supabase.from("friend_requests").select("id", { count: "exact", head: true }).eq("receiver_id", userId).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { count };
  }

  async _notifyRequest(senderId, receiverId) {
    const { data: senderProfile } = await supabase.from("profiles").select("full_name").eq("user_id", senderId).single();
    await supabase.from("notifications").insert({ user_id: receiverId, title: "New Friend Request", subtitle: (senderProfile?.full_name || "Someone") + " sent you a friend request!", type: "match", metadata: { sender_id: senderId } });
  }
}
module.exports = new FriendRequestService();
