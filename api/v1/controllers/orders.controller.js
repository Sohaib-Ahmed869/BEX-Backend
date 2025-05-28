const { Order, OrderItem, Product, User } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");
const { ProductListing } = require("../../../models/ProductListing.model");
exports.getSellerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, paymentStatus, startDate, endDate } = req.query;

    // Get seller's products
    const sellerProducts = await Product.findAll({
      where: { user_id: userId },
      attributes: ["id"],
    });

    const productIds = sellerProducts.map((p) => p.id);

    if (productIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          orders: [],
          totalOrders: 0,
        },
      });
    }

    // Build where clause for filtering
    let orderWhereClause = {};
    let orderItemWhereClause = { product_id: { [Op.in]: productIds } };

    // Date filtering
    if (startDate && endDate) {
      orderWhereClause.order_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      orderWhereClause.order_date = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      orderWhereClause.order_date = {
        [Op.lte]: new Date(endDate),
      };
    }

    // Status filtering
    if (status) {
      orderItemWhereClause.order_status = status;
    }

    // Payment status filtering
    if (paymentStatus !== undefined) {
      orderItemWhereClause.payment_status = paymentStatus === "true";
    }

    // Get orders containing seller's products within filters
    const ordersWithItems = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          where: orderItemWhereClause,
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "title",
                "images",
                "price",
                "quantity",
                "category",
                "condition",
                "requires_retipping",
              ],
            },
          ],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
          foreignKey: "buyer_id",
        },
      ],
      where: orderWhereClause,
      order: [["order_date", "DESC"]],
      distinct: true,
    });

    // Flatten order items into individual entries
    const individualOrderItems = [];

    ordersWithItems.forEach((order) => {
      // Filter only seller's products from the order items
      const sellerItems = order.items.filter((item) =>
        productIds.includes(item.product_id)
      );

      sellerItems.forEach((item) => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        const retipTotal = parseFloat(item.retip_price) || 0;
        const grandTotal = itemTotal + retipTotal;

        individualOrderItems.push({
          // Order Item Details
          orderItemId: item.id,
          productId: item.product_id,
          quantity: item.quantity,
          price: parseFloat(item.price),
          itemTitle: item.title,
          retipAdded: item.retip_added,
          retipPrice: retipTotal,
          orderStatus: item.order_status,
          paymentStatus: item.payment_status,

          // Calculated totals for this item
          itemTotal: Math.round(itemTotal * 100) / 100,
          retipTotal: Math.round(retipTotal * 100) / 100,
          grandTotal: Math.round(grandTotal * 100) / 100,

          // Order Details
          orderId: order.id,
          orderDate: order.order_date,
          shippingAddress: order.shipping_address,
          trackingNumber: order.tracking_number,
          paymentCompleted: order.payment_completed,
          requiresRetipping: order.requires_retipping,
          shipstationId: order.shipstation_id,

          // Buyer Details
          buyer: {
            id: order.buyer?.id,
            firstName: order.buyer?.first_name,
            lastName: order.buyer?.last_name,
            fullName: order.buyer
              ? `${order.buyer.first_name} ${order.buyer.last_name}`
              : null,
            email: order.buyer?.email,
          },

          // Product Details
          product: {
            id: item.product.id,
            title: item.product.title,
            image: item.product.images?.[0] || null,
            originalPrice: parseFloat(item.product.price),
            category: item.product.category,
            condition: item.product.condition,
            requiresRetipping: item.product.requires_retipping,
            stockRemaining: item.product.quantity,
          },

          // Timestamps
          orderCreatedAt: order.created_at,
          orderUpdatedAt: order.updated_at,
          itemCreatedAt: item.created_at,
          itemUpdatedAt: item.updated_at,
        });
      });
    });

    res.status(200).json({
      success: true,
      data: {
        orders: individualOrderItems,
        totalOrders: individualOrderItems.length,
      },
    });
  } catch (error) {
    console.error("Get seller orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching seller orders",
      error: error.message,
    });
  }
};
exports.getSingleOrderItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Find the specific order item with all related data
    const orderItem = await OrderItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: Product,
          as: "product",
          attributes: [
            "id",
            "title",
            "images",
            "price",
            "quantity",
            "category",
            "condition",
            "requires_retipping",
            "user_id",
          ],
        },
        {
          model: Order,
          as: "order",
          attributes: [
            "id",
            "order_date",
            "shipping_address",
            "tracking_number",
            "payment_completed",
            "requires_retipping",
            "shipstation_id",
            "buyer_id",
            "created_at",
            "updated_at",
          ],
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["id", "first_name", "last_name", "email"],
            },
          ],
        },
      ],
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Calculate totals
    const itemTotal = parseFloat(orderItem.price) * orderItem.quantity;
    const retipTotal = parseFloat(orderItem.retip_price) || 0;
    const grandTotal = itemTotal + retipTotal;

    // Format the response with the same structure as the original code
    const formattedOrderItem = {
      // Order Item Details
      orderItemId: orderItem.id,
      productId: orderItem.product_id,
      quantity: orderItem.quantity,
      price: parseFloat(orderItem.price),
      itemTitle: orderItem.title,
      retipAdded: orderItem.retip_added,
      retipPrice: retipTotal,
      orderStatus: orderItem.order_status,
      paymentStatus: orderItem.payment_status,

      // Calculated totals for this item
      itemTotal: Math.round(itemTotal * 100) / 100,
      retipTotal: Math.round(retipTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,

      // Order Details
      orderId: orderItem.order.id,
      orderDate: orderItem.order.order_date,
      shippingAddress: orderItem.order.shipping_address,
      trackingNumber: orderItem.order.tracking_number,
      paymentCompleted: orderItem.order.payment_completed,
      requiresRetipping: orderItem.order.requires_retipping,
      shipstationId: orderItem.order.shipstation_id,

      // Buyer Details
      buyer: {
        id: orderItem.order.buyer?.id,
        firstName: orderItem.order.buyer?.first_name,
        lastName: orderItem.order.buyer?.last_name,
        fullName: orderItem.order.buyer
          ? `${orderItem.order.buyer.first_name} ${orderItem.order.buyer.last_name}`
          : null,
        email: orderItem.order.buyer?.email,
      },

      // Product Details
      product: {
        id: orderItem.product.id,
        title: orderItem.product.title,
        image: orderItem.product.images?.[0] || null,
        originalPrice: parseFloat(orderItem.product.price),
        category: orderItem.product.category,
        condition: orderItem.product.condition,
        requiresRetipping: orderItem.product.requires_retipping,
        stockRemaining: orderItem.product.quantity,
        sellerId: orderItem.product.user_id,
      },

      // Timestamps
      orderCreatedAt: orderItem.order.created_at,
      orderUpdatedAt: orderItem.order.updated_at,
      itemCreatedAt: orderItem.created_at,
      itemUpdatedAt: orderItem.updated_at,
    };

    res.status(200).json({
      success: true,
      data: {
        orderItem: formattedOrderItem,
      },
    });
  } catch (error) {
    console.error("Get single order item error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order item",
      error: error.message,
    });
  }
};
exports.confirmOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;

    // Find the order item
    const orderItem = await OrderItem.findByPk(itemId, { transaction });

    if (!orderItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Check if order is already approved or processed
    if (orderItem.order_status !== "pending approval") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Order item is already ${orderItem.order_status}`,
      });
    }

    // Get product details
    const product = await Product.findByPk(orderItem.product_id, {
      transaction,
    });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if sufficient quantity is available
    if (product.quantity < orderItem.quantity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.quantity}, Requested: ${orderItem.quantity}`,
      });
    }

    // Update order item status to approved
    await OrderItem.update(
      { order_status: "approved" },
      {
        where: { id: itemId },
        transaction,
      }
    );

    // Calculate new quantity after decreasing
    const newQuantity = product.quantity - orderItem.quantity;

    // Update product quantity
    await Product.update(
      { quantity: newQuantity },
      {
        where: { id: orderItem.product_id },
        transaction,
      }
    );

    // If quantity becomes zero and product has a listing_id, decrease stock in product_listings
    if (newQuantity === 0 && product.listing_id) {
      const productListing = await ProductListing.findByPk(product.listing_id, {
        transaction,
      });

      if (productListing) {
        const newStock = Math.max(0, productListing.Stock - 1); // Ensure stock doesn't go below 0

        await ProductListing.update(
          { Stock: newStock },
          {
            where: { id: product.listing_id },
            transaction,
          }
        );
      }
    }

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Order confirmed successfully",
      data: {
        orderItemId: itemId,
        newProductQuantity: newQuantity,
        orderStatus: "approved",
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Confirm order error:", error);
    res.status(500).json({
      success: false,
      message: "Error confirming order",
      error: error.message,
    });
  }
};
exports.rejectOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;

    // Find the order item
    const orderItem = await OrderItem.findByPk(itemId, { transaction });

    if (!orderItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Check if order can be rejected (should be in pending approval status)
    if (orderItem.order_status !== "pending approval") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Order item cannot be rejected. Current status: ${orderItem.order_status}`,
      });
    }

    // Update order item status to rejected
    await OrderItem.update(
      { order_status: "rejected" },
      {
        where: { id: itemId },
        transaction,
      }
    );

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Order rejected successfully",
      data: {
        orderItemId: itemId,
        orderStatus: "rejected",
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Reject order error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting order",
      error: error.message,
    });
  }
};
