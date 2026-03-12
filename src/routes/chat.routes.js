const express = require("express");
const router = express.Router();
const Joi = require("joi");
const chatController = require("../controllers/chat.controller");
const { authenticate, requireActiveAccount } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  messageType: Joi.string().valid("text", "image", "video").default("text"),
});

router.use(authenticate);

router.get("/conversations", chatController.getConversations);
router.get("/:conversationId/messages", chatController.getMessages);
router.post("/:conversationId/messages", requireActiveAccount, validate(sendMessageSchema), chatController.sendMessage);
router.put("/:conversationId/read", chatController.markAsRead);
router.delete("/:conversationId/clear", chatController.clearChat);

module.exports = router;
