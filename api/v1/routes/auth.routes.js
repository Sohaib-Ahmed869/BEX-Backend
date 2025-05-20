const express = require("express");
const router = express.Router();
const {
  login,
  RegisterBuyer,
  RegisterSeller,
} = require("../controllers/auth.controller");
require("dotenv").config();

router.post("/login", login);
router.post("/register-buyer", RegisterBuyer);
router.post("/register-seller", RegisterSeller);

module.exports = router;
