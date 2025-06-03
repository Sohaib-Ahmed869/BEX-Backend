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

    // Validate required fields (removed userName from validation)
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
    console.log(
      userId,
      email,
      disputeCategory,
      description,
      orderId,
      orderItemId,
      productId
    );
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

    // Create the dispute using the userName from User model
    const dispute = await OrderDispute.create(
      {
        user_id: userId,
        user_name: userName, // Now using the name from User model
        email: email,
        dispute_category: disputeCategory,
        description: description,
        order_id: orderId,
        order_item_id: orderItemId,
        product_id: productId,
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
        userName: userName, // Include the retrieved name in response
        createdAt: dispute.created_at,
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

// Get user's disputes
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

    const formattedDisputes = disputes.map((dispute) => ({
      disputeId: dispute.id,
      disputeCategory: dispute.dispute_category,
      disputeStatus: dispute.dispute_status,
      description: dispute.description,
      adminResponse: dispute.admin_response,
      createdAt: dispute.created_at,
      updatedAt: dispute.updated_at,
      resolvedAt: dispute.resolved_at,

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
    }));

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

// Get single dispute details
exports.getDisputeDetails = async (req, res) => {
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
          attributes: ["id", "order_date", "total_amount", "shipping_address"],
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["id", "first_name", "last_name", "email"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "orderItem",
          attributes: [
            "id",
            "title",
            "price",
            "quantity",
            "order_status",
            "payment_status",
          ],
        },
        {
          model: Product,
          as: "product",
          attributes: [
            "id",
            "title",
            "images",
            "price",
            "category",
            "condition",
          ],
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

    const formattedDispute = {
      disputeId: dispute.id,
      disputeCategory: dispute.dispute_category,
      disputeStatus: dispute.dispute_status,
      description: dispute.description,
      adminResponse: dispute.admin_response,
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
        shippingAddress: dispute.order?.shipping_address,
        buyer: dispute.order?.buyer
          ? {
              id: dispute.order.buyer.id,
              firstName: dispute.order.buyer.first_name,
              lastName: dispute.order.buyer.last_name,
              fullName: `${dispute.order.buyer.first_name} ${dispute.order.buyer.last_name}`,
              email: dispute.order.buyer.email,
            }
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
        paymentStatus: dispute.orderItem?.payment_status,
      },

      product: {
        productId: dispute.product?.id,
        title: dispute.product?.title,
        images: dispute.product?.images,
        price: dispute.product?.price
          ? parseFloat(dispute.product.price)
          : null,
        category: dispute.product?.category,
        condition: dispute.product?.condition,
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

    res.status(200).json({
      success: true,
      data: {
        dispute: formattedDispute,
      },
    });
  } catch (error) {
    console.error("Get dispute details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dispute details",
      error: error.message,
    });
  }
};

// Admin: Get all disputes
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

    const formattedDisputes = disputes.map((dispute) => ({
      disputeId: dispute.id,
      disputeCategory: dispute.dispute_category,
      disputeStatus: dispute.dispute_status,
      description: dispute.description,
      adminResponse: dispute.admin_response,
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
    }));

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

// Admin: Update dispute status and add response
exports.updateDisputeStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { disputeId } = req.params;
    const { disputeStatus, adminResponse } = req.body;

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
      admin_response: adminResponse || dispute.admin_response,
    };

    // If resolving or closing, set resolved_at timestamp
    if (disputeStatus === "resolved" || disputeStatus === "closed") {
      updateData.resolved_at = new Date();
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

// User: Update dispute (only description can be updated and only if status is 'open')
exports.updateDispute = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { disputeId } = req.params;
    const { description } = req.body;
    const userId = req.body.userId || req.user?.id; // Assuming user ID comes from auth middleware

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
