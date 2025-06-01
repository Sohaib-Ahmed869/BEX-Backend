const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  addProduct,
  getUserProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProducts,
  searchProducts,
  getAllProducts,
} = require("../controllers/products.controller");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.get("/", getAllProducts);
router.get("/getAllProducts", getProducts);
router.get("/getproductbyId/:productId", getProductById);

// POST routes
router.post("/add/:userId", upload.array("files", 10), addProduct);

// PUT routes
router.put("/update/:productId", upload.array("files", 10), updateProduct);

// DELETE routes
router.delete("/:productId", deleteProduct);

// DYNAMIC PARAMETER ROUTES LAST
router.get("/:userId", getUserProducts);

module.exports = router;
