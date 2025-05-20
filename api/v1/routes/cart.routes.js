const express = require("express");
const router = express.Router();
const {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
} = require("../controllers/cart.controller");

const { authenticate } = require("../../middleware/auth.middleware");
router.get("/:userId", authenticate, getCart);
router.post("/:userId/add", authenticate, addToCart);
router.post("/:userId/remove", authenticate, removeFromCart);
router.post("/:userId/clear", authenticate, clearCart);

module.exports = router;
