const {
  User,
  Product,
  Order,
  OrderItem,
  OrderDispute,
} = require("../../../models");
const { ProductListing } = require("../../../models/ProductListing.model");
const { sequelize } = require("../../../config/db");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();
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
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(
      "Invalid file format. Only JPEG, JPG, PNG and PDF are allowed"
    );
  }

  // Create unique filename
  const filename = `${uuidv4()}${fileExtension}`;

  // Upload to S3
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `licenses/${filename}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
};

// Get user by ID (admin only or own profile)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user details",
      error: error.message,
    });
  }
};
// Convert a buyer user to seller
exports.convertToSeller = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      companyName,
      companyRegistrationNumber,
      countryOfRegistration,
      businessAddress,
      websiteUrl,
      city,
      postalCode,
    } = req.body;

    // Debug log to check what we're receiving
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);

    // Find the user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already a seller
    if (user.role === "seller") {
      return res.status(400).json({
        success: false,
        message: "User is already a seller",
      });
    }

    // Handle license image upload to S3 if provided
    let licenseImageUrl = null;
    if (req.file) {
      try {
        licenseImageUrl = await uploadFileToS3(req.file);
        console.log("License image uploaded successfully:", licenseImageUrl);
      } catch (uploadError) {
        console.error("Error uploading license image:", uploadError);
        return res.status(400).json({
          success: false,
          message: "Error uploading license image",
          error: uploadError.message,
        });
      }
    }

    // Update user to seller with seller-specific information
    const updatedUser = await user.update({
      role: "seller",
      company_name: companyName,
      company_registration_number: companyRegistrationNumber,
      country_of_registration: countryOfRegistration,
      business_address: businessAddress,
      website_url: websiteUrl,
      license_image_path: licenseImageUrl,
      seller_approval_status: "pending",
      seller_verified: false,
      city: city,
      postal_code: postalCode,
    });

    // Return updated user data (excluding sensitive information)
    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      role: updatedUser.role,
      company_name: updatedUser.company_name,
      company_registration_number: updatedUser.company_registration_number,
      country_of_registration: updatedUser.country_of_registration,
      business_address: updatedUser.business_address,
      website_url: updatedUser.website_url,
      license_image_path: updatedUser.license_image_path,
      seller_approval_status: updatedUser.seller_approval_status,
      seller_verified: updatedUser.seller_verified,
    };

    res.status(200).json({
      success: true,
      message: "User successfully converted to seller. Awaiting approval.",
      data: userResponse,
    });
  } catch (error) {
    console.error("Convert to seller error:", error);
    res.status(500).json({
      success: false,
      message: "Error converting user to seller",
      error: error.message,
    });
  }
};

// Get all users (admin only) with pagination and filtering
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      is_active,
      email_verified,
      seller_approval_status,
      search,
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Apply filters
    if (role) whereClause.role = role;
    if (is_active !== undefined) whereClause.is_active = is_active === "true";
    if (email_verified !== undefined)
      whereClause.email_verified = email_verified === "true";
    if (seller_approval_status)
      whereClause.seller_approval_status = seller_approval_status;

    // Search functionality
    if (search) {
      whereClause[sequelize.Op.or] = [
        { first_name: { [sequelize.Op.iLike]: `%${search}%` } },
        { last_name: { [sequelize.Op.iLike]: `%${search}%` } },
        { email: { [sequelize.Op.iLike]: `%${search}%` } },
        { company_name: { [sequelize.Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ["password_hash"] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers: count,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// Get sellers only (for buyer/admin to view verified sellers)
exports.getSellers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      verified_only = "false",
      approval_status = "approved",
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {
      role: "seller",
      is_active: true,
    };

    if (verified_only === "true") {
      whereClause.seller_verified = true;
    }

    if (approval_status) {
      whereClause.seller_approval_status = approval_status;
    }

    const { count, rows: sellers } = await User.findAndCountAll({
      where: whereClause,
      attributes: {
        exclude: ["password_hash", "license_image_path"], // Exclude sensitive data
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      message: "Sellers fetched successfully",
      data: {
        sellers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalSellers: count,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get sellers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sellers",
      error: error.message,
    });
  }
};

// Get user statistics (admin only)
exports.getUserStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      User.count({ where: { role: "buyer" } }),
      User.count({ where: { role: "seller" } }),
      User.count({ where: { role: "admin" } }),
      User.count({ where: { is_active: true } }),
      User.count({ where: { email_verified: true } }),
      User.count({ where: { seller_verified: true } }),
      User.count({ where: { seller_approval_status: "pending" } }),
      User.count({ where: { seller_approval_status: "approved" } }),
      User.count({ where: { seller_approval_status: "rejected" } }),
    ]);

    const [
      totalBuyers,
      totalSellers,
      totalAdmins,
      activeUsers,
      verifiedEmails,
      verifiedSellers,
      pendingSellers,
      approvedSellers,
      rejectedSellers,
    ] = stats;

    res.status(200).json({
      success: true,
      message: "User statistics fetched successfully",
      data: {
        users: {
          total: totalBuyers + totalSellers + totalAdmins,
          buyers: totalBuyers,
          sellers: totalSellers,
          admins: totalAdmins,
          active: activeUsers,
          emailVerified: verifiedEmails,
        },
        sellers: {
          total: totalSellers,
          verified: verifiedSellers,
          pending: pendingSellers,
          approved: approvedSellers,
          rejected: rejectedSellers,
        },
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      phone,
      company_name,
      business_address,
      website_url,
    } = req.body;

    const user = await User.findByPk(userId, { transaction });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare update data (only allow certain fields to be updated)
    const updateData = {};
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (phone) updateData.phone = phone;

    // Seller-specific fields
    if (user.role === "seller") {
      if (company_name) updateData.company_name = company_name;
      if (business_address) updateData.business_address = business_address;
      if (website_url) updateData.website_url = website_url;
    }

    await User.update(updateData, {
      where: { id: userId },
      transaction,
    });

    await transaction.commit();

    // Fetch updated user
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};
// Suspend/Unsuspend user (admin only)
exports.suspendUser = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { userId } = req.params;
    const { suspend = true, reason } = req.body; // suspend: true to suspend, false to unsuspend

    // Find the user
    const user = await User.findByPk(userId, { transaction });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from suspending themselves
    if (req.user && req.user.id === userId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You cannot suspend your own account",
      });
    }

    // Update suspension status
    await user.update(
      {
        is_suspended: suspend,
        is_active: suspend ? false : true, // Deactivate when suspended, reactivate when unsuspended
      },
      { transaction }
    );

    await transaction.commit();

    // Log the action (optional - you might want to create an audit log)
    console.log(
      `User ${user.email} (ID: ${userId}) ${
        suspend ? "suspended" : "unsuspended"
      } by admin ${req.user?.email || "system"}${
        reason ? `. Reason: ${reason}` : ""
      }`
    );

    res.status(200).json({
      success: true,
      message: `User ${suspend ? "suspended" : "unsuspended"} successfully`,
      data: {
        userId: user.id,
        email: user.email,
        is_suspended: user.is_suspended,
        is_active: user.is_active,
        action: suspend ? "suspended" : "unsuspended",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Suspend user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user suspension status",
      error: error.message,
    });
  }
};
// Get user insights
exports.getUserInsights = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { userId } = req.params;

    // Find the user
    const user = await User.findByPk(userId, { transaction });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let insights = {};

    // Get user personal information
    const userInfo = {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone,
      role: user.role,
      joinDate: user.created_at,
      lastLogin: user.updated_at, // You might want to track this separately
      status: user.is_active ? "Active profile" : "Inactive profile",
      isVerified: user.email_verified,
      isSuspended: user.is_suspended,
      // Seller specific info
      companyName: user.company_name,
      companyRegistrationNumber: user.company_registration_number,
      businessAddress: user.business_address,
      websiteUrl: user.website_url,
      sellerVerified: user.seller_verified,
      sellerApprovalStatus: user.seller_approval_status,
    };

    if (user.role === "seller") {
      insights = await getSellerInsights(userId, transaction);
    } else if (user.role === "buyer") {
      insights = await getBuyerInsights(userId, transaction);
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "User insights retrieved successfully",
      data: {
        userInfo,
        insights,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Get user insights error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving user insights",
      error: error.message,
    });
  }
};
async function getSellerDisputePerformance(userId, transaction) {
  try {
    // Get dispute data for this seller
    const disputeData = await sequelize.query(
      `
      SELECT 
        od.dispute_status,
        od.dispute_category,
        od.created_at,
        od.resolved_at,
        p.title as product_title,
        p.category as product_category
      FROM order_disputes od
      JOIN products p ON od.product_id = p.id
      WHERE p.user_id = :userId
      ORDER BY od.created_at DESC
    `,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!disputeData || disputeData.length === 0) {
      return {
        totalDisputes: 0,
        resolvedDisputes: 0,
        openDisputes: 0,
        inProgressDisputes: 0,
        rejectedDisputes: 0,
        resolutionRatio: "0:0",
        resolutionRate: "0%",
        commonDispute: "None",
        averageResolutionTime: 0,
        performanceRating: "No Data",
        recentDisputes: [],
      };
    }

    // Calculate dispute metrics
    const totalDisputes = disputeData.length;
    const resolvedDisputes = disputeData.filter(
      (d) => d.dispute_status === "resolved"
    ).length;
    const closedDisputes = disputeData.filter(
      (d) => d.dispute_status === "closed"
    ).length;
    const openDisputes = disputeData.filter(
      (d) => d.dispute_status === "open"
    ).length;
    const inProgressDisputes = disputeData.filter(
      (d) => d.dispute_status === "in_progress"
    ).length;
    const rejectedDisputes = disputeData.filter(
      (d) => d.dispute_status === "rejected"
    ).length;

    const totalResolvedClosed = resolvedDisputes + closedDisputes;
    const resolutionRate =
      totalDisputes > 0
        ? ((totalResolvedClosed / totalDisputes) * 100).toFixed(1)
        : "0";

    // Find most common dispute category
    const categoryCount = {};
    disputeData.forEach((d) => {
      categoryCount[d.dispute_category] =
        (categoryCount[d.dispute_category] || 0) + 1;
    });

    const commonDispute =
      Object.keys(categoryCount).length > 0
        ? Object.keys(categoryCount).reduce((a, b) =>
            categoryCount[a] > categoryCount[b] ? a : b
          )
        : "None";

    // Convert category to readable format
    const categoryMap = {
      product_quality: "Product Quality",
      shipping_delay: "Shipping Delay",
      wrong_item: "Wrong Item",
      damaged_item: "Damaged Item",
      not_received: "Not Received",
      billing_issue: "Billing Issue",
      refund_request: "Refund Request",
      other: "Other",
    };

    // Calculate average resolution time for resolved disputes
    const resolvedDisputesWithTime = disputeData.filter(
      (d) =>
        (d.dispute_status === "resolved" || d.dispute_status === "closed") &&
        d.resolved_at &&
        d.created_at
    );

    let averageResolutionTime = 0;
    if (resolvedDisputesWithTime.length > 0) {
      const totalResolutionTime = resolvedDisputesWithTime.reduce((sum, d) => {
        const resolutionTime =
          (new Date(d.resolved_at) - new Date(d.created_at)) /
          (1000 * 60 * 60 * 24);
        return sum + resolutionTime;
      }, 0);
      averageResolutionTime = (
        totalResolutionTime / resolvedDisputesWithTime.length
      ).toFixed(1);
    }

    // Performance rating based on resolution rate
    let performanceRating = "Poor";
    if (totalDisputes === 0) performanceRating = "No Data";
    else if (parseFloat(resolutionRate) >= 90) performanceRating = "Excellent";
    else if (parseFloat(resolutionRate) >= 75) performanceRating = "Good";
    else if (parseFloat(resolutionRate) >= 60) performanceRating = "Average";

    // Recent disputes (last 5)
    const recentDisputes = disputeData.slice(0, 5).map((d) => ({
      category: categoryMap[d.dispute_category] || d.dispute_category,
      status: d.dispute_status,
      productTitle: d.product_title,
      createdAt: d.created_at,
      resolvedAt: d.resolved_at,
    }));

    return {
      totalDisputes,
      resolvedDisputes,
      openDisputes,
      inProgressDisputes,
      rejectedDisputes,
      resolutionRatio: `${totalResolvedClosed}:${
        openDisputes + inProgressDisputes
      }`,
      resolutionRate: `${resolutionRate}%`,
      commonDispute: categoryMap[commonDispute] || commonDispute,
      averageResolutionTime: parseFloat(averageResolutionTime),
      performanceRating,
      recentDisputes,
      // Additional metrics for detailed analysis if needed
      disputesByCategory: {
        product_quality: disputeData.filter(
          (d) => d.dispute_category === "product_quality"
        ).length,
        shipping_delay: disputeData.filter(
          (d) => d.dispute_category === "shipping_delay"
        ).length,
        wrong_item: disputeData.filter(
          (d) => d.dispute_category === "wrong_item"
        ).length,
        damaged_item: disputeData.filter(
          (d) => d.dispute_category === "damaged_item"
        ).length,
        not_received: disputeData.filter(
          (d) => d.dispute_category === "not_received"
        ).length,
        billing_issue: disputeData.filter(
          (d) => d.dispute_category === "billing_issue"
        ).length,
        refund_request: disputeData.filter(
          (d) => d.dispute_category === "refund_request"
        ).length,
        other: disputeData.filter((d) => d.dispute_category === "other").length,
      },
    };
  } catch (error) {
    console.error("Error calculating seller dispute performance:", error);
    return {
      totalDisputes: 0,
      resolvedDisputes: 0,
      openDisputes: 0,
      inProgressDisputes: 0,
      rejectedDisputes: 0,
      resolutionRatio: "Error",
      resolutionRate: "Error",
      commonDispute: "Error calculating",
      averageResolutionTime: 0,
      performanceRating: "Error",
      recentDisputes: [],
      error: error.message,
    };
  }
}
async function getSellerInsights(userId, transaction) {
  // Get current date and date ranges
  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Listing Overview - Count ProductListings (not individual products)
  const totalListings = await ProductListing.count({
    where: { user_id: userId },
    transaction,
  });

  // Active listings - listings that have at least one active product
  // FIXED: Changed p.is_Archived to p."is_Archived" to match the model definition
  const activeListings = await sequelize.query(
    `
    SELECT COUNT(DISTINCT pl.id) as count
    FROM product_listings pl
    JOIN products p ON pl.id = p.listing_id
    WHERE pl.user_id = :userId 
      AND p.is_active = true 
      AND p."is_Archived" = false
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Out of stock products (individual products, not listings)
  const outOfStockProducts = await Product.count({
    where: {
      user_id: userId,
      quantity: 0,
    },
    transaction,
  });

  // Total products across all listings
  const totalProducts = await Product.count({
    where: { user_id: userId },
    transaction,
  });

  // Active products
  // FIXED: Changed is_Archived to "is_Archived" to match the model definition
  const activeProducts = await Product.count({
    where: {
      user_id: userId,
      is_active: true,
      is_Archived: false, // This will be properly quoted by Sequelize ORM
    },
    transaction,
  });

  // Sales Overview - Monthly data for the current year
  const monthlySales = await sequelize.query(
    `
    SELECT 
      EXTRACT(MONTH FROM o.order_date) as month,
      SUM(oi.price * oi.quantity) as total_sales,
      COUNT(DISTINCT o.id) as order_count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE p.user_id = :userId 
      AND o.order_date >= :startOfYear
      AND oi.payment_status = true
    GROUP BY EXTRACT(MONTH FROM o.order_date)
    ORDER BY month
  `,
    {
      replacements: { userId, startOfYear },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Fill in missing months with 0 sales
  const salesData = Array.from({ length: 12 }, (_, i) => {
    const monthData = monthlySales.find(
      (sale) => parseInt(sale.month) === i + 1
    );
    return {
      month: new Date(currentYear, i, 1)
        .toLocaleString("default", { month: "short" })
        .toUpperCase(),
      sales: monthData ? parseFloat(monthData.total_sales) : 0,
      orderCount: monthData ? parseInt(monthData.order_count) : 0,
    };
  });

  // Transaction History - Recent transactions
  const transactions = await sequelize.query(
    `
    SELECT 
      o.id as order_id,
      (oi.price * oi.quantity) as amount,
      o.order_date as date,
      CONCAT(u.first_name, ' ', u.last_name) as buyer_name,
      oi.order_status as status,
      oi.title as product_title,
      COALESCE(pl."Product_Name", 'N/A') as listing_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_listings pl ON p.listing_id = pl.id
    JOIN users u ON o.buyer_id = u.id
    WHERE p.user_id = :userId
    ORDER BY o.order_date DESC
    LIMIT 10
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Category breakdown from listings
  const categoryBreakdown = await sequelize.query(
    `
    SELECT 
      COALESCE(pl."Category", 'Uncategorized') as category,
      COUNT(pl.id) as listing_count,
      COUNT(p.id) as product_count,
      SUM(CASE WHEN p.is_active = true AND p."is_Archived" = false THEN 1 ELSE 0 END) as active_products
    FROM product_listings pl
    LEFT JOIN products p ON pl.id = p.listing_id
    WHERE pl.user_id = :userId
    GROUP BY pl."Category"
    ORDER BY listing_count DESC
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Revenue metrics
  const totalRevenue = await sequelize.query(
    `
    SELECT SUM(oi.price * oi.quantity) as total
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE p.user_id = :userId AND oi.payment_status = true
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  const revenueThisMonth = await sequelize.query(
    `
    SELECT SUM(oi.price * oi.quantity) as total
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE p.user_id = :userId 
      AND o.order_date >= :last30Days
      AND oi.payment_status = true
  `,
    {
      replacements: { userId, last30Days },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Products requiring retipping
  const retippingProducts = await Product.count({
    where: {
      user_id: userId,
      requires_retipping: true,
      is_active: true,
    },
    transaction,
  });
  const disputePerformance = await getSellerDisputePerformance(
    userId,
    transaction
  );

  return {
    listingOverview: {
      totalListings,
      activeListings: parseInt(activeListings[0]?.count || 0),
      totalProducts,
      activeProducts,
      outOfStockProducts,
      retippingProducts,
    },
    salesOverview: {
      chartData: salesData,
      totalRevenue: parseFloat(totalRevenue[0]?.total || 0),
      revenueThisMonth: parseFloat(revenueThisMonth[0]?.total || 0),
      totalOrdersThisYear: salesData.reduce(
        (sum, month) => sum + month.orderCount,
        0
      ),
    },
    transactionHistory: transactions.map((t) => ({
      orderId: t.order_id,
      amount: parseFloat(t.amount),
      date: t.date,
      buyer: t.buyer_name,
      status: t.status,
      productTitle: t.product_title,
      listingName: t.listing_name,
    })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      listingCount: parseInt(c.listing_count),
      productCount: parseInt(c.product_count),
      activeProducts: parseInt(c.active_products),
    })),
    // Mock dispute data since you don't have disputes table yet
    disputePerformance,
  };
}
async function getBuyerInsights(userId, transaction) {
  // Get current date and date ranges
  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Order Overview
  const totalOrders = await Order.count({
    where: { buyer_id: userId },
    transaction,
  });

  const completedOrders = await sequelize.query(
    `
    SELECT COUNT(DISTINCT o.id) as count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.buyer_id = :userId AND oi.order_status = 'delivered'
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  const pendingOrders = await sequelize.query(
    `
    SELECT COUNT(DISTINCT o.id) as count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.buyer_id = :userId AND oi.order_status IN ('pending approval', 'processing', 'shipped', 'approved')
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  const cancelledOrders = await sequelize.query(
    `
    SELECT COUNT(DISTINCT o.id) as count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.buyer_id = :userId AND oi.order_status IN ('cancelled', 'rejected', 'refunded')
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Spending Overview - Monthly data for the current year
  const monthlySpending = await sequelize.query(
    `
    SELECT 
      EXTRACT(MONTH FROM o.order_date) as month,
      SUM(o.total_amount) as total_spent,
      COUNT(o.id) as order_count
    FROM orders o
    WHERE o.buyer_id = :userId 
      AND o.order_date >= :startOfYear
      AND o.payment_completed = true
    GROUP BY EXTRACT(MONTH FROM o.order_date)
    ORDER BY month
  `,
    {
      replacements: { userId, startOfYear },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Fill in missing months with 0 spending
  const spendingData = Array.from({ length: 12 }, (_, i) => {
    const monthData = monthlySpending.find(
      (spend) => parseInt(spend.month) === i + 1
    );
    return {
      month: new Date(currentYear, i, 1)
        .toLocaleString("default", { month: "short" })
        .toUpperCase(),
      spending: monthData ? parseFloat(monthData.total_spent) : 0,
      orderCount: monthData ? parseInt(monthData.order_count) : 0,
    };
  });

  // Purchase History - Recent purchases (Fixed column reference)
  const purchases = await sequelize.query(
    `
    SELECT 
      o.id as order_id,
      o.total_amount,
      o.order_date,
      oi.title as product_title,
      oi.order_status,
      CONCAT(u.first_name, ' ', u.last_name) as seller_name,
      COALESCE(pl."Product_Name", 'N/A') as listing_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_listings pl ON p.listing_id = pl.id
    JOIN users u ON p.user_id = u.id
    WHERE o.buyer_id = :userId
    ORDER BY o.order_date DESC
    LIMIT 10
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Category preferences based on product categories
  const categorySpending = await sequelize.query(
    `
    SELECT 
      p.category,
      SUM(oi.price * oi.quantity) as total_spent,
      COUNT(*) as order_count,
      SUM(oi.quantity) as items_purchased
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.buyer_id = :userId AND o.payment_completed = true
    GROUP BY p.category
    ORDER BY total_spent DESC
    LIMIT 5
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  // Total spending metrics
  const totalSpent = await Order.sum("total_amount", {
    where: {
      buyer_id: userId,
      payment_completed: true,
    },
    transaction,
  });

  const spentThisMonth = await Order.sum("total_amount", {
    where: {
      buyer_id: userId,
      payment_completed: true,
      order_date: { [Op.gte]: last30Days },
    },
    transaction,
  });

  // Average order value
  const avgOrderValue = totalOrders > 0 ? (totalSpent || 0) / totalOrders : 0;

  // Total items purchased
  const totalItemsPurchased = await sequelize.query(
    `
    SELECT SUM(oi.quantity) as total
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.buyer_id = :userId AND o.payment_completed = true
  `,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return {
    orderOverview: {
      totalOrders,
      completedOrders: parseInt(completedOrders[0]?.count || 0),
      pendingOrders: parseInt(pendingOrders[0]?.count || 0),
      cancelledOrders: parseInt(cancelledOrders[0]?.count || 0),
      completionRate:
        totalOrders > 0
          ? (
              (parseInt(completedOrders[0]?.count || 0) / totalOrders) *
              100
            ).toFixed(1)
          : 0,
    },
    spendingOverview: {
      chartData: spendingData,
      totalSpent: parseFloat(totalSpent || 0),
      spentThisMonth: parseFloat(spentThisMonth || 0),
      averageOrderValue: parseFloat(avgOrderValue),
      totalItemsPurchased: parseInt(totalItemsPurchased[0]?.total || 0),
    },
    purchaseHistory: purchases.map((p) => ({
      orderId: p.order_id,
      amount: parseFloat(p.total_amount),
      date: p.order_date,
      productTitle: p.product_title,
      status: p.order_status,
      seller: p.seller_name,
      listingName: p.listing_name,
    })),
    categoryPreferences: categorySpending.map((c) => ({
      category: c.category,
      totalSpent: parseFloat(c.total_spent),
      orderCount: parseInt(c.order_count),
      itemsPurchased: parseInt(c.items_purchased),
    })),
  };
}

exports.updateUserVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verificationType = "email" } = req.body; // 'email' or 'seller'

    // Find user by ID
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Determine which verification field to update
    const updateData = {};
    if (verificationType === "email") {
      updateData.email_verified = true;
    } else if (verificationType === "seller") {
      updateData.seller_verified = true;
      updateData.seller_approval_status = "approved";
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid verification type. Use 'email' or 'seller'",
      });
    }

    // Update the user
    await user.update(updateData);

    // Fetch updated user data (excluding password)
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
    });

    res.status(200).json({
      success: true,
      message: `User ${verificationType} verification updated successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user verification",
      error: error.message,
    });
  }
};
