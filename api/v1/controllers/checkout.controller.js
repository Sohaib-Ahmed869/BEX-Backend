require("dotenv").config();

// Check if the Stripe key is available, and provide better error handling
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY is not defined in environment variables");
}
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require("uuid");
const { sequelize } = require("../../../config/db");
const Order = require("../../../models/order.model");
const OrderItem = require("../../../models/orderItem");
const { Cart, CartItem } = require("../../../models/cart.model");
const { Product, User } = require("../../../models");
const {
  sendOrderPlacementEmail,
  sendPaymentSuccessfulEmail,
} = require("../../../utils/EmailService");

/**
 * Create a PaymentIntent for Stripe
 * @route POST /api/checkout/create-payment-intent
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, shipping } = req.body;
    const userId = req.user.id; // Assuming user is attached to req by auth middleware

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // amount in cents
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
        shippingAddress: JSON.stringify(shipping),
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create an order after successful payment
 * @route POST /api/checkout/create-order
 */
// exports.createOrder = async (req, res) => {
//   const t = await sequelize.transaction();

//   try {
//     const { items, shipping, payment } = req.body;
//     const userId = req.params.userId;

//     // First check if all products exist in the database before proceeding
//     const productIds = items.map((item) => item.id);

//     // Verify all products exist in the database
//     const existingProducts = await Product.findAll({
//       where: { id: productIds },
//       attributes: ["id"],
//       transaction: t,
//     });

//     const existingProductIds = existingProducts.map((product) => product.id);
//     const missingProductIds = productIds.filter(
//       (id) => !existingProductIds.includes(id)
//     );

//     if (missingProductIds.length > 0) {
//       throw new Error(
//         `Products with IDs ${missingProductIds.join(", ")} do not exist`
//       );
//     }

//     // Calculate order totals using the provided items - FIXED CALCULATIONS
//     const subtotal = parseFloat(
//       items
//         .reduce(
//           (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
//           0
//         )
//         .toFixed(2)
//     );

//     // Calculate retip total if any items have retipping service - FIXED
//     const retipTotal = parseFloat(
//       items
//         .reduce((sum, item) => {
//           const retipPrice = item.retipAdded
//             ? parseFloat(item.retipPrice || 0)
//             : 0;
//           const quantity = parseInt(item.quantity);
//           return sum + retipPrice * quantity;
//         }, 0)
//         .toFixed(2)
//     );

//     // FIXED: Proper decimal calculations
//     const taxRate = 0.0109;
//     const commissionRate = 0.05;

//     const tax = parseFloat((subtotal * taxRate).toFixed(2));
//     const platformFee = parseFloat((subtotal * commissionRate).toFixed(2));
//     const shippingCost = 0.0; // Free shipping

//     // FIXED: Final total calculation
//     const total = parseFloat(
//       (subtotal + tax + platformFee + shippingCost + retipTotal).toFixed(2)
//     );

//     console.log("Order totals:", {
//       subtotal,
//       retipTotal,
//       tax,
//       platformFee,
//       total,
//     });

//     // Verify payment with Stripe if needed
//     const paymentIntent = await stripe.paymentIntents.retrieve(payment.id);

//     if (paymentIntent.status !== "succeeded") {
//       throw new Error("Payment has not been completed");
//     }

//     // Create order record - FIXED: Ensure all numeric values are properly formatted
//     const order = await Order.create(
//       {
//         id: uuidv4(),
//         buyer_id: userId,
//         total_amount: total, // Now properly calculated as a clean decimal
//         shipping_cost: shippingCost,
//         platform_fee: platformFee,
//         payment_completed: true,
//         shipping_address: shipping,
//         requires_retipping: retipTotal > 0,
//         order_date: new Date(),
//       },
//       { transaction: t }
//     );

//     // Create order items directly from the provided items - FIXED
//     for (const item of items) {
//       const itemPrice = parseFloat(item.price);
//       const itemQuantity = parseInt(item.quantity);
//       const itemRetipPrice = item.retipAdded
//         ? parseFloat(item.retipPrice || 0)
//         : 0;

//       await OrderItem.create(
//         {
//           id: uuidv4(),
//           order_id: order.id,
//           product_id: item.id,
//           quantity: itemQuantity,
//           order_status: "pending approval",
//           payment_status: true,
//           price: itemPrice,
//           title: item.title,
//           retip_added: item.retipAdded || false,
//           retip_price: itemRetipPrice,
//         },
//         { transaction: t }
//       );
//     }

//     // Clear user's cart
//     const cart = await Cart.findOne({ where: { user_id: userId } });
//     if (cart) {
//       await CartItem.destroy({ where: { cart_id: cart.id }, transaction: t });
//       await cart.update(
//         { products_count: 0, total_price: 0 },
//         { transaction: t }
//       );
//     }

//     await t.commit();

//     res.status(201).json({
//       success: true,
//       orderId: order.id,
//       message: "Order created successfully",
//       itemsProcessed: items.length,
//       orderTotal: total,
//     });
//     setImmediate(async () => {
//       try {
//         // Get user data for email
//         const userData = await User.findByPk(userId, {
//           attributes: ["email", "first_name", "last_name"],
//         });

//         // Send both emails concurrently
//         const [orderPlacementEmailResult, paymentSuccessEmailResult] =
//           await Promise.allSettled([
//             sendOrderPlacementEmail(
//               order.dataValues,
//               userData.dataValues,
//               items
//             ),
//             sendPaymentSuccessfulEmail(
//               order.dataValues,
//               userData.dataValues,
//               paymentIntent,
//               items
//             ),
//           ]);

//         // Log results (optional)
//         if (
//           orderPlacementEmailResult.status === "rejected" ||
//           !orderPlacementEmailResult.value?.success
//         ) {
//           console.error(
//             "Failed to send order placement email:",
//             orderPlacementEmailResult.reason ||
//               orderPlacementEmailResult.value?.message
//           );
//         }

//         if (
//           paymentSuccessEmailResult.status === "rejected" ||
//           !paymentSuccessEmailResult.value?.success
//         ) {
//           console.error(
//             "Failed to send payment success email:",
//             paymentSuccessEmailResult.reason ||
//               paymentSuccessEmailResult.value?.message
//           );
//         }

//         console.log("Order emails processed for order ID:", order.id);
//       } catch (emailError) {
//         console.error("Error processing order emails:", emailError);
//         // Optionally, you could add this to a retry queue here
//       }
//     });
//   } catch (error) {
//     await t.rollback();
//     console.error("Error creating order:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
// Add these imports at the top of your controller file

exports.createOrder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { items, shipping, payment } = req.body;
    const userId = req.params.userId;

    // First check if all products exist in the database before proceeding
    const productIds = items.map((item) => item.id);

    // Verify all products exist in the database AND fetch their images
    const existingProducts = await Product.findAll({
      where: { id: productIds },
      attributes: ["id", "images"], // Include images attribute like in confirmOrder
      transaction: t,
    });

    const existingProductIds = existingProducts.map((product) => product.id);
    const missingProductIds = productIds.filter(
      (id) => !existingProductIds.includes(id)
    );

    if (missingProductIds.length > 0) {
      throw new Error(
        `Products with IDs ${missingProductIds.join(", ")} do not exist`
      );
    }

    // Create a map of product IDs to their images for easy lookup
    const productImagesMap = {};
    existingProducts.forEach((product) => {
      productImagesMap[product.id] =
        product.images && product.images.length > 0 ? product.images[0] : null;
    });

    // Calculate order totals using the provided items - FIXED CALCULATIONS
    const subtotal = parseFloat(
      items
        .reduce(
          (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
          0
        )
        .toFixed(2)
    );

    // Calculate retip total if any items have retipping service - FIXED
    const retipTotal = parseFloat(
      items
        .reduce((sum, item) => {
          const retipPrice = item.retipAdded
            ? parseFloat(item.retipPrice || 0)
            : 0;
          const quantity = parseInt(item.quantity);
          return sum + retipPrice * quantity;
        }, 0)
        .toFixed(2)
    );

    // FIXED: Proper decimal calculations

    const tax = parseFloat(payment.tax.toFixed(2));
    const platformFee = parseFloat(payment.commissionFee.toFixed(2));
    const shippingCost = 0.0; // Free shipping

    // FIXED: Final total calculation
    const total = parseFloat(
      (subtotal + tax + platformFee + shippingCost + retipTotal).toFixed(2)
    );

    console.log("Order totals:", {
      subtotal,
      retipTotal,
      tax,
      platformFee,
      total,
    });

    // Verify payment with Stripe if needed
    const paymentIntent = await stripe.paymentIntents.retrieve(payment.id);

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not been completed");
    }

    // Create order record - FIXED: Ensure all numeric values are properly formatted
    const order = await Order.create(
      {
        id: uuidv4(),
        buyer_id: userId,
        total_amount: total, // Now properly calculated as a clean decimal
        shipping_cost: shippingCost,
        platform_fee: platformFee,
        payment_completed: true,
        shipping_address: shipping,
        requires_retipping: retipTotal > 0,
        order_date: new Date(),
      },
      { transaction: t }
    );

    // Create order items directly from the provided items - FIXED
    for (const item of items) {
      const itemPrice = parseFloat(item.price);
      const itemQuantity = parseInt(item.quantity);
      const itemRetipPrice = item.retipAdded
        ? parseFloat(item.retipPrice || 0)
        : 0;

      await OrderItem.create(
        {
          id: uuidv4(),
          order_id: order.id,
          product_id: item.id,
          quantity: itemQuantity,
          order_status: "pending approval",
          payment_status: true,
          price: itemPrice,
          title: item.title,
          retip_added: item.retipAdded || false,
          retip_price: itemRetipPrice,
        },
        { transaction: t }
      );
    }

    // Clear user's cart
    const cart = await Cart.findOne({ where: { user_id: userId } });
    if (cart) {
      await CartItem.destroy({ where: { cart_id: cart.id }, transaction: t });
      await cart.update(
        { products_count: 0, total_price: 0 },
        { transaction: t }
      );
    }

    await t.commit();

    // Send response immediately
    res.status(201).json({
      success: true,
      orderId: order.id,
      message: "Order created successfully",
      itemsProcessed: items.length,
      orderTotal: total,
    });

    // Send emails asynchronously after response (fire and forget)
    setImmediate(async () => {
      try {
        // Get user data for email
        const userData = await User.findByPk(userId, {
          attributes: ["email", "first_name", "last_name"],
        });

        if (!userData) {
          console.error("User not found for email sending:", userId);
          return;
        }

        // Prepare items with proper structure for email functions (including product images)
        const emailItems = items.map((item) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          retipAdded: item.retipAdded || false,
          retipPrice: item.retipPrice || 0,
          product_image: productImagesMap[item.id] || null, // Get the first image from the map
        }));

        // Prepare order data with proper structure
        const orderDataForEmail = {
          id: order.id,
          total_amount: total,
          shipping_address: shipping,
          platform_fee: platformFee,
          shipping_cost: shippingCost,
          requires_retipping: retipTotal > 0,
          tax: tax,
        };

        // Prepare user data with proper structure
        const userDataForEmail = {
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
        };

        // Send both emails concurrently
        const [orderPlacementEmailResult, paymentSuccessEmailResult] =
          await Promise.allSettled([
            sendOrderPlacementEmail(
              orderDataForEmail,
              userDataForEmail,
              emailItems
            ),
            sendPaymentSuccessfulEmail(
              orderDataForEmail,
              userDataForEmail,
              paymentIntent,
              emailItems
            ),
          ]);

        // Log results (optional)
        if (
          orderPlacementEmailResult.status === "rejected" ||
          !orderPlacementEmailResult.value?.success
        ) {
          console.error(
            "Failed to send order placement email:",
            orderPlacementEmailResult.reason ||
              orderPlacementEmailResult.value?.message
          );
        } else {
          console.log(
            "Order placement email sent successfully for order:",
            order.id
          );
        }

        if (
          paymentSuccessEmailResult.status === "rejected" ||
          !paymentSuccessEmailResult.value?.success
        ) {
          console.error(
            "Failed to send payment success email:",
            paymentSuccessEmailResult.reason ||
              paymentSuccessEmailResult.value?.message
          );
        } else {
          console.log(
            "Payment success email sent successfully for order:",
            order.id
          );
        }

        console.log("Order emails processed for order ID:", order.id);
      } catch (emailError) {
        console.error("Error processing order emails:", emailError);
        // Optionally, you could add this to a retry queue here
      }
    });
  } catch (error) {
    await t.rollback();
    console.error("Error creating order:", error);
    res.status(500).json({ error: error.message });
  }
};
/**
 * Get user's order history
 * @route GET /api/checkout/orders
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { buyer_id: userId },
      order: [["order_date", "DESC"]],
      include: [
        {
          model: OrderItem,
          as: "items",
        },
      ],
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get order details by ID
 * @route GET /api/checkout/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: {
        id,
        buyer_id: userId, // Ensure user can only see their own orders
      },
      include: [
        {
          model: OrderItem,
          as: "items",
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Webhook handler for Stripe events
 * @route POST /api/checkout/webhook
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.rawBody, // You'll need to set up body-parser to preserve the raw body
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log("PaymentIntent was successful!", paymentIntent.id);
      // Update order status if necessary
      await handleSuccessfulPayment(paymentIntent);
      break;
    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log("Payment failed:", failedPayment.id);
      // Handle failed payment
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};

/**
 * Handle successful payment webhook event
 * @private
 */
async function handleSuccessfulPayment(paymentIntent) {
  try {
    // Find order by payment intent ID if you stored it during order creation
    // This is usually handled by the createOrder function, but this is a backup
    const metadata = paymentIntent.metadata;

    if (metadata && metadata.orderId) {
      await Order.update(
        { status: "paid" },
        { where: { id: metadata.orderId } }
      );
    }
  } catch (error) {
    console.error("Error handling successful payment:", error);
  }
}

/**
 * Handle failed payment webhook event
 * @private
 */
async function handleFailedPayment(failedPayment) {
  try {
    // Find order by payment intent ID if you stored it
    const metadata = failedPayment.metadata;

    if (metadata && metadata.orderId) {
      await Order.update(
        { status: "cancelled", updated_at: new Date() },
        { where: { id: metadata.orderId } }
      );
    }
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
}
