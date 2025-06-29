const express = require("express");
const {
  createShipment,
  trackShipment,
  getShippingRates,
  getSellerShipments,
  getShipmentDetails,
  cancelShipment,
  getShipmentLabel,
  updateShipmentStatus,
  getOrderShipments,
  bulkTrackShipments,
} = require("../controllers/shipment.controller");

const router = express.Router();

// Create UPS shipment for specific order items
router.post("/create", createShipment);

// Get shipping rates for an order from a specific seller
router.get("/rates/:orderId/:sellerId", getShippingRates);

// Track shipment by shipment ID
router.get("/track/:shipmentId", trackShipment);

// Get all shipments for a seller with pagination and filtering
router.get("/seller/:sellerId", getSellerShipments);

// Get specific shipment details
router.get("/:shipmentId", getShipmentDetails);

// Cancel shipment
router.post("/:shipmentId/cancel", cancelShipment);

// Get shipment label (download shipping label)
router.get("/:shipmentId/label", getShipmentLabel);

// Update shipment status manually
router.put("/:shipmentId/status", updateShipmentStatus);

// Get shipments by order ID
router.get("/order/:orderId", getOrderShipments);

// Bulk track multiple shipments
router.post("/track/bulk", bulkTrackShipments);

module.exports = router;
