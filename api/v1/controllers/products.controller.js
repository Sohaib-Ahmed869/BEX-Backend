const {
  Product,
  ProductRetippingDetails,
  User,
  FlaggedProducts,
} = require("../../../models");
const { ProductListing } = require("../../../models/ProductListing.model");
const { sequelize } = require("../../../config/db");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { Op } = require("sequelize");
const uploadTokens = new Map();

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
    Key: `products/${filename}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
};

// qrCode
const TOKEN_EXPIRATION_TIME = 10 * 60 * 1000;

// Upload file to S3 for mobile uploads (TEMPORARY storage)
const uploadMobileFileToS3 = async (file) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(
      "Invalid file format. Only JPEG, JPG, PNG, and WebP are allowed"
    );
  }

  const filename = `temp-mobile-uploads/${uuidv4()}${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
};

// Move file from temp to permanent location
const moveFileFromTempToPermanent = async (tempUrl) => {
  try {
    const tempKey = tempUrl.split(".com/")[1];
    const filename = path.basename(tempKey);
    const permanentKey = `products/${filename}`;

    await s3
      .copyObject({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        CopySource: `${process.env.AWS_S3_BUCKET_NAME}/${tempKey}`,
        Key: permanentKey,
        ACL: "public-read",
      })
      .promise();

    await s3
      .deleteObject({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: tempKey,
      })
      .promise();

    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${permanentKey}`;
  } catch (error) {
    console.error("Error moving file from temp to permanent:", error);
    return tempUrl;
  }
};

// Clean up expired tokens
exports.cleanupTempImages = async (req, res) => {
  try {
    let cleanedCount = 0;
    const now = new Date();

    for (const [token, tokenData] of uploadTokens.entries()) {
      if (tokenData.expiresAt < now) {
        if (tokenData.tempImages && tokenData.tempImages.length > 0) {
          for (const image of tokenData.tempImages) {
            try {
              const key = image.url.split(".com/")[1];
              await s3
                .deleteObject({
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: key,
                })
                .promise();
              cleanedCount++;
            } catch (error) {
              console.error("Error deleting temp image:", error);
            }
          }
        }
        uploadTokens.delete(token);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} temp images`,
      cleanedCount,
    });
  } catch (error) {
    console.error("Error cleaning up temp images:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.cleanupExpiredTokens = async (req, res) => {
  try {
    const cleanedCount = cleanupExpiredTokens();
    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired tokens`,
      cleanedCount,
      activeTokens: uploadTokens.size,
    });
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Register upload token for QR code
 */
exports.registerUploadToken = async (req, res) => {
  try {
    const { token, expiresAt } = req.body;

    if (!token || !expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Token and expiration date are required",
      });
    }

    uploadTokens.set(token, {
      expiresAt: new Date(expiresAt),
      createdAt: new Date(),
      used: false,
      uploadsCount: 0,
      tempImages: [],
    });

    cleanupExpiredTokens();

    console.log(`Registered upload token: ${token}`);

    return res.status(200).json({
      success: true,
      message: "Token registered successfully",
    });
  } catch (error) {
    console.error("Error registering upload token:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Validate upload token
 */
exports.validateUploadToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        valid: false,
        message: "Token is required",
      });
    }

    const tokenData = uploadTokens.get(token);
    if (!tokenData) {
      return res.status(404).json({
        valid: false,
        message: "Token not found",
      });
    }

    const now = new Date();
    if (tokenData.expiresAt < now) {
      uploadTokens.delete(token);
      return res.status(410).json({
        valid: false,
        message: "Token has expired",
      });
    }

    return res.status(200).json({
      valid: true,
      expiresAt: tokenData.expiresAt,
      uploadsCount: tokenData.uploadsCount,
    });
  } catch (error) {
    console.error("Error validating upload token:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Handle mobile file upload - stores in TEMP location
 */
exports.handleMobileUpload = async (req, res) => {
  try {
    const { token } = req.body;
    const files = req.files || [];

    console.log("Mobile upload request received:", {
      token,
      filesCount: files.length,
      timestamp: new Date().toISOString(),
    });

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Upload token is required",
      });
    }

    const tokenData = uploadTokens.get(token);
    if (!tokenData) {
      console.log("Invalid token attempted:", token);
      return res.status(400).json({
        success: false,
        message: "Invalid upload token",
      });
    }

    const now = new Date();
    if (tokenData.expiresAt < now) {
      uploadTokens.delete(token);
      console.log("Expired token attempted:", token);
      return res.status(400).json({
        success: false,
        message: "Upload token has expired",
      });
    }

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
      });
    }

    const uploadedImages = [];
    const failedUploads = [];

    for (const file of files) {
      try {
        console.log("Uploading file:", file.originalname, "Size:", file.size);
        const imageUrl = await uploadMobileFileToS3(file);
        const imageData = {
          id: uuidv4(),
          url: imageUrl,
          name: file.originalname,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          isTemp: true,
        };

        uploadedImages.push(imageData);
        tokenData.tempImages.push(imageData);
        console.log(
          "Successfully uploaded:",
          imageData.name,
          "URL:",
          imageData.url
        );
      } catch (uploadError) {
        console.error("Error uploading file:", uploadError);
        failedUploads.push({
          name: file.originalname,
          error: uploadError.message,
        });
      }
    }

    if (uploadedImages.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload any images",
        errors: failedUploads,
      });
    }

    tokenData.uploadsCount += uploadedImages.length;
    uploadTokens.set(token, tokenData);

    // Enhanced Socket.IO emission with better error handling
    const uploadNamespace = req.app.get("uploadNamespace");
    if (uploadNamespace) {
      console.log("Emitting to upload namespace:", `mobile-upload-${token}`);

      uploadedImages.forEach((image) => {
        // FIXED: Only emit once to the upload namespace
        uploadNamespace.emit(`mobile-upload-${token}`, image); // ← Only one emission now

        console.log("Emitted image data:", {
          id: image.id,
          name: image.name,
          url: image.url.substring(0, 50) + "...",
          size: image.size,
        });
      });
    } else {
      console.error("Upload namespace not found!");
    }

    return res.status(200).json({
      success: true,
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
      images: uploadedImages,
      failed: failedUploads,
      totalUploads: tokenData.uploadsCount,
    });
  } catch (error) {
    console.error("Error handling mobile upload:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Cleanup temp images for expired or completed uploads
 */
exports.cleanupTempImages = async (req, res) => {
  try {
    let cleanedCount = 0;
    const now = new Date();

    for (const [token, tokenData] of uploadTokens.entries()) {
      // Clean up expired tokens and their temp images
      if (tokenData.expiresAt < now) {
        // Delete temp images from S3
        if (tokenData.tempImages && tokenData.tempImages.length > 0) {
          for (const image of tokenData.tempImages) {
            try {
              const key = image.url.split(".com/")[1];
              await s3
                .deleteObject({
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: key,
                })
                .promise();
              cleanedCount++;
            } catch (error) {
              console.error("Error deleting temp image:", error);
            }
          }
        }
        uploadTokens.delete(token);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} temp images`,
      cleanedCount,
    });
  } catch (error) {
    console.error("Error cleaning up temp images:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get upload statistics for a token
 */
exports.getUploadStats = async (req, res) => {
  try {
    const { token } = req.params;
    const tokenData = uploadTokens.get(token);

    if (!tokenData) {
      return res.status(404).json({
        success: false,
        message: "Token not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token,
        createdAt: tokenData.createdAt,
        expiresAt: tokenData.expiresAt,
        uploadsCount: tokenData.uploadsCount,
        isExpired: new Date() > tokenData.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error getting upload stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Cleanup expired tokens (for cron job or manual cleanup)
 */
exports.cleanupExpiredTokens = async (req, res) => {
  try {
    const cleanedCount = cleanupExpiredTokens();

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired tokens`,
      cleanedCount,
      activeTokens: uploadTokens.size,
    });
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// qrcode
/**
 * Add a new product with specifications and retipping info if applicable
 */
exports.addProduct = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.params.userId;
    const productData = req.body;
    const files = req.files || [];

    console.log("Adding product with data:", {
      userId,
      title: productData.title,
      filesCount: files.length,
      hasMobileImages: !!productData.mobileImages,
    });

    // Parse JSON strings if needed
    let attributes = {};
    if (productData.attributes) {
      try {
        attributes = JSON.parse(productData.attributes);
      } catch (e) {
        attributes = productData.attributes;
      }
    }

    let retippingData = null;
    if (productData.retipping) {
      try {
        retippingData = JSON.parse(productData.retipping);
      } catch (e) {
        retippingData = productData.retipping;
      }
    }

    // Parse mobile uploaded images if any
    let mobileImages = [];
    if (productData.mobileImages) {
      try {
        mobileImages = JSON.parse(productData.mobileImages);
        console.log("Parsed mobile images:", mobileImages.length);
      } catch (e) {
        console.error("Error parsing mobile images:", e);
      }
    }

    // Validate basic product data
    if (
      !productData.title ||
      !productData.price ||
      !productData.condition ||
      !productData.category ||
      !productData.weight ||
      !productData.height ||
      !productData.width ||
      !productData.length
    ) {
      throw new Error("Missing required product information");
    }

    // Upload desktop images to S3 if any
    const imageUrls = [];
    if (files && files.length > 0) {
      console.log("Processing desktop files:", files.length);
      for (const file of files) {
        const imageUrl = await uploadFileToS3(file);
        imageUrls.push(imageUrl);
        console.log("Desktop image uploaded:", imageUrl);
      }
    }

    // Process mobile uploaded images (move from temp to permanent)
    if (mobileImages && mobileImages.length > 0) {
      console.log("Processing mobile images:", mobileImages.length);
      for (const mobileImage of mobileImages) {
        if (mobileImage.url) {
          try {
            const permanentUrl = await moveFileFromTempToPermanent(
              mobileImage.url
            );
            imageUrls.push(permanentUrl);
            console.log("Mobile image moved to permanent:", permanentUrl);
          } catch (error) {
            console.error("Error moving mobile image:", error);
            // If move fails, use original URL
            imageUrls.push(mobileImage.url);
          }
        }
      }
    }

    console.log("Total images for product:", imageUrls.length);

    // Validate that at least one image is provided
    if (imageUrls.length === 0) {
      throw new Error("At least one image is required");
    }

    // Convert list_for_selling to boolean if it's a string
    const listForSelling =
      productData.list_for_selling === "false" ? false : true;

    // Parse quantity and validate
    const quantity = Number.parseInt(productData.quantity || 1, 10);

    // Create product with specifications directly in the model
    const product = await Product.create(
      {
        user_id: userId,
        listing_id: productData.listing_id,
        category: productData.category,
        title: productData.title,
        description: productData.description || "",
        price: Number.parseFloat(productData.price),
        quantity: quantity,
        weight: Number.parseFloat(productData.weight),
        height: Number.parseFloat(productData.height),
        width: Number.parseFloat(productData.width),
        length: Number.parseFloat(productData.length),
        condition: productData.condition,
        subtype: productData.subtype || null,
        location: productData.location || null,
        images: imageUrls, // Combined desktop + mobile images
        specifications: attributes,
        is_active: true,
        list_for_selling: listForSelling,
      },
      { transaction }
    );

    // Update listing stock if quantity > 0 and listing_id is provided
    if (quantity > 0 && productData.listing_id) {
      await ProductListing.increment("Stock", {
        by: 1,
        where: { id: productData.listing_id },
        transaction,
      });
    }

    // Add retipping details if category is Core Drill Bits
    if (productData.category === "Core Drill Bits" && retippingData) {
      await ProductRetippingDetails.create(
        {
          product_id: product.id,
          diameter: retippingData.diameter,
          enable_diy:
            retippingData.enable_diy === "true" ||
            retippingData.enable_diy === true,
          per_segment_price: retippingData.per_segment_price
            ? Number.parseFloat(retippingData.per_segment_price)
            : null,
          segments: retippingData.segments
            ? Number.parseInt(retippingData.segments, 10)
            : null,
          total_price: retippingData.total_price
            ? Number.parseFloat(retippingData.total_price)
            : null,
        },
        { transaction }
      );
    }

    await transaction.commit();

    console.log("Product created successfully:", {
      id: product.id,
      title: product.title,
      imagesCount: imageUrls.length,
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: {
        id: product.id,
        imagesCount: imageUrls.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding product:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    // First, check if the association exists
    const isAssociationDefined =
      Product.associations && Product.associations.retippingDetails;

    let products;

    // Base where condition to exclude archived products
    const whereCondition = {
      is_Archived: false,
      is_flagged: false,
      list_for_selling: true,
      is_active: true,
    };

    if (isAssociationDefined) {
      // If association exists, include the retipping details and user information
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
          {
            model: User,
            as: "seller", // Using the correct alias from your association
            attributes: ["seller_approval_status"],
            required: false, // LEFT JOIN - include products even if user info is missing
          },
        ],
        order: [["created_at", "DESC"]],
      });
    } else {
      // If association doesn't exist, fetch products with user information
      products = await Product.findAll({
        where: whereCondition,
        include: [
          {
            model: User,
            as: "seller", // Using the correct alias from your association
            attributes: ["seller_approval_status"],
            required: false, // LEFT JOIN - include products even if user info is missing
          },
        ],
        order: [["created_at", "DESC"]],
      });
    }

    // Transform the products to include is_verified field
    const transformedProducts = products.map((product) => {
      const productData = product.toJSON();

      // Check if the seller is approved
      const isVerified =
        productData.seller &&
        productData.seller.seller_approval_status === "approved";

      // Add is_verified field and remove the seller data from the response
      const { seller, ...productWithoutSeller } = productData;

      return {
        ...productWithoutSeller,
        is_verified: isVerified,
      };
    });

    // Log the unique user_ids for debugging
    const uniqueUserIds = [
      ...new Set(products.map((product) => product.user_id)),
    ];
    console.log(
      `Found ${products.length} non-archived products from ${uniqueUserIds.length} unique sellers`
    );

    return res.status(200).json({
      success: true,
      data: transformedProducts,
      totalCount: transformedProducts.length,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// exports.getProducts = async (req, res) => {
//   try {
//     // First, check if the association exists
//     const isAssociationDefined =
//       Product.associations && Product.associations.retippingDetails;

//     let products;

//     // Base where condition to exclude archived products
//     const whereCondition = {
//       is_Archived: false,
//       is_flagged: false,
//       list_for_selling: true,
//     };

//     if (isAssociationDefined) {
//       // If association exists, include the retipping details
//       products = await Product.findAll({
//         where: whereCondition,
//         include: [
//           {
//             model: ProductRetippingDetails,
//             as: "retipping_details",
//             attributes: [
//               "diameter",
//               "enable_diy",
//               "per_segment_price",
//               "segments",
//               "total_price",
//             ],
//             required: false, // LEFT JOIN - include products even without retipping details
//           },
//         ],
//         order: [["created_at", "DESC"]],
//       });
//     } else {
//       // If association doesn't exist, fetch products without including retipping details
//       products = await Product.findAll({
//         where: whereCondition,
//         order: [["created_at", "DESC"]],
//       });
//     }

//     // Log the unique user_ids for debugging
//     const uniqueUserIds = [
//       ...new Set(products.map((product) => product.user_id)),
//     ];
//     console.log(
//       `Found ${products.length} non-archived products from ${uniqueUserIds.length} unique sellers`
//     );

//     return res.status(200).json({
//       success: true,
//       data: products,
//       totalCount: products.length,
//     });
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
exports.getAllProducts = async (req, res) => {
  try {
    // Extract pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page number must be greater than 0",
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }

    // First, check if the association exists
    const isAssociationDefined =
      Product.associations && Product.associations.retippingDetails;

    let products;
    let totalCount;

    // Base where condition to exclude archived products
    const whereCondition = {
      is_Archived: false,
      list_for_selling: true,
      is_active: true,
      is_flagged: false,

      // Only fetch non-archived products
    };

    if (isAssociationDefined) {
      // If association exists, include the retipping details
      const result = await Product.findAndCountAll({
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
        limit: limit,
        offset: offset,
        distinct: true, // Important when using includes to get accurate count
      });

      products = result.rows;
      totalCount = result.count;
    } else {
      // If association doesn't exist, fetch products without including retipping details
      const result = await Product.findAndCountAll({
        where: whereCondition,
        order: [["created_at", "DESC"]],
        limit: limit,
        offset: offset,
      });

      products = result.rows;
      totalCount = result.count;
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Log the unique user_ids for debugging
    const uniqueUserIds = [
      ...new Set(products.map((product) => product.user_id)),
    ];
    console.log(
      `Found ${products.length} non-archived products from ${uniqueUserIds.length} unique sellers (Page ${page}/${totalPages})`
    );

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getUserProducts = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find all products associated with the user ID
    const products = await Product.findAll({
      where: { user_id: userId, is_Archived: false, is_flagged: false },
      order: [["created_at", "DESC"]],
    });

    // Process each product to check for retipping details
    const processedProducts = await Promise.all(
      products.map(async (product) => {
        // Convert the product to a plain object to easily modify it
        const productData = product.get({ plain: true });

        // Check if retipping details exist for this product
        const retippingDetails = await ProductRetippingDetails.findOne({
          where: { product_id: product.id },
          attributes: [
            "diameter",
            "enable_diy",
            "per_segment_price",
            "segments",
            "total_price",
          ],
        });

        // If retipping details exist, add them to the product under retippingDetails
        if (retippingDetails) {
          productData.retippingDetails = retippingDetails.get({ plain: true });
        }

        return productData;
      })
    );

    return res.status(200).json({
      success: true,
      count: processedProducts.length,
      data: processedProducts,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Get a specific product by ID
 */
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.productId;

    // First, find the product without retipping details
    const product = await Product.findByPk(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Convert product to plain object for easy modification
    const productData = product.get({ plain: true });

    // Check if retipping details exist for this product
    const retippingDetails = await ProductRetippingDetails.findOne({
      where: { product_id: productId },
      attributes: [
        "diameter",
        "enable_diy",
        "per_segment_price",
        "segments",
        "total_price",
      ],
    });

    // If retipping details exist, add them to the product
    if (retippingDetails) {
      productData.retippingDetails = retippingDetails.get({ plain: true });
    }

    // Check if product is flagged and get flagging details
    if (productData.is_flagged) {
      // Import FlaggedProducts model (adjust path as needed)

      const flaggingDetails = await FlaggedProducts.findAll({
        where: {
          product_id: productId,
          status: ["PENDING", "REVIEWED"], // Only get active flags
        },
        attributes: [
          "id",
          "flagging_reason",
          "severity_level",
          "description",
          "status",
          "created_at",
          "notes",
        ],
        include: [
          {
            model: User, // Assuming you have User model imported
            as: "flagger",
            attributes: ["id", "first_name", "email"], // Adjust attributes as needed
          },
        ],
        order: [["created_at", "DESC"]], // Most recent flags first
      });

      if (flaggingDetails && flaggingDetails.length > 0) {
        productData.flaggingDetails = flaggingDetails.map((flag) =>
          flag.get({ plain: true })
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: productData,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
/**
 * Update an existing product
 */
exports.updateProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const productId = req.params.productId;
    const productData = req.body;
    const files = req.files || [];

    // Parse JSON strings if needed
    let specifications = {};
    if (productData.specifications) {
      try {
        specifications = JSON.parse(productData.specifications);
      } catch (e) {
        specifications = productData.specifications;
      }
    }

    // Handle specs field as well (in case it's used instead of specifications)
    if (productData.specs && Object.keys(specifications).length === 0) {
      try {
        specifications = JSON.parse(productData.specs);
      } catch (e) {
        specifications = productData.specs;
      }
    }

    let retippingData = null;
    if (productData.retipping) {
      try {
        retippingData = JSON.parse(productData.retipping);
      } catch (e) {
        retippingData = productData.retipping;
      }
    }

    // Find the product to update
    const product = await Product.findByPk(productId, { transaction });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user owns this product
    // if (product.user_id !== req.user.id) {
    //   await transaction.rollback();
    //   return res.status(403).json({
    //     success: false,
    //     message: "Not authorized to update this product",
    //   });
    // }

    // Handle image updates
    let currentImages = product.images || [];

    // Parse existing images if they come from frontend
    if (productData.images) {
      try {
        const frontendImages =
          typeof productData.images === "string"
            ? JSON.parse(productData.images)
            : productData.images;

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

    // Convert list_for_selling to boolean if it's a string
    let listForSelling = product.list_for_selling;
    if (productData.list_for_selling !== undefined) {
      listForSelling = productData.list_for_selling === "false" ? false : true;
    }

    // Store the old category to check if it changed
    const oldCategory = product.category;
    const newCategory = productData.category || product.category;

    // Prepare update data
    const updateData = {
      category: newCategory,
      title: productData.title || product.title,
      description:
        productData.description !== undefined
          ? productData.description
          : product.description,
      price: productData.price ? parseFloat(productData.price) : product.price,
      quantity:
        productData.quantity !== undefined
          ? parseInt(productData.quantity, 10)
          : product.quantity,
      condition: productData.condition || product.condition,
      weight: productData.weight || product.weight,
      height: productData.height || product.height,
      length: productData.length || product.length,
      width: productData.width || product.width,
      subtype:
        productData.subtype !== undefined
          ? productData.subtype
          : product.subtype,
      location:
        productData.location !== undefined
          ? productData.location
          : product.location,
      images: currentImages,
      is_active:
        productData.is_active !== undefined
          ? productData.is_active
          : product.is_active,
      list_for_selling: listForSelling,
    };

    // Update specifications if provided
    if (Object.keys(specifications).length > 0) {
      updateData.specifications = specifications;
    }

    // Handle requires_retipping field
    if (productData.requires_retipping !== undefined) {
      updateData.requires_retipping =
        productData.requires_retipping === "true" ||
        productData.requires_retipping === true;
    }

    // Update product record
    await product.update(updateData, { transaction });

    // Handle category change - delete retipping details if category changed from Core Drill Bits
    if (
      oldCategory === "Core Drill Bits" &&
      newCategory !== "Core Drill Bits"
    ) {
      await ProductRetippingDetails.destroy({
        where: { product_id: productId },
        transaction,
      });
    }
    // Handle retipping details for Core Drill Bits category
    else if (newCategory === "Core Drill Bits") {
      if (retippingData) {
        // Find or create retipping details
        const [retippingDetails] = await ProductRetippingDetails.findOrCreate({
          where: { product_id: productId },
          defaults: {
            product_id: productId,
            diameter: retippingData.diameter,
            enable_diy:
              retippingData.enable_diy === "true" ||
              retippingData.enable_diy === true,
            per_segment_price: retippingData.per_segment_price
              ? parseFloat(retippingData.per_segment_price)
              : null,
            segments: retippingData.segments
              ? parseInt(retippingData.segments, 10)
              : null,
            total_price: retippingData.total_price
              ? parseFloat(retippingData.total_price)
              : null,
          },
          transaction,
        });

        // Update existing retipping details
        await retippingDetails.update(
          {
            diameter:
              retippingData.diameter !== undefined
                ? retippingData.diameter
                : retippingDetails.diameter,
            enable_diy:
              retippingData.enable_diy !== undefined
                ? retippingData.enable_diy === "true" ||
                  retippingData.enable_diy === true
                : retippingDetails.enable_diy,
            per_segment_price:
              retippingData.per_segment_price !== undefined
                ? parseFloat(retippingData.per_segment_price)
                : retippingDetails.per_segment_price,
            segments:
              retippingData.segments !== undefined
                ? parseInt(retippingData.segments, 10)
                : retippingDetails.segments,
            total_price:
              retippingData.total_price !== undefined
                ? parseFloat(retippingData.total_price)
                : retippingDetails.total_price,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating product:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Delete a product
 */ exports.deleteProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const productId = req.params.productId;

    // First, find the product without includes to avoid association issues
    const product = await Product.findByPk(productId, { transaction });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product is already archived
    if (product.is_Archived) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product is already archived",
      });
    }

    // Store listing_id before archiving the product
    const listingId = product.listing_id;

    // Set is_Archived to true instead of deleting
    await product.update(
      {
        is_Archived: true,
        is_active: false, // Also set to inactive for good measure
        list_for_selling: false,
      },
      { transaction }
    );

    // Update listing stock if listing_id exists and product quantity > 0
    if (listingId && product.quantity > 0) {
      // First check if the listing exists
      const listing = await ProductListing.findByPk(listingId, { transaction });

      if (listing) {
        // Only decrement if current stock is greater than 0 to avoid negative values
        if (listing.Stock > 0) {
          await ProductListing.decrement("Stock", {
            by: 1, // Decrement by 1 (meaning this listing now has 1 less product in stock)
            where: { id: listingId },
            transaction,
          });
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product has been removed successfully",
      data: {
        productId: product.id,
        title: product.title,
        archived: true,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error archiving product:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while removing product",
    });
  }
};
/**
 * Get featured products
 */
exports.getFeaturedProducts = async (req, res) => {
  try {
    // First, check if the association exists
    const isAssociationDefined =
      Product.associations && Product.associations.retippingDetails;

    let products;

    // Base where condition to get only featured products
    const whereCondition = {
      is_Archived: false,
      is_flagged: false,
      is_active: true,
      list_for_selling: true,
      is_featured: true, // Only get featured products
    };

    if (isAssociationDefined) {
      // If association exists, include the retipping details and user information
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
          {
            model: User,
            as: "seller", // Using the correct alias from your association
            attributes: ["seller_approval_status"],
            required: false, // LEFT JOIN - include products even if user info is missing
          },
        ],
        order: [["created_at", "DESC"]],
      });
    } else {
      // If association doesn't exist, fetch products with user information
      products = await Product.findAll({
        where: whereCondition,
        include: [
          {
            model: User,
            as: "seller", // Using the correct alias from your association
            attributes: ["seller_approval_status"],
            required: false, // LEFT JOIN - include products even if user info is missing
          },
        ],
        order: [["created_at", "DESC"]],
      });
    }

    // Transform the products to include is_verified field
    const transformedProducts = products.map((product) => {
      const productData = product.toJSON();

      // Check if the seller is approved
      const isVerified =
        productData.seller &&
        productData.seller.seller_approval_status === "approved";

      // Add is_verified field and remove the seller data from the response
      const { seller, ...productWithoutSeller } = productData;

      return {
        ...productWithoutSeller,
        is_verified: isVerified,
      };
    });

    // Log the unique user_ids for debugging
    const uniqueUserIds = [
      ...new Set(products.map((product) => product.user_id)),
    ];
    console.log(
      `Found ${products.length} featured products from ${uniqueUserIds.length} unique sellers`
    );

    return res.status(200).json({
      success: true,
      data: transformedProducts,
      totalCount: transformedProducts.length,
      message: "Featured products retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Search products with various filters
 */
exports.searchProducts = async (req, res) => {
  try {
    const {
      keyword,
      category,
      minPrice,
      maxPrice,
      condition,
      location,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query conditions
    const whereConditions = {
      is_active: true,
      list_for_selling: true,
      expiration_date: {
        [Op.gt]: new Date(),
      },
    };

    // Add additional filters if provided
    if (keyword) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${keyword}%` } },
        { description: { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    if (category) {
      whereConditions.category = category;
    }

    if (minPrice) {
      whereConditions.price = {
        ...whereConditions.price,
        [Op.gte]: parseFloat(minPrice),
      };
    }

    if (maxPrice) {
      whereConditions.price = {
        ...whereConditions.price,
        [Op.lte]: parseFloat(maxPrice),
      };
    }

    if (condition) {
      whereConditions.condition = condition;
    }

    if (location) {
      whereConditions.location = { [Op.iLike]: `%${location}%` };
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Execute query
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereConditions,
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
        },
      ],
      limit: parseInt(limit, 10),
      offset: offset,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      data: products,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
exports.toggleFeatureProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId } = req.params;
    const { is_featured } = req.body;

    // Validate required fields
    if (typeof is_featured !== "boolean") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "is_featured field is required and must be a boolean value",
      });
    }

    // Check if product exists
    const product = await Product.findByPk(productId, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if the product is already in the requested state
    if (product.is_featured === is_featured) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Product is already ${
          is_featured ? "featured" : "unfeatured"
        }`,
      });
    }

    // If trying to feature a product, check if it's active and not archived
    if (is_featured && (!product.is_active || product.is_Archived)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot feature inactive or archived products",
      });
    }

    // Update the product's featured status
    await product.update({ is_featured }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Product ${
        is_featured ? "featured" : "unfeatured"
      } successfully`,
      data: {
        product_id: productId,
        is_featured,
        title: product.title,
        category: product.category,
        updated_at: product.updated_at,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error toggling product feature status:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
