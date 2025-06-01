const Commission = require("../../../models/commission.model");

/**
 * Get all commission rates
 */
exports.getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.findAll({
      order: [["category", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: commissions,
      count: commissions.length,
    });
  } catch (error) {
    console.error("Error getting commissions:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get commission rate for a specific category
 */
exports.getCommissionByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const commission = await Commission.findOne({
      where: { category },
    });

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission rate not found for this category",
      });
    }

    return res.status(200).json({
      success: true,
      data: commission,
    });
  } catch (error) {
    console.error("Error getting commission by category:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Add commission rate for a category
 */
exports.addCommission = async (req, res) => {
  try {
    const { category, commission_rate } = req.body;

    if (
      !category ||
      commission_rate === undefined ||
      commission_rate === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Category and commission rate are required",
      });
    }

    // Validate commission rate
    if (commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be between 0 and 100",
      });
    }

    // Check if commission already exists for this category
    const existingCommission = await Commission.findOne({
      where: { category },
    });

    if (existingCommission) {
      return res.status(400).json({
        success: false,
        message:
          "Commission rate already exists for this category. Use update instead.",
      });
    }

    const newCommission = await Commission.create({
      category,
      commission_rate,
    });

    return res.status(201).json({
      success: true,
      message: "Commission rate added successfully",
      data: newCommission,
    });
  } catch (error) {
    console.error("Error adding commission:", error);

    // Handle unique constraint violation
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Commission rate already exists for this category",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update commission rate for a category
 */
exports.updateCommission = async (req, res) => {
  try {
    const { category } = req.params;
    const { commission_rate } = req.body;

    if (commission_rate === undefined || commission_rate === null) {
      return res.status(400).json({
        success: false,
        message: "Commission rate is required",
      });
    }

    // Validate commission rate
    if (commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be between 0 and 100",
      });
    }

    const commission = await Commission.findOne({
      where: { category },
    });

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission rate not found for this category",
      });
    }

    await commission.update({
      commission_rate,
    });

    return res.status(200).json({
      success: true,
      message: "Commission rate updated successfully",
      data: commission,
    });
  } catch (error) {
    console.error("Error updating commission:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete commission rate for a category
 */
exports.deleteCommission = async (req, res) => {
  try {
    const { category } = req.params;

    const commission = await Commission.findOne({
      where: { category },
    });

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission rate not found for this category",
      });
    }

    await commission.destroy();

    return res.status(200).json({
      success: true,
      message: "Commission rate deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting commission:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Initialize all categories with default commission rates
 */
exports.initializeCommissions = async (req, res) => {
  try {
    const categories = [
      "Core Drill Bits",
      "Core Drills",
      "Flat Saws",
      "Wall Saws & Wire Saws",
      "Diamond Consumables",
      "Handheld Power Saws",
      "Specialty Saws",
      "Drilling Equipment",
      "Joint Sealant & Repair Equipment",
      "Materials & Consumables",
      "Demolition Equipment",
      "Accessories",
    ];

    const { default_rate = 5 } = req.body; // Default 5% if not specified

    const commissionPromises = categories.map((category) =>
      Commission.findOrCreate({
        where: { category },
        defaults: {
          category,
          commission_rate: default_rate,
        },
      })
    );

    const results = await Promise.all(commissionPromises);
    const created = results.filter(([commission, wasCreated]) => wasCreated);

    return res.status(200).json({
      success: true,
      message: `Initialized ${created.length} commission rates`,
      data: {
        total_categories: categories.length,
        created_count: created.length,
        existing_count: categories.length - created.length,
      },
    });
  } catch (error) {
    console.error("Error initializing commissions:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
