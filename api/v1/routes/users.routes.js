const express = require("express");
const multer = require("multer");
const {
  getUserById,
  convertToSeller,
} = require("../controllers/user.controller");

const router = express.Router();

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Get user by ID
router.get("/:userId", getUserById);

// Convert buyer to seller
router.put(
  "/convert-to-seller/:userId",
  upload.single("licenseImage"),
  convertToSeller
);

module.exports = router;
