const express = require("express");
const {
  getSellerOrders,
  confirmOrder,
  rejectOrder,
  getSingleOrderItem,
  getAllOrders,
  getOrderItemsByOrderId,
  getBuyerOrders,
  getSellerOrderItemsByOrderId,
  getRejectedOrderItems,
  getShippedOrders,
  getRecentOrderShippingDetails,
} = require("../controllers/orders.controller");
const router = express.Router();

// Specific routes FIRST
router.get("/get-all-orders", getAllOrders);
router.get("/get-all-rejected-orders", getRejectedOrderItems);
router.get("/get-all-shipped-orders", getShippedOrders);
router.get("/order-item/:itemId", getSingleOrderItem);
router.put("/confirm/:itemId", confirmOrder);
router.put("/reject/:itemId", rejectOrder);

// Parameterized routes LAST
router.get("/:userId", getSellerOrders);
router.get("/recent-shipping-address/:userId", getRecentOrderShippingDetails);
router.get("/buyerOrders/:userId", getBuyerOrders);
router.get("/:orderId/items", getOrderItemsByOrderId);
router.get("/:orderId/sellers/:userId/items", getSellerOrderItemsByOrderId);

module.exports = router;
