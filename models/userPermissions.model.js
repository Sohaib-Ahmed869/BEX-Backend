const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UserPermissions = sequelize.define(
  "UserPermissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    // Admin portal permissions based on your menu items
    dashboard: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    users: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rejected_orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    refunded_orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    seller_payouts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    shipped_orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    product_list: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    commission: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    disputes: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    settings: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Meta permissions
    can_manage_permissions: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Can manage other admin permissions",
    },
    is_root_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Root admin with unchangeable permissions",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "user_permissions",
    indexes: [
      {
        unique: true,
        fields: ["user_id"],
      },
    ],
  }
);

module.exports = UserPermissions;
