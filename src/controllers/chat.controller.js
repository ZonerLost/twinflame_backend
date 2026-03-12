const chatService = require("../services/chat.service");
const { successResponse } = require("../utils/helpers");

async function getConversations(req, res, next) {
  try {
    const data = await chatService.getConversations(req.userId);
    return successResponse(res, data, "Conversations retrieved");
  } catch (err) { next(err); }
}

async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { limit, offset } = req.query;
    const data = await chatService.getMessages(req.userId, conversationId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    return successResponse(res, data, "Messages retrieved");
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { content, messageType } = req.body;
    const data = await chatService.sendMessage(req.userId, conversationId, { content, messageType });
    return successResponse(res, data, "Message sent", 201);
  } catch (err) { next(err); }
}

async function markAsRead(req, res, next) {
  try {
    const { conversationId } = req.params;
    const data = await chatService.markAsRead(req.userId, conversationId);
    return successResponse(res, data, "Messages marked as read");
  } catch (err) { next(err); }
}

async function clearChat(req, res, next) {
  try {
    const { conversationId } = req.params;
    const data = await chatService.clearChat(req.userId, conversationId);
    return successResponse(res, data, "Chat cleared");
  } catch (err) { next(err); }
}

module.exports = { getConversations, getMessages, sendMessage, markAsRead, clearChat };
