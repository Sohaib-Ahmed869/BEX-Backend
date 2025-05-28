const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  login,
  RegisterBuyer,
  RegisterSeller,
} = require("../controllers/auth.controller");
require("dotenv").config();

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.post("/login", login);
router.post("/register-buyer", RegisterBuyer);
router.post("/register-seller", upload.single("licenseImage"), RegisterSeller);

module.exports = router;
