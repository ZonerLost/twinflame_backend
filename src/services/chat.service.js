const { supabase } = require("../config/supabase");

class ChatService {
  // ---- GET CONVERSATIONS ----
  async getConversations(userId) {
    // Get all matches for the user
    const { data: matches } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("is_active", true);

    if (!matches || matches.length === 0) return [];

    const matchIds = matches.map((m) => m.id);

    // Get conversations for these matches
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, match_id, last_message_text, last_message_at")
      .in("match_id", matchIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);

    // Get other user info for each conversation
    const result = [];

    for (const conv of conversations) {
      const match = matches.find((m) => m.id === conv.match_id);
      const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

      const [profileRes, photoRes, userRes, unreadRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", otherUserId).single(),
        supabase.from("profile_photos").select("photo_url").eq("user_id", otherUserId).eq("is_primary", true).single(),
        supabase.from("users").select("last_seen").eq("id", otherUserId).single(),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", userId),
      ]);

      const isOnline = userRes.data?.last_seen
        ? (Date.now() - new Date(userRes.data.last_seen).getTime()) < 5 * 60 * 1000
        : false;

      result.push({
        conversationId: conv.id,
        matchId: conv.match_id,
        lastMessage: conv.last_message_text,
        lastMessageAt: conv.last_message_at,
        unreadCount: unreadRes.count || 0,
        user: {
          id: otherUserId,
          name: profileRes.data?.full_name,
          photo: photoRes.data?.photo_url,
          online: isOnline,
        },
      });
    }

    return result;
  }

  // ---- GET MESSAGES ----
  async getMessages(userId, conversationId, { limit = 50, offset = 0 }) {
    // Verify user belongs to this conversation
    await this._verifyConversationAccess(userId, conversationId);

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, message_type, is_read, read_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return messages.map((msg) => ({
      id: msg.id,
      text: msg.content,
      isMe: msg.sender_id === userId,
      time: msg.created_at,
      isRead: msg.is_read,
      readAt: msg.read_at,
      type: msg.message_type,
    }));
  }

  // ---- SEND MESSAGE ----
  async sendMessage(userId, conversationId, { content, messageType = "text" }) {
    await this._verifyConversationAccess(userId, conversationId);

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: messageType,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Update conversation's last message
    await supabase
      .from("conversations")
      .update({
        last_message_text: content,
        last_message_at: message.created_at,
      })
      .eq("id", conversationId);

    // Create notification for the other user
    const otherUserId = await this._getOtherUserId(userId, conversationId);

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    await supabase.from("notifications").insert({
      user_id: otherUserId,
      title: "New Message",
      subtitle: `${senderProfile?.full_name || "Someone"}: ${content.substring(0, 50)}`,
      type: "message",
      metadata: { conversation_id: conversationId, sender_id: userId },
    });

    return {
      id: message.id,
      text: message.content,
      isMe: true,
      time: message.created_at,
      isRead: false,
      type: message.message_type,
    };
  }

  // ---- MARK MESSAGES AS READ ----
  async markAsRead(userId, conversationId) {
    await this._verifyConversationAccess(userId, conversationId);

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    return { message: "Messages marked as read" };
  }

  // ---- CLEAR CHAT ----
  async clearChat(userId, conversationId) {
    await this._verifyConversationAccess(userId, conversationId);

    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    await supabase
      .from("conversations")
      .update({ last_message_text: null, last_message_at: null })
      .eq("id", conversationId);

    return { message: "Chat cleared" };
  }

  // ---- HELPERS ----
  async _verifyConversationAccess(userId, conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("match_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
    }

    const { data: match } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .eq("id", conversation.match_id)
      .single();

    if (!match || (match.user1_id !== userId && match.user2_id !== userId)) {
      throw Object.assign(new Error("Access denied to this conversation"), { statusCode: 403 });
    }

    return match;
  }

  async _getOtherUserId(userId, conversationId) {
    const match = await this._verifyConversationAccess(userId, conversationId);
    return match.user1_id === userId ? match.user2_id : match.user1_id;
  }
}

module.exports = new ChatService();
