const express = require("express");
const {
  createShipmentsForOrder,
  processUPSShipment,
  schedulePickup,
  cancelPickup,
  voidShipment,
  handleReturnShipment,
  getSellerShipments,
  getShipmentDetails,
  trackShipment,
  getSimulationStatuses,
  getDeliveryFee,
  getBuyerShipments,
  testUPSAuth,
} = require("../controllers/shipment.controller");

const router = express.Router();

// Test UPS authentication
router.get("/test-ups-auth", testUPSAuth);

// Delivery fee calculation for checkout
router.post("/calculate-delivery-fee", getDeliveryFee);

// Create shipments for an order
router.post("/create/:orderId", createShipmentsForOrder);

// Process UPS shipment creation
router.post("/process-ups/:shipmentId", processUPSShipment);

// Schedule pickup for shipment
router.post("/schedule-pickup/:shipmentId", schedulePickup);

// Cancel pickup for shipment
router.delete("/cancel-pickup/:shipmentId", cancelPickup);

// Void shipment
router.delete("/void/:shipmentId", voidShipment);

// Handle return shipment
router.post("/return/:shipmentId", handleReturnShipment);

// Track shipment (with optional simulation support in development)
router.put("/track/:shipmentId", trackShipment);

// Get available simulation statuses (development only)
router.get("/simulation-statuses", getSimulationStatuses);

// Get shipment details
router.get("/details/:shipmentId", getShipmentDetails);

// Get seller's shipments
router.get("/seller/:sellerId", getSellerShipments);

// Get buyer's shipments
router.get("/buyer/:buyerId", getBuyerShipments);

module.exports = router;
