const express = require("express");
const multer = require("multer");
const {
  getUserById,
  convertToSeller,
  getAllUsers,
  getUserInsights,
  updateUserVerification,
  suspendUser,
  getSellers,
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
router.get("/sellers", getSellers);
router.get("/", getAllUsers);
router.get("/:userId", getUserById);
router.get("/user-insights/:userId", getUserInsights);
router.patch("/:userId/suspend", suspendUser);

// Convert buyer to seller
router.put(
  "/convert-to-seller/:userId",
  upload.single("licenseImage"),
  convertToSeller
);
router.patch("/verify/:userId", updateUserVerification);

module.exports = router;
