const { supabase } = require("../config/supabase");

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

function initializeSocket(io) {
  // Auth middleware — verify Supabase JWT on socket connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return next(new Error("Invalid token"));
      }
      socket.userId = data.user.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update last_seen
    supabase.from("users").update({ last_seen: new Date().toISOString() }).eq("id", userId).then();

    // Broadcast online status
    socket.broadcast.emit("user:online", { userId });

    // ---- JOIN CONVERSATION ROOM ----
    socket.on("chat:join", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    // ---- LEAVE CONVERSATION ROOM ----
    socket.on("chat:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ---- SEND MESSAGE (real-time) ----
    socket.on("chat:message", async ({ conversationId, content, messageType = "text" }) => {
      try {
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

        if (error) {
          socket.emit("chat:error", { message: error.message });
          return;
        }

        // Update conversation
        await supabase
          .from("conversations")
          .update({ last_message_text: content, last_message_at: message.created_at })
          .eq("id", conversationId);

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit("chat:message", {
          id: message.id,
          conversationId,
          senderId: userId,
          text: content,
          type: messageType,
          time: message.created_at,
          isRead: false,
        });
      } catch (err) {
        socket.emit("chat:error", { message: err.message });
      }
    });

    // ---- TYPING INDICATOR ----
    socket.on("chat:typing", ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit("chat:typing", {
        userId,
        conversationId,
        isTyping,
      });
    });

    // ---- MARK AS READ (real-time) ----
    socket.on("chat:read", async ({ conversationId }) => {
      await supabase
        .from("messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .eq("is_read", false);

      socket.to(`conversation:${conversationId}`).emit("chat:read", {
        conversationId,
        readBy: userId,
      });
    });

    // ---- DISCONNECT ----
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          supabase.from("users").update({ last_seen: new Date().toISOString() }).eq("id", userId).then();
          socket.broadcast.emit("user:offline", { userId });
        }
      }
    });
  });
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

module.exports = { initializeSocket, isUserOnline };
