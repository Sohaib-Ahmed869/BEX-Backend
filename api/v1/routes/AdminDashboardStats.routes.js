const express = require("express");
const router = express.Router();
const {
  getAdminDashboardStats,
  getPaymentAnalytics,
  getCompanyPerformance,
} = require("../controllers/adminDashboardStats.controller");

// Get comprehensive admin dashboard statistics

router.get("/stats", getAdminDashboardStats);

// Get detailed payment analytics

router.get("/payments", getPaymentAnalytics);

// Get company performance analytics

router.get("/companies", getCompanyPerformance);

module.exports = router;
