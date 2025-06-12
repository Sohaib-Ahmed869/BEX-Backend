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

/**
 * Add a new product with specifications and retipping info if applicable
 */
exports.addProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const productData = req.body;
    const files = req.files || [];

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

    // Validate basic product data
    if (
      !productData.title ||
      !productData.price ||
      !productData.condition ||
      !productData.category ||
      !productData.quantity ||
      !productData.weight ||
      !productData.height ||
      !productData.width ||
      !productData.length
    ) {
      throw new Error("Missing required product information");
    }

    // Upload images to S3 if any
    const imageUrls = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const imageUrl = await uploadFileToS3(file);
        imageUrls.push(imageUrl);
      }
    }

    // Convert list_for_selling to boolean if it's a string
    const listForSelling =
      productData.list_for_selling === "false" ? false : true;

    // Parse quantity and validate
    const quantity = parseInt(productData.quantity || 1, 10);

    // Create product with specifications directly in the model
    const product = await Product.create(
      {
        user_id: userId,
        listing_id: productData.listing_id,
        category: productData.category,
        title: productData.title,
        description: productData.description || "",
        price: parseFloat(productData.price),
        quantity: quantity,
        weight: parseFloat(productData.weight),
        height: parseFloat(productData.height),
        width: parseFloat(productData.width),
        length: parseFloat(productData.length),
        condition: productData.condition,
        subtype: productData.subtype || null,
        location: productData.location || null,
        images: imageUrls,
        specifications: attributes, // Store attributes directly as JSONB
        is_active: true,
        list_for_selling: listForSelling,
        // Product model has hooks to handle expiration_date and requires_retipping
      },
      { transaction }
    );

    // Update listing stock if quantity > 0 and listing_id is provided
    if (quantity > 0 && productData.listing_id) {
      await ProductListing.increment("Stock", {
        by: 1, // Increment by 1 (meaning this listing now has 1 more product in stock)
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
            ? parseFloat(retippingData.per_segment_price)
            : null,
          segments: retippingData.segments
            ? parseInt(retippingData.segments, 10)
            : null,
          total_price: retippingData.total_price
            ? parseFloat(retippingData.total_price)
            : null,
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: {
        id: product.id,
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
