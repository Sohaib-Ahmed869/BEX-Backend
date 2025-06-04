const express = require("express");
const {
  createShipment,
  trackShipment,
  getShipmentRates,
  refreshShipmentData,
  updateShipmentStatus,
  startTrackingUpdates,
} = require("../controllers/shipment.controller");

const router = express.Router();

// Create shipment for an order
router.post("/create-shipment", createShipment);

// Track shipment by order ID
router.get("/track/:orderId", trackShipment);
router.post("/start-tracking/:orderId", startTrackingUpdates);

// Get shipping rates for an order
router.get("/rates/:orderId/:sellerId", getShipmentRates);
router.get("/refresh/:orderId", refreshShipmentData);

// Update shipment status
router.put("/status/:orderId", updateShipmentStatus);

module.exports = router;
