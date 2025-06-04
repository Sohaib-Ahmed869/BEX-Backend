// // controllers/chat.controller.js
// const { Chat, Message, Product, User } = require("../../../models");
// const { Op } = require("sequelize");

// /**
//  * Get or create chat for a product
//  */
// exports.initiateChat = async (req, res) => {
//   try {
//     const { product_id } = req.body;
//     const { buyerId } = req.params;
//     const buyer_id = buyerId;
//     // Get product and seller info
//     const product = await Product.findByPk(product_id, {
//       include: [{ model: User, as: "seller" }],
//     });

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     const seller_id = product.user_id;

//     // Check if buyer is not the same as seller
//     if (buyer_id === seller_id) {
//       return res.status(400).json({ error: "Cannot chat with yourself" });
//     }

//     // Check if chat already exists
//     let chat = await Chat.findOne({
//       where: {
//         product_id,
//         buyer_id,
//         seller_id,
//       },
//       include: [
//         {
//           model: User,
//           as: "buyer",
//           attributes: ["id", "first_name", "last_name"],
//         },
//         {
//           model: User,
//           as: "seller",
//           attributes: ["id", "first_name", "last_name"],
//         },
//         {
//           model: Product,
//           as: "product",
//           attributes: ["id", "title", "images"],
//         },
//       ],
//     });

//     if (!chat) {
//       // Create new chat
//       const chat_name = `${product.title} - Chat`;
//       chat = await Chat.create({
//         product_id,
//         buyer_id,
//         seller_id,
//         chat_name,
//       });

//       // Fetch the chat with associations
//       chat = await Chat.findByPk(chat.id, {
//         include: [
//           {
//             model: User,
//             as: "buyer",
//             attributes: ["id", "first_name", "last_name"],
//           },
//           {
//             model: User,
//             as: "seller",
//             attributes: ["id", "first_name", "last_name"],
//           },
//           {
//             model: Product,
//             as: "product",
//             attributes: ["id", "title", "images"],
//           },
//         ],
//       });
//     }

//     res.json({ chat, message: "Chat initiated successfully", success: true });
//   } catch (error) {
//     console.error("Error initiating chat:", error);
//     res.status(500).json({ error: "Failed to initiate chat" });
//   }
// };

// /**
//  * Get user's chats
//  */
// exports.getUserChats = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const user_id = userId;

//     const chats = await Chat.findAll({
//       where: {
//         [Op.or]: [{ buyer_id: user_id }, { seller_id: user_id }],
//         is_active: true,
//       },
//       include: [
//         {
//           model: User,
//           as: "buyer",
//           attributes: ["id", "first_name", "last_name"],
//         },
//         {
//           model: User,
//           as: "seller",
//           attributes: ["id", "first_name", "last_name"],
//         },
//         {
//           model: Product,
//           as: "product",
//           attributes: ["id", "title", "images"],
//         },
//       ],
//       order: [["last_message_at", "DESC"]],
//     });

//     res.json({ chats });
//   } catch (error) {
//     console.error("Error fetching chats:", error);
//     res.status(500).json({ error: "Failed to fetch chats" });
//   }
// };

// /**
//  * Get chat messages
//  */
// exports.getChatMessages = async (req, res) => {
//   try {
//     const { chatId } = req.params;
//     const { page = 1, limit = 50 } = req.query;
//     const { userId } = req.params;
//     const user_id = userId;

//     // Verify user is part of this chat
//     const chat = await Chat.findOne({
//       where: {
//         id: chatId,
//         [Op.or]: [{ buyer_id: user_id }, { seller_id: user_id }],
//       },
//     });

//     if (!chat) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const offset = (page - 1) * limit;
//     const messages = await Message.findAll({
//       where: { chat_id: chatId },
//       include: [
//         {
//           model: User,
//           as: "sender",
//           attributes: ["id", "first_name", "last_name"],
//         },
//       ],
//       order: [["created_at", "DESC"]],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//     });

//     // Mark messages as read for the current user
//     await Message.update(
//       { is_read: true, read_at: new Date() },
//       {
//         where: {
//           chat_id: chatId,
//           sender_id: { [Op.ne]: user_id },
//           is_read: false,
//         },
//       }
//     );

//     res.json({ messages: messages.reverse() });
//   } catch (error) {
//     console.error("Error fetching messages:", error);
//     res.status(500).json({ error: "Failed to fetch messages" });
//   }
// };

// /**
//  * Send message
//  */
// exports.sendMessage = async (req, res) => {
//   try {
//     const { chatId } = req.params;
//     const { sender_id, message, message_type = "text" } = req.body;

//     // Verify user is part of this chat
//     const chat = await Chat.findOne({
//       where: {
//         id: chatId,
//         [Op.or]: [{ buyer_id: sender_id }, { seller_id: sender_id }],
//       },
//     });

//     if (!chat) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     // Create message
//     const newMessage = await Message.create({
//       chat_id: chatId,
//       sender_id,
//       message,
//       message_type,
//     });

//     // Update chat's last message
//     await Chat.update(
//       {
//         last_message: message,
//         last_message_at: new Date(),
//       },
//       { where: { id: chatId } }
//     );

//     // Fetch message with sender info
//     const messageWithSender = await Message.findByPk(newMessage.id, {
//       include: [
//         {
//           model: User,
//           as: "sender",
//           attributes: ["id", "first_name", "last_name"],
//         },
//       ],
//     });

//     res.json({ message: messageWithSender });
//   } catch (error) {
//     console.error("Error sending message:", error);
//     res.status(500).json({ error: "Failed to send message" });
//   }
// };
// controllers/chat.controller.js
const { Chat, Message, Product, User } = require("../../../models");
const { Op } = require("sequelize");

/**
 * Get or create chat for a product
 */
exports.initiateChat = async (req, res) => {
  try {
    const { product_id } = req.body;
    const { buyerId } = req.params;
    const buyer_id = buyerId;

    // Get product and seller info
    const product = await Product.findByPk(product_id, {
      include: [{ model: User, as: "seller" }],
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const seller_id = product.user_id;

    // Check if buyer is not the same as seller
    if (buyer_id === seller_id) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      where: {
        product_id,
        buyer_id,
        seller_id,
      },
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: User,
          as: "seller",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "images"],
        },
      ],
    });

    if (!chat) {
      // Create new chat
      const chat_name = `${product.title} - Chat`;
      chat = await Chat.create({
        product_id,
        buyer_id,
        seller_id,
        chat_name,
      });

      // Fetch the chat with associations
      chat = await Chat.findByPk(chat.id, {
        include: [
          {
            model: User,
            as: "buyer",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: User,
            as: "seller",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: Product,
            as: "product",
            attributes: ["id", "title", "images"],
          },
        ],
      });
    }

    res.json({ chat, message: "Chat initiated successfully", success: true });
  } catch (error) {
    console.error("Error initiating chat:", error);
    res.status(500).json({ error: "Failed to initiate chat" });
  }
};

/**
 * Get user's chats with unread count
 */
exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;
    const user_id = userId;

    const chats = await Chat.findAll({
      where: {
        [Op.or]: [{ buyer_id: user_id }, { seller_id: user_id }],
        is_active: true,
      },
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: User,
          as: "seller",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "images"],
        },
      ],
      order: [["last_message_at", "DESC"]],
    });

    // Calculate unread count for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.count({
          where: {
            chat_id: chat.id,
            sender_id: { [Op.ne]: user_id }, // Messages not sent by current user
            is_read: false,
          },
        });

        return {
          ...chat.toJSON(),
          unread_count: unreadCount,
        };
      })
    );

    res.json({ chats: chatsWithUnreadCount });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
};

/**
 * Get chat messages - DON'T mark as read automatically
 */
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const { userId } = req.params;
    const user_id = userId;

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        [Op.or]: [{ buyer_id: user_id }, { seller_id: user_id }],
      },
    });

    if (!chat) {
      return res.status(403).json({ error: "Access denied" });
    }

    const offset = (page - 1) * limit;
    const messages = await Message.findAll({
      where: { chat_id: chatId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // DON'T mark as read here - let the frontend/socket handle it explicitly

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/**
 * Mark messages as read - separate endpoint
 */
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.params;
    const user_id = userId;

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        [Op.or]: [{ buyer_id: user_id }, { seller_id: user_id }],
      },
    });

    if (!chat) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Mark messages as read for the current user
    const [updatedCount] = await Message.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          chat_id: chatId,
          sender_id: { [Op.ne]: user_id },
          is_read: false,
        },
      }
    );

    res.json({
      success: true,
      message: "Messages marked as read",
      updatedCount,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
};

/**
 * Send message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sender_id, message, message_type = "text" } = req.body;

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        [Op.or]: [{ buyer_id: sender_id }, { seller_id: sender_id }],
      },
    });

    if (!chat) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create message
    const newMessage = await Message.create({
      chat_id: chatId,
      sender_id,
      message,
      message_type,
      is_read: false, // Explicitly set as unread
    });

    // Update chat's last message
    await Chat.update(
      {
        last_message: message,
        last_message_at: new Date(),
      },
      { where: { id: chatId } }
    );

    // Fetch message with sender info
    const messageWithSender = await Message.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
    });

    res.json({ message: messageWithSender });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};
