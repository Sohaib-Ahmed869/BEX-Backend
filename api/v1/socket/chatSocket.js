// socket/chatSocket.js
const jwt = require("jsonwebtoken");
const { Chat, Message, User, Product } = require("../../../models");
const { Op } = require("sequelize");
const connectedUsers = new Map(); // userId -> socketId
const activeChats = new Map(); // chatId -> Set of userIds

const setupChatSocket = (io) => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      socket.userId = user.id; // Add this for easier access
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User ${socket.user.id} connected`);

    // Add user to connected users
    connectedUsers.set(socket.user.id, socket.id);

    // Join user to their chats
    socket.on("join_chats", async () => {
      try {
        const userChats = await Chat.findAll({
          where: {
            [Op.or]: [
              { buyer_id: socket.user.id },
              { seller_id: socket.user.id },
            ],
            is_active: true,
          },
        });

        userChats.forEach((chat) => {
          socket.join(`chat_${chat.id}`);

          // Track active users in chat
          if (!activeChats.has(chat.id)) {
            activeChats.set(chat.id, new Set());
          }
          activeChats.get(chat.id).add(socket.user.id);
        });

        socket.emit("joined_chats", { chatIds: userChats.map((c) => c.id) });
      } catch (error) {
        console.error("Error joining chats:", error);
      }
    });

    // Handle joining specific chat
    socket.on("join_chat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`User ${socket.userId} joined chat ${chatId}`);

      if (!activeChats.has(chatId)) {
        activeChats.set(chatId, new Set());
      }
      activeChats.get(chatId).add(socket.user.id);

      // Notify other users in the chat that user joined
      socket.to(`chat_${chatId}`).emit("user_joined_chat", {
        userId: socket.user.id,
        userName: `${socket.user.first_name} ${socket.user.last_name}`,
        chatId: chatId,
      });
    });

    // Handle leaving chat
    socket.on("leave_chat", (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`User ${socket.userId} left chat ${chatId}`);

      if (activeChats.has(chatId)) {
        activeChats.get(chatId).delete(socket.user.id);
        if (activeChats.get(chatId).size === 0) {
          activeChats.delete(chatId);
        }
      }

      // Notify other users in the chat that user left
      socket.to(`chat_${chatId}`).emit("user_left_chat", {
        userId: socket.user.id,
        chatId: chatId,
      });
    });

    // Handle sending message
    // socket/chatSocket.js - FIXED send_message handler
    socket.on("send_message", async (data) => {
      try {
        const { chatId, message, messageType = "text" } = data;
        const senderId = socket.userId;

        // Verify user is part of this chat
        const chat = await Chat.findOne({
          where: {
            id: chatId,
            [Op.or]: [{ buyer_id: senderId }, { seller_id: senderId }],
          },
        });

        if (!chat) {
          socket.emit("error", { message: "Access denied to this chat" });
          return;
        }

        // Create message in database
        const newMessage = await Message.create({
          chat_id: chatId,
          sender_id: senderId,
          message,
          message_type: messageType,
          is_read: false, // Important: always false for new messages
        });

        // Update chat's last message
        await Chat.update(
          {
            last_message: message,
            last_message_at: new Date(),
          },
          { where: { id: chatId } }
        );

        // Get message with sender info
        const messageWithSender = await Message.findByPk(newMessage.id, {
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "first_name", "last_name"],
            },
          ],
        });

        // ONLY emit new_message - this handles both message display AND chat list update
        io.to(`chat_${chatId}`).emit("new_message", {
          message: messageWithSender,
          chatId: chatId,
        });

        // Send success response to sender
        socket.emit("message_sent", {
          success: true,
          message: messageWithSender,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing", (data) => {
      const { chatId, isTyping } = data;
      socket.to(`chat_${chatId}`).emit("user_typing", {
        userId: socket.user.id,
        userName: `${socket.user.first_name} ${socket.user.last_name}`,
        isTyping,
      });
    });

    // Handle message read status
    socket.on("mark_messages_read", async (data) => {
      try {
        const { chatId } = data;
        const userId = socket.userId;

        // Verify user is part of the chat
        const chat = await Chat.findOne({
          where: {
            id: chatId,
            [Op.or]: [{ buyer_id: userId }, { seller_id: userId }],
          },
        });

        if (!chat) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        // Mark messages as read
        const [updatedCount] = await Message.update(
          { is_read: true, read_at: new Date() },
          {
            where: {
              chat_id: chatId,
              sender_id: { [Op.ne]: userId }, // Messages not sent by current user
              is_read: false,
            },
          }
        );

        console.log(
          `Marked ${updatedCount} messages as read in chat ${chatId} for user ${userId}`
        );

        // Emit to all users in the chat that messages have been read
        io.to(`chat_${chatId}`).emit("messages_read", {
          chatId: chatId,
          userId: userId,
          readBy: userId, // Keep this for backward compatibility
          updatedCount: updatedCount,
        });
      } catch (error) {
        console.error("Error marking messages as read:", error);
        socket.emit("error", { message: "Failed to mark messages as read" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User ${socket.user.id} disconnected`);

      // Remove from connected users
      connectedUsers.delete(socket.user.id);

      // Remove from active chats
      activeChats.forEach((users, chatId) => {
        users.delete(socket.user.id);
        if (users.size === 0) {
          activeChats.delete(chatId);
        } else {
          // Notify others in chat that user left
          socket.to(`chat_${chatId}`).emit("user_left_chat", {
            userId: socket.user.id,
          });
        }
      });
    });
  });
};

module.exports = { setupChatSocket };
