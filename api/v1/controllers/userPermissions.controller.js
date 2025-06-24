const { User } = require("../../../models");
const UserPermissions = require("../../../models/userPermissions.model");
const { sequelize } = require("../../../config/db");
require("dotenv").config();

// Root admin configuration
const ROOT_ADMIN = {
  email: process.env.ROOT_ADMIN_EMAIL || "bex@gmail.com",
  userId: process.env.ROOT_ADMIN_ID || "9aaac0f0-d78c-4b3c-b8b0-c71b598e7ff0",
};

// Get user permissions
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists and is an admin
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "User is not an admin",
      });
    }

    // Get or create permissions for the user
    let permissions = await UserPermissions.findOne({
      where: { user_id: userId },
    });

    // If no permissions exist, create default ones
    if (!permissions) {
      const isRootAdmin = userId === ROOT_ADMIN.userId;
      permissions = await UserPermissions.create({
        user_id: userId,
        dashboard: true,
        users: true,
        orders: true,
        product_list: true,
        commission: true,
        seller_payouts: true,
        shipped_orders: true,
        rejected_orders: true,
        disputes: true,
        settings: true,
        can_manage_permissions: isRootAdmin,
        is_root_admin: isRootAdmin,
      });
    }

    res.status(200).json({
      success: true,
      message: "User permissions fetched successfully",
      data: {
        userId: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        permissions: {
          dashboard: permissions.dashboard,
          users: permissions.users,
          orders: permissions.orders,
          rejected_orders: permissions.rejected_orders,
          refunded_orders: permissions.refunded_orders,
          product_list: permissions.product_list,
          commission: permissions.commission,
          seller_payouts: permissions.seller_payouts,
          shipped_orders: permissions.shipped_orders,
          disputes: permissions.disputes,
          settings: permissions.settings,
          can_manage_permissions: permissions.can_manage_permissions,
          is_root_admin: permissions.is_root_admin,
        },
      },
    });
  } catch (error) {
    console.error("Get user permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user permissions",
      error: error.message,
    });
  }
};

// Get all admin users with their permissions
exports.getAllAdminPermissions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get all admin users with their permissions
    const { count, rows: adminUsers } = await User.findAndCountAll({
      where: {
        role: "admin",
        is_active: true,
      },
      include: [
        {
          model: UserPermissions,
          as: "permissions",
          required: false,
        },
      ],
      attributes: ["id", "email", "first_name", "last_name", "created_at"],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    // Format the response
    const adminsWithPermissions = adminUsers.map((admin) => ({
      id: admin.id,
      email: admin.email,
      name: `${admin.first_name} ${admin.last_name}`,
      created_at: admin.created_at,
      permissions: admin.permissions
        ? {
            dashboard: admin.permissions.dashboard,
            users: admin.permissions.users,
            orders: admin.permissions.orders,
            rejected_orders: admin.permissions.rejected_orders,
            refunded_orders: admin.permissions.refunded_orders,
            shipped_orders: admin.permissions.shipped_orders,
            seller_payouts: admin.permissions.seller_payouts,
            product_list: admin.permissions.product_list,
            commission: admin.permissions.commission,
            disputes: admin.permissions.disputes,
            settings: admin.permissions.settings,
            can_manage_permissions: admin.permissions.can_manage_permissions,
            is_root_admin: admin.permissions.is_root_admin,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      message: "Admin permissions fetched successfully",
      data: {
        admins: adminsWithPermissions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalAdmins: count,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all admin permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin permissions",
      error: error.message,
    });
  }
};

// Update user permissions
exports.updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterId } = req.body; // The admin making the request
    const permissionsToUpdate = req.body.permissions;

    // Validate requester
    const requester = await User.findByPk(requesterId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only admins can update permissions",
      });
    }

    // Check if requester has permission to manage permissions
    const requesterPermissions = await UserPermissions.findOne({
      where: { user_id: requesterId },
    });

    if (
      !requesterPermissions ||
      (!requesterPermissions.can_manage_permissions &&
        !requesterPermissions.is_root_admin)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You don't have permission to manage permissions",
      });
    }

    // Check if target user exists and is an admin
    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    if (targetUser.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Target user is not an admin",
      });
    }

    // Prevent modifying root admin permissions
    if (userId === ROOT_ADMIN.userId) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify root admin permissions",
      });
    }

    // Get or create permissions for target user
    let targetPermissions = await UserPermissions.findOne({
      where: { user_id: userId },
    });

    if (!targetPermissions) {
      targetPermissions = await UserPermissions.create({
        user_id: userId,
        ...permissionsToUpdate,
      });
    } else {
      // Update permissions (excluding root admin fields)
      const updateData = { ...permissionsToUpdate };
      delete updateData.is_root_admin; // Never allow changing root admin status

      // Only root admin can grant permission management rights
      if (!requesterPermissions.is_root_admin) {
        delete updateData.can_manage_permissions;
      }

      await targetPermissions.update(updateData);
    }

    res.status(200).json({
      success: true,
      message: "User permissions updated successfully",
      data: {
        userId: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.first_name} ${targetUser.last_name}`,
        permissions: {
          dashboard: targetPermissions.dashboard,
          users: targetPermissions.users,
          orders: targetPermissions.orders,
          rejected_orders: targetPermissions.rejected_orders,
          refunded_orders: targetPermissions.refunded_orders,
          seller_payouts: targetPermissions.seller_payouts,
          shipped_orders: targetPermissions.shipped_orders,
          product_list: targetPermissions.product_list,
          commission: targetPermissions.commission,
          disputes: targetPermissions.disputes,
          settings: targetPermissions.settings,
          can_manage_permissions: targetPermissions.can_manage_permissions,
          is_root_admin: targetPermissions.is_root_admin,
        },
      },
    });
  } catch (error) {
    console.error("Update user permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user permissions",
      error: error.message,
    });
  }
};

// Initialize root admin permissions (run once)
exports.initializeRootAdmin = async (req, res) => {
  try {
    // Check if root admin exists
    const rootAdmin = await User.findOne({
      where: {
        email: ROOT_ADMIN.email,
        id: ROOT_ADMIN.userId,
      },
    });

    if (!rootAdmin) {
      return res.status(404).json({
        success: false,
        message: "Root admin user not found",
      });
    }

    // Check if permissions already exist
    let rootPermissions = await UserPermissions.findOne({
      where: { user_id: ROOT_ADMIN.userId },
    });

    if (!rootPermissions) {
      // Create root admin permissions
      rootPermissions = await UserPermissions.create({
        user_id: ROOT_ADMIN.userId,
        dashboard: true,
        users: true,
        orders: true,
        rejected_orders: true,
        refunded_orders: true,
        seller_payouts: true,
        shipped_orders: true,
        product_list: true,
        commission: true,
        disputes: true,
        settings: true,
        can_manage_permissions: true,
        is_root_admin: true,
      });

      res.status(201).json({
        success: true,
        message: "Root admin permissions initialized successfully",
        data: rootPermissions,
      });
    } else {
      // Ensure root admin has all permissions
      await rootPermissions.update({
        dashboard: true,
        users: true,
        orders: true,
        product_list: true,
        rejected_orders: true,
        refunded_orders: true,
        seller_payouts: true,
        shipped_orders: true,
        commission: true,
        disputes: true,
        settings: true,
        can_manage_permissions: true,
        is_root_admin: true,
      });

      res.status(200).json({
        success: true,
        message: "Root admin permissions already exist and updated",
        data: rootPermissions,
      });
    }
  } catch (error) {
    console.error("Initialize root admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing root admin permissions",
      error: error.message,
    });
  }
};

// Check if user has specific permission
exports.checkPermission = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permission } = req.query;

    // Get user permissions
    const userPermissions = await UserPermissions.findOne({
      where: { user_id: userId },
    });

    if (!userPermissions) {
      return res.status(404).json({
        success: false,
        message: "User permissions not found",
        hasPermission: false,
      });
    }

    const hasPermission = userPermissions[permission] || false;

    res.status(200).json({
      success: true,
      message: "Permission check completed",
      hasPermission,
      permission,
    });
  } catch (error) {
    console.error("Check permission error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking permission",
      error: error.message,
    });
  }
};
