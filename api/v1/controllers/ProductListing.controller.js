const { ProductListing } = require("../../../models/ProductListing.model");
const { sequelize } = require("../../../config/db");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { Product } = require("../../../models");
// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const uploadFileToS3 = async (file) => {
  // Validate file type
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error("Invalid file format. Only JPEG, JPG and PNG are allowed");
  }

  // Create unique filename
  const filename = `${uuidv4()}${fileExtension}`;

  // Upload to S3
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `product-listings/${filename}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
};

/**
 * Add a new product listing
 */
exports.addProductListing = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const productData = req.body;
    const files = req.files || [];

    // Validate required fields
    if (
      !productData.Product_Name ||
      !productData.Category ||
      !productData.Stock
    ) {
      throw new Error(
        "Missing required fields: Product_Name, Category, and Stock are required"
      );
    }

    // Upload images to S3 if any
    const imageUrls = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const imageUrl = await uploadFileToS3(file);
        imageUrls.push(imageUrl);
      }
    }

    // Create product listing
    const productListing = await ProductListing.create(
      {
        user_id: userId,
        Product_Name: productData.Product_Name,
        Category: productData.Category,
        Manufacturer: productData.Manufacturer || null,
        Description: productData.Description || null,
        Stock: parseInt(productData.Stock, 10),
        Images: imageUrls,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Product listing added successfully",
      data: {
        id: productListing.id,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Update product listing name by listing ID
 */
exports.updateProductListingName = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const listingId = req.params.listingId;
    const { Product_Name } = req.body;

    // Validate required fields
    if (!Product_Name) {
      throw new Error("Product_Name is required");
    }

    if (!listingId) {
      throw new Error("Listing ID is required");
    }

    // Check if product listing exists
    const existingListing = await ProductListing.findByPk(listingId);
    if (!existingListing) {
      throw new Error("Product listing not found");
    }

    // Update the product listing name
    await ProductListing.update(
      {
        Product_Name: Product_Name,
      },
      {
        where: { id: listingId },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product listing name updated successfully",
      data: {
        id: listingId,
        Product_Name: Product_Name,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Get all product listings
 */
exports.getAllProductListings = async (req, res) => {
  try {
    const productListings = await ProductListing.findAll({
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: productListings.length,
      data: productListings,
    });
  } catch (error) {
    console.error("Error fetching product listings:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get product listings by user ID
 */
exports.getUserProductListings = async (req, res) => {
  try {
    const userId = req.params.userId;

    const productListings = await ProductListing.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: productListings.length,
      data: productListings,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get a specific product listing by ID
 */
exports.getProductListingById = async (req, res) => {
  try {
    const productListingId = req.params.productListingId;

    const productListing = await ProductListing.findByPk(productListingId);

    if (!productListing) {
      return res.status(404).json({
        success: false,
        message: "Product listing not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: productListing,
    });
  } catch (error) {
    console.error("Error fetching product listing:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update an existing product listing
 */
exports.updateProductListing = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const productListingId = req.params.productListingId;
    const productData = req.body;
    const files = req.files || [];

    // Find the product listing to update
    const productListing = await ProductListing.findByPk(productListingId, {
      transaction,
    });

    if (!productListing) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product listing not found",
      });
    }

    // Handle image updates
    let currentImages = productListing.Images || [];

    // Parse existing images if they come from frontend
    if (productData.Images) {
      try {
        const frontendImages =
          typeof productData.Images === "string"
            ? JSON.parse(productData.Images)
            : productData.Images;

        // Filter existing images that should be kept
        currentImages = frontendImages
          .filter((img) => img.isExisting)
          .map((img) => img.url || img);
      } catch (e) {
        // If parsing fails, keep current images
        console.warn("Error parsing frontend images:", e);
      }
    }

    // Upload new image files to S3
    if (files && files.length > 0) {
      for (const file of files) {
        const imageUrl = await uploadFileToS3(file);
        currentImages.push(imageUrl);
      }
    }

    // Prepare update data
    const updateData = {
      Product_Name: productData.Product_Name || productListing.Product_Name,
      Category: productData.Category || productListing.Category,
      Manufacturer:
        productData.Manufacturer !== undefined
          ? productData.Manufacturer
          : productListing.Manufacturer,
      Description:
        productData.Description !== undefined
          ? productData.Description
          : productListing.Description,
      Stock:
        productData.Stock !== undefined
          ? parseInt(productData.Stock, 10)
          : productListing.Stock,
      Images: currentImages,
    };

    // Update product listing record
    await productListing.update(updateData, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product listing updated successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating product listing:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete a product listing
 */
exports.deleteProductListing = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const productListingId = req.params.productListingId;

    const productListing = await ProductListing.findByPk(productListingId, {
      transaction,
    });

    if (!productListing) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product listing not found",
      });
    }

    // Delete the product listing
    await productListing.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product listing deleted successfully",
      data: {
        productListingId: productListing.id,
        Product_Name: productListing.Product_Name,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting product listing:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting product listing",
    });
  }
};
exports.getProductsByListingId = async (req, res) => {
  try {
    // Extract listing_id from route parameters
    const { listingId } = req.params;

    // Validate that listingId is provided
    if (!listingId) {
      return res.status(400).json({
        success: false,
        message: "Listing ID is required",
      });
    }

    // Check if the association exists
    const isAssociationDefined =
      Product.associations && Product.associations.retippingDetails;

    let products;

    // Base where condition to exclude archived products and filter by listing_id
    const whereCondition = {
      is_Archived: false, // Only fetch non-archived products
      listing_id: listingId, // Filter by specific listing_id
    };

    if (isAssociationDefined) {
      // If association exists, include the retipping details
      products = await Product.findAll({
        where: whereCondition,
        include: [
          {
            model: ProductRetippingDetails,
            as: "retipping_details",
            attributes: [
              "diameter",
              "enable_diy",
              "per_segment_price",
              "segments",
              "total_price",
            ],
            required: false, // LEFT JOIN - include products even without retipping details
          },
        ],
        order: [["created_at", "DESC"]],
      });
    } else {
      // If association doesn't exist, fetch products without including retipping details
      products = await Product.findAll({
        where: whereCondition,
        order: [["created_at", "DESC"]],
      });
    }

    // Log for debugging
    console.log(
      `Found ${products.length} non-archived products for listing ID: ${listingId}`
    );

    return res.status(200).json({
      success: true,
      count: products.length,
      listing_id: listingId,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by listing ID:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
