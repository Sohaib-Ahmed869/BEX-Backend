const { User } = require("../../../models");
const { sequelize } = require("../../../config/db");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();

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
