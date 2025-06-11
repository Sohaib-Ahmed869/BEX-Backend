const { Order, OrderItem, Product, User } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");
const { ProductListing } = require("../../../models/ProductListing.model");
const {
  sendOrderConfirmationEmail,
  sendOrderRejectionEmail,
} = require("../../../utils/EmailService");

exports.getSellerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Get seller's products first
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
          totalPages: 0,
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
        },
      });
    }

    // Build where clause for filtering orders
    let orderWhereClause = {};

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

    // Build where clause for filtering order items (seller's products + status/payment filters)
    let orderItemWhereClause = {
      product_id: { [Op.in]: productIds }, // Only seller's products
    };
    let includeItemFilters = true; // Always true since we're filtering by seller's products

    // Status filtering (applies to order items)
    if (status) {
      orderItemWhereClause.order_status = status;
    }

    // Payment status filtering (applies to order items)
    if (paymentStatus !== undefined) {
      orderItemWhereClause.payment_status = paymentStatus === "true";
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build include array for OrderItems (always include filters for seller)
    const orderItemsInclude = {
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
            "category",
            "condition",
            "requires_retipping",
            "quantity",
          ],
        },
      ],
    };

    // Get orders that contain seller's products
    const { count, rows: orders } = await Order.findAndCountAll({
      include: [
        orderItemsInclude,
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
          foreignKey: "buyer_id",
        },
      ],
      where: orderWhereClause,
      order: [["order_date", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true,
    });

    // Process orders to include item summaries (only seller's items)
    const processedOrders = orders.map((order) => {
      // Filter only seller's items from the order
      const sellerItems = (order.items || []).filter((item) =>
        productIds.includes(item.product_id)
      );

      // Calculate totals and summaries for seller's items only
      let totalItemsCount = 0;
      let totalAmount = 0;
      let totalRetipAmount = 0;
      const itemNames = [];
      const uniqueStatuses = new Set();
      const uniquePaymentStatuses = new Set();

      sellerItems.forEach((item) => {
        totalItemsCount += item.quantity;
        const itemTotal = parseFloat(item.price) * item.quantity;
        const retipTotal = parseFloat(item.retip_price) || 0;

        totalAmount += itemTotal;
        totalRetipAmount += retipTotal;
        itemNames.push(`${item.title} (x${item.quantity})`);
        uniqueStatuses.add(item.order_status);
        uniquePaymentStatuses.add(item.payment_status);
      });

      // Determine overall statuses for seller's items
      const statusArray = Array.from(uniqueStatuses);
      const overallStatus = statusArray.length === 1 ? statusArray[0] : "mixed";

      const paymentStatusArray = Array.from(uniquePaymentStatuses);
      const overallPaymentStatus =
        paymentStatusArray.length === 1 ? paymentStatusArray[0] : "mixed";

      // Calculate seller's portion of shipping and fees (proportional)
      const orderTotal = parseFloat(order.total_amount);
      const sellerItemsTotal = totalAmount + totalRetipAmount;
      const sellerProportion =
        orderTotal > 0 ? sellerItemsTotal / orderTotal : 0;

      const proportionalShipping =
        Math.round(parseFloat(order.shipping_cost) * sellerProportion * 100) /
        100;
      const proportionalPlatformFee =
        Math.round(parseFloat(order.platform_fee) * sellerProportion * 100) /
        100;

      return {
        // Order Information
        orderId: order.id,
        orderDate: order.order_date,
        orderCreatedAt: order.created_at,
        orderUpdatedAt: order.updated_at,

        // Buyer Information
        buyer: {
          id: order.buyer?.id,
          firstName: order.buyer?.first_name,
          lastName: order.buyer?.last_name,
          fullName: order.buyer
            ? `${order.buyer.first_name} ${order.buyer.last_name}`
            : null,
          email: order.buyer?.email,
        },

        // Items Summary (seller's items only)
        itemsSummary: {
          totalItemsCount: totalItemsCount,
          totalUniqueItems: sellerItems.length,
          itemNames: itemNames,
          itemsPreview:
            itemNames.length > 0
              ? itemNames.slice(0, 3).join(", ") +
                (itemNames.length > 3
                  ? ` and ${itemNames.length - 3} more`
                  : "")
              : "No seller items",
        },

        // Financial Information (seller's portion)
        amounts: {
          orderTotal: parseFloat(order.total_amount), // Full order total for reference
          sellerItemsTotal: Math.round(sellerItemsTotal * 100) / 100, // Seller's items total
          itemsTotal: Math.round(totalAmount * 100) / 100, // Base price total
          retipTotal: Math.round(totalRetipAmount * 100) / 100, // Retip total
          proportionalShipping: proportionalShipping, // Seller's portion of shipping
          proportionalPlatformFee: proportionalPlatformFee, // Seller's portion of platform fee
          sellerRevenue:
            Math.round((sellerItemsTotal - proportionalPlatformFee) * 100) /
            100, // Revenue minus platform fee
        },

        // Status Information (for seller's items)
        status: {
          orderPaymentCompleted: order.payment_completed,
          itemsOrderStatus: overallStatus,
          itemsPaymentStatus: overallPaymentStatus,
          statusDetails: statusArray,
          paymentStatusDetails: paymentStatusArray,
        },

        // Shipping Information
        shippingInfo: {
          shippingAddress: order.shipping_address,
          trackingNumber: order.tracking_number,
          requiresRetipping: order.requires_retipping,
          shipstationId: order.shipstation_id,
        },

        // Seller-specific information
        sellerInfo: {
          totalSellerItems: sellerItems.length,
          sellerProductIds: sellerItems.map((item) => item.product_id),
          hasRetippingItems: sellerItems.some(
            (item) => item.product?.requires_retipping
          ),
          allItemsShipped: sellerItems.every(
            (item) => item.order_status === "shipped"
          ),
          allItemsPaid: sellerItems.every(
            (item) => item.payment_status === true
          ),
        },
      };
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        orders: processedOrders,
        totalOrders: count,
        totalPages: totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        sellerId: userId,
        totalSellerProducts: productIds.length,
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
exports.getBuyerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { orderStatus, paymentStatus, startDate, endDate } = req.query;

    // Build where clause for filtering orders
    let orderWhereClause = { buyer_id: userId };

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

    // Payment status filtering
    if (paymentStatus !== undefined) {
      orderWhereClause.payment_completed = paymentStatus === "true";
    }

    // Build where clause for order items if needed
    let orderItemWhereClause = {};

    // Order status filtering (now on OrderItem model)
    if (orderStatus) {
      orderItemWhereClause.order_status = orderStatus;
    }

    // Get buyer's orders with all related data
    const buyerOrders = await Order.findAll({
      where: orderWhereClause,
      include: [
        {
          model: OrderItem,
          as: "items",
          where:
            Object.keys(orderItemWhereClause).length > 0
              ? orderItemWhereClause
              : undefined,
          required: true,
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "condition", "category", "images"],
            },
          ],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      order: [["order_date", "DESC"]],
      distinct: true,
    });

    // Structure the response with individual order structure
    const structuredOrders = buyerOrders.map((order) => {
      // Calculate order totals
      const itemsSubtotal = order.items.reduce((sum, item) => {
        return sum + parseFloat(item.price) * item.quantity;
      }, 0);

      const retippingTotal = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.retip_price) || 0);
      }, 0);

      const orderTotal =
        itemsSubtotal +
        retippingTotal +
        parseFloat(order.shipping_cost) +
        parseFloat(order.platform_fee);

      return {
        // Order Details
        orderId: order.id,
        orderDate: order.order_date,
        totalAmount: parseFloat(order.total_amount),
        shippingCost: parseFloat(order.shipping_cost),
        platformFee: parseFloat(order.platform_fee),
        paymentCompleted: order.payment_completed,
        shippingAddress: order.shipping_address,
        trackingNumber: order.tracking_number,
        requiresRetipping: order.requires_retipping,
        shipstationId: order.shipstation_id,

        // Calculated Totals
        itemsSubtotal: Math.round(itemsSubtotal * 100) / 100,
        retippingTotal: Math.round(retippingTotal * 100) / 100,
        grandTotal: Math.round(orderTotal * 100) / 100,

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

        // Order Items
        items: order.items.map((item) => {
          const itemLineTotal = parseFloat(item.price) * item.quantity;
          const retipCost = parseFloat(item.retip_price) || 0;
          const itemGrandTotal = itemLineTotal + retipCost;

          return {
            // Order Item Details
            orderItemId: item.id,
            productId: item.product_id,
            title: item.title,
            quantity: item.quantity,
            unitPrice: parseFloat(item.price),
            lineTotal: Math.round(itemLineTotal * 100) / 100,
            retipAdded: item.retip_added,
            retipPrice: retipCost,
            orderStatus: item.order_status,
            paymentStatus: item.payment_status,

            // Product Details
            product: item.product
              ? {
                  id: item.product.id,
                  title: item.product.title,
                  description: item.product.description,
                  originalPrice: parseFloat(item.product.price),
                  condition: item.product.condition,
                  category: item.product.category,
                  subtype: item.product.subtype,
                  images: item.product.images || [],
                  requiresRetipping: item.product.requires_retipping,
                  isActive: item.product.is_active,
                }
              : null,

            // Calculated totals for this item
            itemTotal: Math.round(itemLineTotal * 100) / 100,
            retipTotal: Math.round(retipCost * 100) / 100,
            itemGrandTotal: Math.round(itemGrandTotal * 100) / 100,

            // Timestamps
            itemCreatedAt: item.created_at,
            itemUpdatedAt: item.updated_at,
          };
        }),

        // Timestamps
        orderCreatedAt: order.created_at,
        orderUpdatedAt: order.updated_at,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        orders: structuredOrders,
        totalOrders: structuredOrders.length,
        summary: {
          totalOrderValue: structuredOrders.reduce(
            (sum, order) => sum + order.grandTotal,
            0
          ),
          completedPayments: structuredOrders.filter(
            (order) => order.paymentCompleted
          ).length,
          pendingPayments: structuredOrders.filter(
            (order) => !order.paymentCompleted
          ).length,
        },
      },
    });
  } catch (error) {
    console.error("Get buyer orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching buyer orders",
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

    // Find the order item with order details
    const orderItem = await OrderItem.findByPk(itemId, {
      include: [
        {
          model: Order,
          as: "order", // Make sure this association is defined in your models
          include: [
            {
              model: User,
              as: "buyer", // Make sure this association is defined in your models
              attributes: ["id", "email", "first_name", "last_name"],
            },
          ],
        },
        {
          model: Product,
          as: "product", // Make sure this association is defined in your models
          attributes: ["id", "title", "quantity", "images", "listing_id"],
        },
      ],
      transaction,
    });

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

    // Get product details (if not included in the query above)
    const product =
      orderItem.product ||
      (await Product.findByPk(orderItem.product_id, {
        transaction,
      }));

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
        const newStock = Math.max(0, productListing.Stock - 1);

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

    // Get the first image from the product images array
    const productImage =
      product.images && product.images.length > 0 ? product.images[0] : null;

    // Prepare order data for email
    const orderData = {
      id: orderItem.order.id,
      items: [
        {
          product_name: orderItem.title,
          quantity: orderItem.quantity,
          price: orderItem.price,
          product_image: productImage, // Pass the image with each item
          seller_name: null, // Add seller info if available in your data structure
        },
      ],
      total_amount: orderItem.order.total_amount,
      shipping_address: formatShippingAddress(orderItem.order.shipping_address),
      payment_method: "Card", // Update based on your payment method data
    };

    // Prepare user data for email
    const userData = {
      email: orderItem.order.buyer.email,
      first_name: orderItem.order.buyer.first_name,
      last_name: orderItem.order.buyer.last_name,
    };

    // Send confirmation email (don't await to avoid blocking the response)
    sendOrderConfirmationEmail(orderData, userData)
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error(
            "Failed to send order confirmation email:",
            emailResult.message
          );
        } else {
          console.log("Order confirmation email sent successfully");
        }
      })
      .catch((error) => {
        console.error("Error sending order confirmation email:", error);
      });

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

// Helper function to format shipping address
function formatShippingAddress(shippingAddress) {
  if (typeof shippingAddress === "string") {
    return shippingAddress;
  }

  // If shipping_address is a JSON object with nested structure
  if (typeof shippingAddress === "object" && shippingAddress !== null) {
    const { name, email, address } = shippingAddress;

    // If address is nested under an 'address' object
    if (address && typeof address === "object") {
      const { line1, line2, city, state, postal_code, country } = address;

      // Build address string
      let addressParts = [];

      if (line1) addressParts.push(line1);
      if (line2 && line2.trim() !== "") addressParts.push(line2);
      if (city) addressParts.push(city);
      if (state) addressParts.push(state);
      if (postal_code) addressParts.push(postal_code);
      if (country) addressParts.push(country);

      const formattedAddress = addressParts.join(", ");

      // Return formatted string with name and address
      return {
        name: name || "N/A",
        email: email || "N/A",
        address: formattedAddress || "Address not available",
      };
    }

    // Fallback for old format (direct address fields)
    const { street, city, state, postal_code, country } = shippingAddress;
    const addressStr = `${street || ""}, ${city || ""}, ${state || ""} ${
      postal_code || ""
    }, ${country || ""}`
      .replace(/,\s*,/g, ",")
      .replace(/^,\s*|,\s*$/g, "");

    return {
      name: shippingAddress.name || "N/A",
      email: shippingAddress.email || "N/A",
      address: addressStr || "Address not available",
    };
  }

  return {
    name: "N/A",
    email: "N/A",
    address: "Address not available",
  };
}

// Admin endpoints for orders
exports.rejectOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;

    // Find the order item with order details (same as confirmOrder)
    const orderItem = await OrderItem.findByPk(itemId, {
      include: [
        {
          model: Order,
          as: "order", // Make sure this association is defined in your models
          include: [
            {
              model: User,
              as: "buyer", // Make sure this association is defined in your models
              attributes: ["id", "email", "first_name", "last_name"],
            },
          ],
        },
        {
          model: Product,
          as: "product", // Make sure this association is defined in your models
          attributes: ["id", "title", "quantity", "images", "listing_id"],
        },
      ],
      transaction,
    });

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

    // Get the first image from the product images array
    const productImage =
      orderItem.product.images && orderItem.product.images.length > 0
        ? orderItem.product.images[0]
        : null;

    // Prepare order data for email (same structure as confirmOrder)
    const orderData = {
      id: orderItem.order.id,
      items: [
        {
          product_name: orderItem.title,
          quantity: orderItem.quantity,
          price: orderItem.price,
          product_image: productImage, // Pass the image with each item
          seller_name: null, // Add seller info if available in your data structure
        },
      ],
      total_amount: orderItem.order.total_amount,
      shipping_address: formatShippingAddress(orderItem.order.shipping_address),
      payment_method: "Card", // Update based on your payment method data
    };

    // Prepare user data for email (same structure as confirmOrder)
    const userData = {
      email: orderItem.order.buyer.email,
      first_name: orderItem.order.buyer.first_name,
      last_name: orderItem.order.buyer.last_name,
    };

    // Send rejection email (don't await to avoid blocking the response)
    sendOrderRejectionEmail(orderData, userData)
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error(
            "Failed to send order rejection email:",
            emailResult.message
          );
        } else {
          console.log("Order rejection email sent successfully");
        }
      })
      .catch((error) => {
        console.error("Error sending order rejection email:", error);
      });

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
// Endpoint 1: Get all orders for admin (order-level view with item summaries)
exports.getAllOrders = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Build where clause for filtering orders
    let orderWhereClause = {};

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

    // Build where clause for filtering order items (if status/payment filters are applied)
    let orderItemWhereClause = {};
    let includeItemFilters = false;

    // Status filtering (applies to order items)
    if (status) {
      orderItemWhereClause.order_status = status;
      includeItemFilters = true;
    }

    // Payment status filtering (applies to order items)
    if (paymentStatus !== undefined) {
      orderItemWhereClause.payment_status = paymentStatus === "true";
      includeItemFilters = true;
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build include array for OrderItems
    const orderItemsInclude = {
      model: OrderItem,
      as: "items",
      include: [
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
        },
      ],
    };

    // Add where clause only if filters are applied
    if (includeItemFilters) {
      orderItemsInclude.where = orderItemWhereClause;
    }

    // Get all orders
    const { count, rows: orders } = await Order.findAndCountAll({
      include: [
        orderItemsInclude,
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
          foreignKey: "buyer_id",
        },
      ],
      where: orderWhereClause,
      order: [["order_date", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true,
    });

    // Process orders to include item summaries
    const processedOrders = orders.map((order) => {
      const items = order.items || [];

      // Calculate totals and summaries
      let totalItemsCount = 0;
      let totalAmount = 0;
      let totalRetipAmount = 0;
      const itemNames = [];
      const uniqueStatuses = new Set();
      const uniquePaymentStatuses = new Set();

      items.forEach((item) => {
        totalItemsCount += item.quantity;
        const itemTotal = parseFloat(item.price) * item.quantity;
        const retipTotal = parseFloat(item.retip_price) || 0;

        totalAmount += itemTotal;
        totalRetipAmount += retipTotal;
        itemNames.push(`${item.title} (x${item.quantity})`);
        uniqueStatuses.add(item.order_status);
        uniquePaymentStatuses.add(item.payment_status);
      });

      // Determine overall statuses
      const statusArray = Array.from(uniqueStatuses);
      const overallStatus = statusArray.length === 1 ? statusArray[0] : "mixed";

      const paymentStatusArray = Array.from(uniquePaymentStatuses);
      const overallPaymentStatus =
        paymentStatusArray.length === 1 ? paymentStatusArray[0] : "mixed";

      return {
        // Order Information
        orderId: order.id,
        orderDate: order.order_date,
        orderCreatedAt: order.created_at,
        orderUpdatedAt: order.updated_at,

        // Buyer Information
        buyer: {
          id: order.buyer?.id,
          firstName: order.buyer?.first_name,
          lastName: order.buyer?.last_name,
          fullName: order.buyer
            ? `${order.buyer.first_name} ${order.buyer.last_name}`
            : null,
          email: order.buyer?.email,
        },

        // Items Summary
        itemsSummary: {
          totalItemsCount: totalItemsCount,
          totalUniqueItems: items.length,
          itemNames: itemNames,
          itemsPreview:
            itemNames.length > 0
              ? itemNames.slice(0, 3).join(", ") +
                (itemNames.length > 3
                  ? ` and ${itemNames.length - 3} more`
                  : "")
              : "No items",
        },

        // Financial Information
        amounts: {
          orderTotal: parseFloat(order.total_amount),
          shippingCost: parseFloat(order.shipping_cost),
          platformFee: parseFloat(order.platform_fee),
          itemsTotal: Math.round(totalAmount * 100) / 100,
          retipTotal: Math.round(totalRetipAmount * 100) / 100,
          calculatedTotal:
            Math.round((totalAmount + totalRetipAmount) * 100) / 100,
        },

        // Status Information
        status: {
          orderPaymentCompleted: order.payment_completed,
          itemsOrderStatus: overallStatus,
          itemsPaymentStatus: overallPaymentStatus,
          statusDetails: statusArray,
          paymentStatusDetails: paymentStatusArray,
        },

        // Shipping Information
        shippingInfo: {
          shippingAddress: order.shipping_address,
          trackingNumber: order.tracking_number,
          requiresRetipping: order.requires_retipping,
          shipstationId: order.shipstation_id,
        },
      };
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        orders: processedOrders,
        totalOrders: count,
        totalPages: totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get admin orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Endpoint 2: Get order items by order ID for admin
exports.getOrderItemsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    // First, get the order information
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get all order items for this order
    const orderItems = await OrderItem.findAll({
      where: { order_id: orderId },
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
          include: [
            {
              model: User,
              as: "seller", // Assuming this association exists
              attributes: ["id", "first_name", "last_name", "email"],
            },
          ],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    if (orderItems.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          orderInfo: {
            orderId: order.id,
            orderDate: order.order_date,
            totalAmount: parseFloat(order.total_amount),
            shippingCost: parseFloat(order.shipping_cost),
            platformFee: parseFloat(order.platform_fee),
            paymentCompleted: order.payment_completed,
            shippingAddress: order.shipping_address,
            trackingNumber: order.tracking_number,
            requiresRetipping: order.requires_retipping,
            shipstationId: order.shipstation_id,
            buyer: order.buyer
              ? {
                  id: order.buyer.id,
                  firstName: order.buyer.first_name,
                  lastName: order.buyer.last_name,
                  fullName: `${order.buyer.first_name} ${order.buyer.last_name}`,
                  email: order.buyer.email,
                }
              : null,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
          },
          orderItems: [],
          summary: {
            totalItems: 0,
            totalQuantity: 0,
            totalAmount: 0,
            totalRetipAmount: 0,
            grandTotal: 0,
          },
        },
      });
    }

    // Process order items
    const processedItems = orderItems.map((item) => {
      const itemTotal = parseFloat(item.price) * item.quantity;
      const retipTotal = parseFloat(item.retip_price) || 0;
      const grandTotal = itemTotal + retipTotal;

      return {
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

        // Product Details
        product: {
          id: item.product.id,
          title: item.product.title,
          image: item.product.images?.[0] || null,
          images: item.product.images,
          originalPrice: parseFloat(item.product.price),
          category: item.product.category,
          condition: item.product.condition,
          requiresRetipping: item.product.requires_retipping,
          stockRemaining: item.product.quantity,
          seller: item.product.seller
            ? {
                id: item.product.seller.id,
                firstName: item.product.seller.first_name,
                lastName: item.product.seller.last_name,
                fullName: `${item.product.seller.first_name} ${item.product.seller.last_name}`,
                email: item.product.seller.email,
              }
            : null,
        },

        // Timestamps
        itemCreatedAt: item.created_at,
        itemUpdatedAt: item.updated_at,
      };
    });

    // Order information
    const orderInfo = {
      orderId: order.id,
      orderDate: order.order_date,
      totalAmount: parseFloat(order.total_amount),
      shippingCost: parseFloat(order.shipping_cost),
      platformFee: parseFloat(order.platform_fee),
      paymentCompleted: order.payment_completed,
      shippingAddress: order.shipping_address,
      trackingNumber: order.tracking_number,
      requiresRetipping: order.requires_retipping,
      shipstationId: order.shipstation_id,
      buyer: order.buyer
        ? {
            id: order.buyer.id,
            firstName: order.buyer.first_name,
            lastName: order.buyer.last_name,
            fullName: `${order.buyer.first_name} ${order.buyer.last_name}`,
            email: order.buyer.email,
          }
        : null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };

    // Calculate summary totals
    const summary = {
      totalItems: processedItems.length,
      totalQuantity: processedItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
      totalAmount:
        Math.round(
          processedItems.reduce((sum, item) => sum + item.itemTotal, 0) * 100
        ) / 100,
      totalRetipAmount:
        Math.round(
          processedItems.reduce((sum, item) => sum + item.retipTotal, 0) * 100
        ) / 100,
      grandTotal:
        Math.round(
          processedItems.reduce((sum, item) => sum + item.grandTotal, 0) * 100
        ) / 100,
    };

    res.status(200).json({
      success: true,
      data: {
        orderInfo: orderInfo,
        orderItems: processedItems,
        summary: summary,
      },
    });
  } catch (error) {
    console.error("Get order items error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order items",
      error: error.message,
    });
  }
};
