const {
  Order,
  OrderItem,
  Product,
  User,
  OrderDispute,
} = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");

// Create a new dispute
exports.createDispute = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      userId,
      email,
      disputeCategory,
      description,
      orderId,
      orderItemId,
      productId,
    } = req.body;

    // Validate required fields
    if (
      !userId ||
      !email ||
      !disputeCategory ||
      !description ||
      !orderId ||
      !orderItemId ||
      !productId
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Get user details from User model
    const user = await User.findByPk(userId, {
      attributes: ["id", "first_name", "last_name", "email"],
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Construct full name from user model
    const userName = `${user.first_name} ${user.last_name}`;

    // Verify that the order item exists and belongs to the user
    const orderItem = await OrderItem.findOne({
      where: { id: orderItemId },
      include: [
        {
          model: Order,
          as: "order",
          where: {
            id: orderId,
          },
        },
        {
          model: Product,
          as: "product",
          where: { id: productId },
        },
      ],
      transaction,
    });

    if (!orderItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Order item not found or does not belong to the user",
      });
    }

    // Check if a dispute already exists for this order item
    const existingDispute = await OrderDispute.findOne({
      where: {
        order_item_id: orderItemId,
        dispute_status: { [Op.in]: ["open", "in_progress"] },
      },
      transaction,
    });

    if (existingDispute) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "An active dispute already exists for this order item",
      });
    }

    // Create initial response (user's complaint)
    const initialResponse = {
      id: require("crypto").randomUUID(),
      sender_type: "buyer",
      sender_id: userId,
      sender_name: userName,
      message: description,
      timestamp: new Date().toISOString(),
      created_at: new Date(),
    };

    // Create the dispute with initial response
    const dispute = await OrderDispute.create(
      {
        user_id: userId,
        user_name: userName,
        email: email,
        dispute_category: disputeCategory,
        description: description,
        order_id: orderId,
        order_item_id: orderItemId,
        product_id: productId,
        responses: [initialResponse],
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Dispute created successfully",
      data: {
        disputeId: dispute.id,
        disputeStatus: dispute.dispute_status,
        userName: userName,
        createdAt: dispute.created_at,
        totalResponses: 1,
        waitingFor: "admin",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Create dispute error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating dispute",
      error: error.message,
    });
  }
};

// Add response to dispute (for both admin and user)
exports.addDisputeResponse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { disputeId } = req.params;
    const { message, userId, userRole, userName } = req.body;

    // Validate required fields
    if (!message || !userId || !userRole || !userName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Message, userId, userRole, and userName are required",
      });
    }

    // Validate role
    if (!["admin", "buyer"].includes(userRole)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid user role. Must be 'admin' or 'buyer'",
      });
    }

    // Find the dispute
    const dispute = await OrderDispute.findByPk(disputeId, { transaction });

    if (!dispute) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // Check if user has permission to respond
    if (userRole === "buyer" && dispute.user_id !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You don't have permission to respond to this dispute",
      });
    }

    // Check if dispute is still active
    if (["resolved", "closed", "rejected"].includes(dispute.dispute_status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot add response to ${dispute.dispute_status} dispute`,
      });
    }

    // Create new response
    const newResponse = {
      id: require("crypto").randomUUID(),
      sender_type: userRole,
      sender_id: userId,
      sender_name: userName,
      message: message,
      timestamp: new Date().toISOString(),
      created_at: new Date(),
    };

    // Add response to existing responses
    const currentResponses = dispute.responses || [];
    const updatedResponses = [...currentResponses, newResponse];

    // Update dispute status if admin is responding for the first time
    let updateData = {
      responses: updatedResponses,
    };

    if (userRole === "admin" && dispute.dispute_status === "open") {
      updateData.dispute_status = "in_progress";
    }

    // Update the dispute
    await OrderDispute.update(updateData, {
      where: { id: disputeId },
      transaction,
    });

    await transaction.commit();

    // Determine who should respond next
    const waitingFor = userRole === "admin" ? "buyer" : "admin";

    res.status(200).json({
      success: true,
      message: "Response added successfully",
      data: {
        disputeId: disputeId,
        responseId: newResponse.id,
        senderType: newResponse.sender_type,
        senderName: newResponse.sender_name,
        message: newResponse.message,
        timestamp: newResponse.timestamp,
        disputeStatus: updateData.dispute_status || dispute.dispute_status,
        totalResponses: updatedResponses.length,
        waitingFor: waitingFor,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Add dispute response error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding response",
      error: error.message,
    });
  }
};

// Get dispute chat/conversation
exports.getDisputeChat = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const dispute = await OrderDispute.findByPk(disputeId, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "order_date", "total_amount"],
        },
        {
          model: OrderItem,
          as: "orderItem",
          attributes: ["id", "title", "price", "quantity", "order_status"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "images", "price"],
          include: [
            {
              model: User,
              as: "seller",
              attributes: ["id", "first_name", "last_name", "email"],
            },
          ],
        },
      ],
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // Sort responses chronologically
    const responses = (dispute.responses || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Format responses for chat display
    const formattedResponses = responses.map((response) => ({
      id: response.id,
      senderType: response.sender_type,
      senderId: response.sender_id,
      senderName: response.sender_name,
      message: response.message,
      timestamp: response.timestamp,
      formattedTime: new Date(response.timestamp).toLocaleString(),
      isAdmin: response.sender_type === "admin",
      isBuyer: response.sender_type === "buyer",
    }));

    // Determine who should respond next
    const lastResponse = responses[responses.length - 1];
    const waitingFor =
      !lastResponse || lastResponse.sender_type === "buyer" ? "admin" : "buyer";

    const formattedDispute = {
      disputeId: dispute.id,
      disputeCategory: dispute.dispute_category,
      disputeStatus: dispute.dispute_status,
      description: dispute.description,
      createdAt: dispute.created_at,
      updatedAt: dispute.updated_at,
      resolvedAt: dispute.resolved_at,

      user: {
        userId: dispute.user?.id,
        firstName: dispute.user?.first_name,
        lastName: dispute.user?.last_name,
        fullName: dispute.user
          ? `${dispute.user.first_name} ${dispute.user.last_name}`
          : dispute.user_name,
        email: dispute.user?.email || dispute.email,
      },

      order: {
        orderId: dispute.order?.id,
        orderDate: dispute.order?.order_date,
        totalAmount: dispute.order?.total_amount
          ? parseFloat(dispute.order.total_amount)
          : null,
      },

      orderItem: {
        orderItemId: dispute.orderItem?.id,
        title: dispute.orderItem?.title,
        price: dispute.orderItem?.price
          ? parseFloat(dispute.orderItem.price)
          : null,
        quantity: dispute.orderItem?.quantity,
        orderStatus: dispute.orderItem?.order_status,
      },

      product: {
        productId: dispute.product?.id,
        title: dispute.product?.title,
        images: dispute.product?.images,
        price: dispute.product?.price
          ? parseFloat(dispute.product.price)
          : null,
        seller: dispute.product?.seller
          ? {
              id: dispute.product.seller.id,
              firstName: dispute.product.seller.first_name,
              lastName: dispute.product.seller.last_name,
              fullName: `${dispute.product.seller.first_name} ${dispute.product.seller.last_name}`,
              email: dispute.product.seller.email,
            }
          : null,
      },

      // Chat data
      responses: formattedResponses,
      totalResponses: formattedResponses.length,
      waitingFor: waitingFor,
      lastResponseAt: lastResponse
        ? lastResponse.timestamp
        : dispute.created_at,
      canRespond: !["resolved", "closed", "rejected"].includes(
        dispute.dispute_status
      ),
    };

    res.status(200).json({
      success: true,
      data: {
        dispute: formattedDispute,
      },
    });
  } catch (error) {
    console.error("Get dispute chat error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dispute chat",
      error: error.message,
    });
  }
};

// Get user's disputes (updated to include chat info)
exports.getUserDisputes = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, category, startDate, endDate } = req.query;

    // Build where clause for filtering
    let whereClause = { user_id: userId };

    // Status filtering
    if (status) {
      whereClause.dispute_status = status;
    }

    // Category filtering
    if (category) {
      whereClause.dispute_category = category;
    }

    // Date filtering
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      whereClause.created_at = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      whereClause.created_at = {
        [Op.lte]: new Date(endDate),
      };
    }

    const disputes = await OrderDispute.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          as: "order",
          attributes: ["id", "order_date", "total_amount"],
        },
        {
          model: OrderItem,
          as: "orderItem",
          attributes: ["id", "title", "price", "quantity", "order_status"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "images", "price"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const formattedDisputes = disputes.map((dispute) => {
      const responses = dispute.responses || [];
      const lastResponse =
        responses.length > 0 ? responses[responses.length - 1] : null;
      const waitingFor =
        !lastResponse || lastResponse.sender_type === "buyer"
          ? "admin"
          : "buyer";

      return {
        disputeId: dispute.id,
        disputeCategory: dispute.dispute_category,
        disputeStatus: dispute.dispute_status,
        description: dispute.description,
        createdAt: dispute.created_at,
        updatedAt: dispute.updated_at,
        resolvedAt: dispute.resolved_at,

        // Chat info
        totalResponses: responses.length,
        lastResponseAt: lastResponse
          ? lastResponse.timestamp
          : dispute.created_at,
        lastResponseFrom: lastResponse ? lastResponse.sender_type : "buyer",
        waitingFor: waitingFor,
        hasUnreadAdminResponse: responses.some(
          (r) =>
            r.sender_type === "admin" &&
            new Date(r.timestamp) > new Date(dispute.updated_at)
        ),

        order: {
          orderId: dispute.order?.id,
          orderDate: dispute.order?.order_date,
          totalAmount: dispute.order?.total_amount
            ? parseFloat(dispute.order.total_amount)
            : null,
        },

        orderItem: {
          orderItemId: dispute.orderItem?.id,
          title: dispute.orderItem?.title,
          price: dispute.orderItem?.price
            ? parseFloat(dispute.orderItem.price)
            : null,
          quantity: dispute.orderItem?.quantity,
          orderStatus: dispute.orderItem?.order_status,
        },

        product: {
          productId: dispute.product?.id,
          title: dispute.product?.title,
          image: dispute.product?.images?.[0] || null,
          price: dispute.product?.price
            ? parseFloat(dispute.product.price)
            : null,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        disputes: formattedDisputes,
        totalDisputes: formattedDisputes.length,
      },
    });
  } catch (error) {
    console.error("Get user disputes error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user disputes",
      error: error.message,
    });
  }
};

// Admin: Get all disputes (updated to include chat info)
exports.getAllDisputes = async (req, res) => {
  try {
    const {
      status,
      category,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Build where clause for filtering
    let whereClause = {};

    // Status filtering
    if (status) {
      whereClause.dispute_status = status;
    }

    // Category filtering
    if (category) {
      whereClause.dispute_category = category;
    }

    // Date filtering
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      whereClause.created_at = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      whereClause.created_at = {
        [Op.lte]: new Date(endDate),
      };
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: disputes } = await OrderDispute.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "order_date", "total_amount"],
        },
        {
          model: OrderItem,
          as: "orderItem",
          attributes: ["id", "title", "price", "quantity", "order_status"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "images", "price"],
          include: [
            {
              model: User,
              as: "seller",
              attributes: ["id", "first_name", "last_name", "email"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true,
    });

    const formattedDisputes = disputes.map((dispute) => {
      const responses = dispute.responses || [];
      const lastResponse =
        responses.length > 0 ? responses[responses.length - 1] : null;
      const waitingFor =
        !lastResponse || lastResponse.sender_type === "buyer"
          ? "admin"
          : "buyer";

      return {
        disputeId: dispute.id,
        disputeCategory: dispute.dispute_category,
        disputeStatus: dispute.dispute_status,
        description: dispute.description,
        createdAt: dispute.created_at,
        updatedAt: dispute.updated_at,
        resolvedAt: dispute.resolved_at,

        // Chat info
        totalResponses: responses.length,
        lastResponseAt: lastResponse
          ? lastResponse.timestamp
          : dispute.created_at,
        lastResponseFrom: lastResponse ? lastResponse.sender_type : "buyer",
        waitingFor: waitingFor,
        needsAdminResponse: waitingFor === "admin",

        user: {
          userId: dispute.user?.id,
          firstName: dispute.user?.first_name,
          lastName: dispute.user?.last_name,
          fullName: dispute.user
            ? `${dispute.user.first_name} ${dispute.user.last_name}`
            : dispute.user_name,
          email: dispute.user?.email || dispute.email,
        },

        order: {
          orderId: dispute.order?.id,
          orderDate: dispute.order?.order_date,
          totalAmount: dispute.order?.total_amount
            ? parseFloat(dispute.order.total_amount)
            : null,
        },

        orderItem: {
          orderItemId: dispute.orderItem?.id,
          title: dispute.orderItem?.title,
          price: dispute.orderItem?.price
            ? parseFloat(dispute.orderItem.price)
            : null,
          quantity: dispute.orderItem?.quantity,
          orderStatus: dispute.orderItem?.order_status,
        },

        product: {
          productId: dispute.product?.id,
          title: dispute.product?.title,
          image: dispute.product?.images?.[0] || null,
          price: dispute.product?.price
            ? parseFloat(dispute.product.price)
            : null,
          seller: dispute.product?.seller
            ? {
                id: dispute.product.seller.id,
                firstName: dispute.product.seller.first_name,
                lastName: dispute.product.seller.last_name,
                fullName: `${dispute.product.seller.first_name} ${dispute.product.seller.last_name}`,
                email: dispute.product.seller.email,
              }
            : null,
        },
      };
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        disputes: formattedDisputes,
        totalDisputes: count,
        totalPages: totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all disputes error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching disputes",
      error: error.message,
    });
  }
};

// Admin: Update dispute status
exports.updateDisputeStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { disputeId } = req.params;
    const { disputeStatus, adminResponse, adminId, adminName } = req.body;

    // Validate required fields
    if (!disputeStatus) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Dispute status is required",
      });
    }

    // Find the dispute
    const dispute = await OrderDispute.findByPk(disputeId, { transaction });

    if (!dispute) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // Prepare update data
    const updateData = {
      dispute_status: disputeStatus,
    };

    // If resolving or closing, set resolved_at timestamp
    if (disputeStatus === "resolved" || disputeStatus === "closed") {
      updateData.resolved_at = new Date();
    }

    // If admin response is provided, add it to responses array
    if (adminResponse && adminId && adminName) {
      const newResponse = {
        id: require("crypto").randomUUID(),
        sender_type: "admin",
        sender_id: adminId,
        sender_name: adminName,
        message: adminResponse,
        timestamp: new Date().toISOString(),
        created_at: new Date(),
      };

      const currentResponses = dispute.responses || [];
      updateData.responses = [...currentResponses, newResponse];
    }

    // Update the dispute
    await OrderDispute.update(updateData, {
      where: { id: disputeId },
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Dispute updated successfully",
      data: {
        disputeId: disputeId,
        disputeStatus: disputeStatus,
        adminResponse: adminResponse,
        resolvedAt: updateData.resolved_at,
        totalResponses: updateData.responses
          ? updateData.responses.length
          : (dispute.responses || []).length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update dispute status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating dispute",
      error: error.message,
    });
  }
};

// Get single dispute details (updated)
exports.getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;

    // Use the getDisputeChat method for consistency
    return await exports.getDisputeChat(req, res);
  } catch (error) {
    console.error("Get dispute details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dispute details",
      error: error.message,
    });
  }
};

// User: Update dispute (only description can be updated and only if status is 'open')
exports.updateDispute = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { disputeId } = req.params;
    const { description } = req.body;
    const userId = req.body.userId || req.user?.id;

    // Validate required fields
    if (!description) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    // Find the dispute and verify ownership
    const dispute = await OrderDispute.findOne({
      where: {
        id: disputeId,
        user_id: userId,
      },
      transaction,
    });

    if (!dispute) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Dispute not found or you don't have permission to update it",
      });
    }

    // Check if dispute can be updated (only open disputes)
    if (dispute.dispute_status !== "open") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Dispute cannot be updated. Current status: ${dispute.dispute_status}`,
      });
    }

    // Update the dispute
    await OrderDispute.update(
      { description: description },
      {
        where: { id: disputeId },
        transaction,
      }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Dispute updated successfully",
      data: {
        disputeId: disputeId,
        description: description,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update dispute error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating dispute",
      error: error.message,
    });
  }
};

// Get dispute statistics (for admin dashboard)
exports.getDisputeStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      dateFilter.created_at = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      dateFilter.created_at = {
        [Op.lte]: new Date(endDate),
      };
    }

    // Get total disputes
    const totalDisputes = await OrderDispute.count({ where: dateFilter });

    // Get disputes by status
    const disputesByStatus = await OrderDispute.findAll({
      where: dateFilter,
      attributes: [
        "dispute_status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["dispute_status"],
      raw: true,
    });

    // Get disputes by category
    const disputesByCategory = await OrderDispute.findAll({
      where: dateFilter,
      attributes: [
        "dispute_category",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["dispute_category"],
      raw: true,
    });

    // Get recent disputes (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDisputes = await OrderDispute.count({
      where: {
        ...dateFilter,
        created_at: { [Op.gte]: sevenDaysAgo },
      },
    });

    // Get disputes waiting for admin response
    const disputesWaitingForAdmin = await OrderDispute.count({
      where: {
        ...dateFilter,
        dispute_status: { [Op.in]: ["open", "in_progress"] },
      },
    });

    // Get resolved disputes percentage
    const resolvedDisputes = await OrderDispute.count({
      where: {
        ...dateFilter,
        dispute_status: { [Op.in]: ["resolved", "closed"] },
      },
    });

    const resolutionRate =
      totalDisputes > 0
        ? Math.round((resolvedDisputes / totalDisputes) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalDisputes,
        recentDisputes,
        resolutionRate,
        disputesWaitingForAdmin,
        disputesByStatus: disputesByStatus.reduce((acc, item) => {
          acc[item.dispute_status] = parseInt(item.count);
          return acc;
        }, {}),
        disputesByCategory: disputesByCategory.reduce((acc, item) => {
          acc[item.dispute_category] = parseInt(item.count);
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get dispute statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dispute statistics",
      error: error.message,
    });
  }
};
