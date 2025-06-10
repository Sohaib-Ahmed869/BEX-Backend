const express = require("express");
const {
  createDispute,
  getUserDisputes,
  getDisputeDetails,
  getAllDisputes,
  updateDisputeStatus,
  updateDispute,
  getDisputeStatistics,
  addDisputeResponse,
  getDisputeChat,
} = require("../controllers/orderDisputes.controller");

const router = express.Router();

// Admin routes (specific routes FIRST)
router.get("/admin/all-disputes", getAllDisputes);
router.get("/admin/statistics", getDisputeStatistics);
router.put("/admin/:disputeId/status", updateDisputeStatus);

// Chat/Response routes (NEW)
router.post("/:disputeId/response", addDisputeResponse);
router.get("/:disputeId/chat", getDisputeChat);

// Public/User routes (specific routes FIRST)
router.post("/create", createDispute);
router.get("/details/:disputeId", getDisputeDetails);
router.put("/update/:disputeId", updateDispute);

// Parameterized routes LAST
router.get("/user/:userId", getUserDisputes);

module.exports = router;
