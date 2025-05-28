const express = require("express");
const {
  getSellerOrders,
  confirmOrder,
  rejectOrder,
  getSingleOrderItem,
} = require("../controllers/orders.controller");
const router = express.Router();

router.get("/:userId", getSellerOrders);
router.put("/confirm/:itemId", confirmOrder);
router.put("/reject/:itemId", rejectOrder);
router.get("/order-item/:itemId", getSingleOrderItem);

module.exports = router;
