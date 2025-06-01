const { FlaggedProducts } = require("../../../models/flagged-products.model");
const { Product } = require("../../../models/product.modal");
const { sequelize } = require("../../../config/db");
const { Op } = require("sequelize");

/**
 * Flag a product
 */
exports.flagProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId } = req.params;
    const { flagging_reason, severity_level, description, flagged_by } =
      req.body;

    // Validate required fields
    if (!flagging_reason) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Flagging reason is required",
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

    // Check if product is already flagged for the same reason by the same user
    const existingFlag = await FlaggedProducts.findOne({
      where: {
        product_id: productId,
        flagging_reason: flagging_reason,
        flagged_by: flagged_by || null,
        status: ["PENDING", "REVIEWED"],
      },
      transaction,
    });

    if (existingFlag) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product is already flagged for this reason",
      });
    }

    // Create flag record
    const flaggedProduct = await FlaggedProducts.create(
      {
        product_id: productId,
        flagging_reason,
        severity_level: severity_level || "MEDIUM",
        description: description || null,
        flagged_by: flagged_by || null,
        status: "PENDING",
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Product flagged successfully",
      data: {
        flag_id: flaggedProduct.id,
        product_id: productId,
        flagging_reason,
        severity_level: flaggedProduct.severity_level,
        status: flaggedProduct.status,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error flagging product:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Unflag a product (resolve or dismiss a flag)
 */
exports.unflagProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId } = req.params; // Changed from flagId to productId
    const { status, resolved_by, notes } = req.body;

    // Validate status
    const validStatuses = ["RESOLVED", "DISMISSED"];
    if (!status || !validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Status must be either 'RESOLVED' or 'DISMISSED'",
      });
    }

    // Find all active flags for the product
    const flaggedProducts = await FlaggedProducts.findAll({
      where: {
        product_id: productId,
        status: ["PENDING", "REVIEWED"],
      },
      transaction,
    });

    if (!flaggedProducts || flaggedProducts.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No active flags found for this product",
      });
    }

    // Update all active flags for this product
    const updatePromises = flaggedProducts.map((flaggedProduct) =>
      flaggedProduct.update(
        {
          status,
          resolved_by: resolved_by || null,
          resolved_at: new Date(),
          notes: notes || null,
        },
        { transaction }
      )
    );

    await Promise.all(updatePromises);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Product flags ${status.toLowerCase()} successfully`,
      data: {
        product_id: productId,
        flags_updated: flaggedProducts.length,
        status: status,
        resolved_at: new Date(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error unflagging product:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Get all flagged products with filters
 */
exports.getFlaggedProducts = async (req, res) => {
  try {
    const {
      status,
      severity_level,
      page = 1,
      limit = 10,
      product_id,
      flagged_by,
    } = req.query;

    // Build where conditions
    const whereConditions = {};

    if (status) {
      whereConditions.status = status;
    }

    if (severity_level) {
      whereConditions.severity_level = severity_level;
    }

    if (product_id) {
      whereConditions.product_id = product_id;
    }

    if (flagged_by) {
      whereConditions.flagged_by = flagged_by;
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Execute query with associations
    const { count, rows: flaggedProducts } =
      await FlaggedProducts.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Product,
            as: "product",
            attributes: [
              "id",
              "title",
              "category",
              "price",
              "condition",
              "images",
            ],
          },
        ],
        limit: parseInt(limit, 10),
        offset: offset,
        order: [["created_at", "DESC"]],
      });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      data: flaggedProducts,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages: totalPages,
        totalCount: count,
        limit: parseInt(limit, 10),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching flagged products:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update flag status (for reviewing)
 */
exports.updateFlagStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { flagId } = req.params;
    const { status, notes, resolved_by } = req.body;

    // Validate status
    const validStatuses = ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"];
    if (!status || !validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Must be one of: PENDING, REVIEWED, RESOLVED, DISMISSED",
      });
    }

    // Find the flag
    const flaggedProduct = await FlaggedProducts.findByPk(flagId, {
      transaction,
    });
    if (!flaggedProduct) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Flag not found",
      });
    }

    // Prepare update data
    const updateData = {
      status,
      notes: notes || flaggedProduct.notes,
    };

    // Set resolved_by and resolved_at for resolved/dismissed status
    if (["RESOLVED", "DISMISSED"].includes(status)) {
      updateData.resolved_by = resolved_by || null;
      updateData.resolved_at = new Date();
    }

    // Update flag
    await flaggedProduct.update(updateData, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Flag status updated successfully",
      data: {
        flag_id: flaggedProduct.id,
        product_id: flaggedProduct.product_id,
        status: status,
        updated_at: flaggedProduct.updated_at,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating flag status:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get flagging statistics
 */
exports.getFlaggingStats = async (req, res) => {
  try {
    // Get counts by status
    const stats = await FlaggedProducts.findAll({
      attributes: [
        "status",
        "severity_level",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status", "severity_level"],
      raw: true,
    });

    // Get total flagged products count
    const totalFlaggedProducts = await Product.count({
      where: { is_flagged: true },
    });

    // Format the response
    const formattedStats = {
      total_flagged_products: totalFlaggedProducts,
      flags_by_status: {},
      flags_by_severity: {},
    };

    stats.forEach((stat) => {
      // Group by status
      if (!formattedStats.flags_by_status[stat.status]) {
        formattedStats.flags_by_status[stat.status] = 0;
      }
      formattedStats.flags_by_status[stat.status] += parseInt(stat.count);

      // Group by severity
      if (!formattedStats.flags_by_severity[stat.severity_level]) {
        formattedStats.flags_by_severity[stat.severity_level] = 0;
      }
      formattedStats.flags_by_severity[stat.severity_level] += parseInt(
        stat.count
      );
    });

    return res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error("Error fetching flagging stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
