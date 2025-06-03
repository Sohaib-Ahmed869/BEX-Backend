// routes/chat.js
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// All chat routes are protected

// Get or create chat for a product
router.post("/initiate/:buyerId", chatController.initiateChat);

// Get user's chats

// Get chat messages
router.get("/:chatId/messages/:userId", chatController.getChatMessages);

// Send message
router.post("/:chatId/messages", chatController.sendMessage);
router.get("/:userId", chatController.getUserChats);

module.exports = router;
