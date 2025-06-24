require("dotenv").config();
// Check if the Stripe key is available, and provide better error handling
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY is not defined in environment variables");
}
const { v4: uuidv4 } = require("uuid");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const OrderItem = require("../../../models/orderItem");
const Order = require("../../../models/order.model");
const Refund = require("../../../models/refund.model");
const Transaction = require("../../../models/transaction.model");
const { sequelize } = require("../../../config/db");
const { Product, User } = require("../../../models");

exports.refundOrderItem = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { orderItemId, reason, notes, initiatedBy } = req.body;

    // Get order item with order details - USE THE ALIAS "order"
    const orderItem = await OrderItem.findByPk(orderItemId, {
      include: [
        {
          model: Order,
          as: "order", // Add the alias here
          attributes: ["id", "payment_intent_id", "total_amount"],
        },
      ],
      transaction: t,
    });

    if (!orderItem) {
      throw new Error("Order item not found");
    }

    if (orderItem.order_status === "refunded") {
      throw new Error("Order item already refunded");
    }

    // Access the order using lowercase "order" (the alias)
    if (!orderItem.order.payment_intent_id) {
      throw new Error("Payment intent not found for this order");
    }

    // Calculate refund amount (item price + retip if applicable)
    const itemRefundAmount =
      parseFloat(orderItem.price) * parseInt(orderItem.quantity);
    const retipRefundAmount = orderItem.retip_added
      ? parseFloat(orderItem.retip_price || 0) * parseInt(orderItem.quantity)
      : 0;
    const totalRefundAmount = itemRefundAmount + retipRefundAmount;

    // Create Stripe refund - use lowercase "order"
    const stripeRefund = await stripe.refunds.create({
      payment_intent: orderItem.order.payment_intent_id,
      amount: Math.round(totalRefundAmount * 100), // Convert to cents
      reason:
        reason === "seller_rejected"
          ? "requested_by_customer"
          : "requested_by_customer",
      metadata: {
        order_id: orderItem.order.id,
        order_item_id: orderItemId,
        item_title: orderItem.title,
        refund_reason: reason,
      },
    });

    // Create refund record - use lowercase "order"
    const refund = await Refund.create(
      {
        id: uuidv4(),
        order_id: orderItem.order.id,
        order_item_id: orderItemId,
        stripe_refund_id: stripeRefund.id,
        stripe_payment_intent_id: orderItem.order.payment_intent_id,
        refund_amount: totalRefundAmount,
        item_price: parseFloat(orderItem.price),
        item_quantity: parseInt(orderItem.quantity),
        reason: reason,
        status: stripeRefund.status,
        initiated_by: initiatedBy,
        processed_date: stripeRefund.status === "succeeded" ? new Date() : null,
        notes: notes,
        retip_refund_amount: retipRefundAmount,
      },
      { transaction: t }
    );

    // Create transaction record - use lowercase "order"
    await Transaction.create(
      {
        id: uuidv4(),
        order_id: orderItem.order.id,
        payment_processor_id: stripeRefund.id,
        amount: totalRefundAmount,
        type: "refund",
        status: "completed",
        payment_details: {
          refund_record_id: refund.id,
          order_item_id: orderItemId,
          item_title: orderItem.title,
        },
      },
      { transaction: t }
    );

    // Update order item status
    await orderItem.update({ order_status: "refunded" }, { transaction: t });

    await t.commit();

    res.json({
      success: true,
      refundId: refund.id,
      stripeRefundId: stripeRefund.id,
      refundAmount: totalRefundAmount,
      orderItemId: orderItemId,
      itemTitle: orderItem.title,
      message: "Order item refunded successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Order item refund error:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.getRefundedOrderItems = async (req, res) => {
  try {
    const { page = 1, limit = 10, sellerId } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {
      order_status: "refunded",
    };

    // If sellerId is provided, filter by seller through product relationship
    const includeClause = [
      {
        model: Product,
        as: "product",
        attributes: ["id", "user_id"], // Only get product id and user_id for seller lookup
        ...(sellerId && {
          where: {
            user_id: sellerId,
          },
        }),
        include: [
          {
            model: User,
            as: "seller", // This assumes you have a seller association defined
            attributes: [
              "id",
              "first_name",
              "last_name",
              "email",
              "phone",
              "company_name",
              "company_registration_number",
              "country_of_registration",
              "business_address",
              "website_url",
              "seller_verified",
              "seller_approval_status",
            ],
          },
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
    ];

    // Find all rejected order items with pagination
    const { count, rows: refundedOrderItems } = await OrderItem.findAndCountAll(
      {
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["created_at", "DESC"]], // Most recent first
      }
    );

    if (refundedOrderItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No rejected order items found",
        data: {
          orderItems: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit),
          },
        },
      });
    }

    // Format the response data
    const formattedOrderItems = refundedOrderItems.map((orderItem) => {
      // Calculate totals
      const itemTotal = parseFloat(orderItem.price) * orderItem.quantity;
      const retipTotal = parseFloat(orderItem.retip_price) || 0;
      const grandTotal = itemTotal + retipTotal;

      return {
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
        platformCommission: parseFloat(orderItem.platform_commission) || 0,

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

        // Seller Details
        seller: {
          id: orderItem.product.seller?.id,
          firstName: orderItem.product.seller?.first_name,
          lastName: orderItem.product.seller?.last_name,
          fullName: orderItem.product.seller
            ? `${orderItem.product.seller.first_name} ${orderItem.product.seller.last_name}`
            : null,
          email: orderItem.product.seller?.email,
          phone: orderItem.product.seller?.phone,
          companyName: orderItem.product.seller?.company_name,
          companyRegistrationNumber:
            orderItem.product.seller?.company_registration_number,
          countryOfRegistration:
            orderItem.product.seller?.country_of_registration,
          businessAddress: orderItem.product.seller?.business_address,
          websiteUrl: orderItem.product.seller?.website_url,
          sellerVerified: orderItem.product.seller?.seller_verified,
          sellerApprovalStatus:
            orderItem.product.seller?.seller_approval_status,
        },

        // Timestamps
        orderCreatedAt: orderItem.order.created_at,
        orderUpdatedAt: orderItem.order.updated_at,
        itemCreatedAt: orderItem.created_at,
        itemUpdatedAt: orderItem.updated_at,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      message: `Found ${count} refunded order item(s)`,
      data: {
        orderItems: formattedOrderItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get refunded order items error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching refunded order items",
      error: error.message,
    });
  }
};
