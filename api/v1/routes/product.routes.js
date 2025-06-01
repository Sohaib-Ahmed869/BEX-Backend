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

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.post("/add/:userId", upload.array("files", 10), addProduct);

// Get all products for a user
router.get("/:userId", getUserProducts);
router.get("/getproductbyId/:productId", getProductById);
router.delete("/:productId", deleteProduct);
router.get("/", getAllProducts);
router.get("/getAllProducts", getProducts);
router.put("/update/:productId", upload.array("files", 10), updateProduct);

module.exports = router;
