const express = require("express");
const {
  getAllCommissions,
  getCommissionByCategory,
  addCommission,
  updateCommission,
  deleteCommission,
  initializeCommissions,
} = require("../controllers/commission.controller");

const router = express.Router();

// Specific routes FIRST
router.get("/", getAllCommissions);
router.post("/", addCommission);
router.post("/initialize", initializeCommissions);

// Parameterized routes LAST
router.get("/:category", getCommissionByCategory);
router.put("/:category", updateCommission);
router.delete("/:category", deleteCommission);

module.exports = router;
