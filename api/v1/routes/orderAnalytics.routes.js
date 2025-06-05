const express = require("express");
const router = express.Router();
const {
  getAdminOrderAnalytics,
} = require("../controllers/OrderAnalyticsController");

// Route for order analytics with average order value
router.get("/", getAdminOrderAnalytics);

module.exports = router;
