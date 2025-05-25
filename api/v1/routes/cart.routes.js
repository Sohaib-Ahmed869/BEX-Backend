const express = require("express");
const router = express.Router();
const {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  addRetipToItem,
  removeRetipFromItem,
} = require("../controllers/cart.controller");

const { authenticate } = require("../../middleware/auth.middleware");
router.get("/:userId", authenticate, getCart);
router.post("/:userId/add", authenticate, addToCart);
router.post("/:userId/remove", authenticate, removeFromCart);
router.post("/:userId/clear", authenticate, clearCart);
router.post("/:userId/add-retip", addRetipToItem);
router.post("/:userId/remove-retip", removeRetipFromItem);
module.exports = router;
