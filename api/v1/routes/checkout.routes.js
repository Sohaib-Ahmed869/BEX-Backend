const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/checkout.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// Create payment intent
router.post(
  "/create-payment-intent",
  authenticate,
  checkoutController.createPaymentIntent
);

// Create order after payment
router.post(
  "/create-order/:userId",
  authenticate,
  checkoutController.createOrder
);

// Get user's order history
router.get("/orders", authenticate, checkoutController.getOrders);

// Get specific order details
router.get("/orders/:id", authenticate, checkoutController.getOrderById);

// Stripe webhook handling - typically this would not require auth
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Use raw body parser for webhook verification
  (req, res, next) => {
    // Skip auth middleware for webhook route
    next();
  },
  checkoutController.handleWebhook
);

module.exports = router;
