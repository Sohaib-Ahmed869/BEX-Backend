const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  addProductListing,
  getUserProductListings,
  getProductListingById,
  updateProductListing,
  deleteProductListing,
  getAllProductListings,
  getProductsByListingId,
  updateProductListingName,
} = require("../controllers/ProductListing.controller");

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Add a new product listing
router.post("/add/:userId", upload.array("files", 10), addProductListing);

// Get all product listings
router.get("/", getAllProductListings);

// Get all product listings for a specific user
router.get("/:userId", getUserProductListings);
router.get("/inventory/:listingId", getProductsByListingId);
// Get a specific product listing by ID
router.get("/getproductlistingbyId/:productListingId", getProductListingById);

// Update a product listing
router.put(
  "/update/:productListingId",
  upload.array("files", 10),
  updateProductListing
);

// Delete a product listing
router.delete("/:productListingId", deleteProductListing);
router.patch("/update/:listingId", updateProductListingName);
module.exports = router;
