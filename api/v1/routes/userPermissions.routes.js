const express = require("express");
const {
  getUserPermissions,
  getAllAdminPermissions,
  updateUserPermissions,
  initializeRootAdmin,
  checkPermission,
} = require("../controllers/userPermissions.controller");

const router = express.Router();

// Get all admin users with their permissions
router.get("/", getAllAdminPermissions);

// Initialize root admin permissions (run once)
router.post("/initialize/initialize-root", initializeRootAdmin);

// Check if user has specific permission
router.get("/:userId/check", checkPermission);

// Get permissions for a specific user
router.get("/:userId", getUserPermissions);

// Update user permissions
router.put("/:userId", updateUserPermissions);

module.exports = router;
