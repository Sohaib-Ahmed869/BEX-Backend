const express = require("express");
const {
  getSellerOrders,
  confirmOrder,
  rejectOrder,
  getSingleOrderItem,
  getAllOrders,
  getOrderItemsByOrderId,
} = require("../controllers/orders.controller");
const router = express.Router();

// Specific routes FIRST
router.get("/get-all-orders", getAllOrders);
router.get("/order-item/:itemId", getSingleOrderItem);
router.put("/confirm/:itemId", confirmOrder);
router.put("/reject/:itemId", rejectOrder);

// Parameterized routes LAST
router.get("/:userId", getSellerOrders);
router.get("/:orderId/items", getOrderItemsByOrderId);

module.exports = router;
