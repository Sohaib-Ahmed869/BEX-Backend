const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const OrderDispute = sequelize.define(
  "OrderDispute",
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
    },
    user_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    dispute_category: {
      type: DataTypes.ENUM(
        "product_quality",
        "shipping_delay",
        "wrong_item",
        "damaged_item",
        "not_received",
        "billing_issue",
        "refund_request",
        "other"
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "orders",
        key: "id",
      },
    },
    order_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "order_items",
        key: "id",
      },
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
    },
    dispute_status: {
      type: DataTypes.ENUM(
        "open",
        "in_progress",
        "resolved",
        "closed",
        "rejected"
      ),
      defaultValue: "open",
      allowNull: false,
    },
    admin_response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "order_disputes",
  }
);

module.exports = OrderDispute;
