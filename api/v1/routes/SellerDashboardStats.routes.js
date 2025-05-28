const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getUserProductsIds,
} = require("../controllers/sellerDashboardStats.controller");
const {
  getInventoryDetails,
} = require("../controllers/sellerDashboardStats.controller");
// Get dashboard statistics for a seller
router.get("/stats/:userId", getDashboardStats);

// Get inventory details for a specific product
router.get("/inventory/:userId/:productId", getInventoryDetails);
router.get("/products/:userId", getUserProductsIds);

module.exports = router;
