// src/routes/stripeConnect.routes.js
const express = require("express");
const router = express.Router();
const {
  checkAccount,
  createExpressAccount,
  createOnboardingLink,
  getAccountStatus,
  createPayout,
  getSellerPayouts,
  getAllPayouts,
  createSellerDashboardLink,
} = require("../controllers/stripeConnect.controller");
const { authenticate } = require("../../middleware/auth.middleware");
// Seller routes
router.get("/check-account", authenticate, checkAccount);
router.post("/create-express-account", authenticate, createExpressAccount);
router.post("/create-onboarding-link", authenticate, createOnboardingLink);
router.get("/account-status/:accountId", authenticate, getAccountStatus);
router.get("/payouts", authenticate, getSellerPayouts);

// Admin routes
router.post("/payout", authenticate, createPayout);
router.get("/admin/payouts", authenticate, getAllPayouts);
router.get(
  "/create-stripe-dashboard-link",
  authenticate,
  createSellerDashboardLink
);

module.exports = router;
