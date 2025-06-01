const express = require("express");
const router = express.Router();
const {
  flagProduct,
  unflagProduct,
  getFlaggedProducts,
  updateFlagStatus,
  getFlaggingStats,
} = require("../../v1/controllers/flagProducts.controller");

// Flag a product
router.post("/flag/:productId", flagProduct);

// Unflag a product (resolve or dismiss)
router.put("/unflag/:productId", unflagProduct);

// Get all flagged products with optional filters
// Query params: status, severity_level, page, limit, product_id, flagged_by
router.get("/", getFlaggedProducts);

// Update flag status (for admin review)
router.put("/status/:flagId", updateFlagStatus);

// Get flagging statistics
router.get("/stats", getFlaggingStats);

module.exports = router;
