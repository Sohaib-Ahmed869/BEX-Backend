const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishlist.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// All wishlist routes are protected

// Get wishlist for a user
router.get("/:userId", authenticate, wishlistController.getWishlist);

// Add product to wishlist
router.post("/:userId/add", authenticate, wishlistController.addToWishlist);

// Remove product from wishlist
router.post(
  "/:userId/remove",
  authenticate,
  wishlistController.removeFromWishlist
);

// Clear entire wishlist
router.post("/:userId/clear", authenticate, wishlistController.clearWishlist);

// Check if product is in wishlist
router.get(
  "/:userId/check/:productId",
  authenticate,
  wishlistController.checkWishlistItem
);

module.exports = router;
