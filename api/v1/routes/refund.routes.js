const express = require("express");
const router = express.Router();
const {
  refundOrderItem,
  getRefundedOrderItems,
} = require("../controllers/refund.controller");

router.post("/", refundOrderItem);
router.get("/", getRefundedOrderItems);

module.exports = router;
