// routes/payoutStatsRoutes.js
const express = require("express");
const router = express.Router();
const {
  getPayoutStats,
  getQuickStats,
} = require("../controllers/PayoutStats.controller");
const { authenticate } = require("../../middleware/auth.middleware"); // Adjust path as needed

// Get detailed payout statistics and analytics
router.get("/stats", authenticate, getPayoutStats);

// Get quick stats for dashboard cards
router.get("/quick-stats", authenticate, getQuickStats);

module.exports = router;
