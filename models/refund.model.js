// src/models/refund.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Refund = sequelize.define(
  "Refund",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
        model: "order_items", // Assuming your table name
        key: "id",
      },
    },
    stripe_refund_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    item_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false, // Original item price for reference
    },
    item_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false, // Quantity being refunded
    },
    reason: {
      type: DataTypes.ENUM(
        "seller_rejected",
        "customer_requested",
        "out_of_stock",
        "quality_issue",
        "damaged_item",
        "wrong_item",
        "other"
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "succeeded", "failed", "canceled"),
      defaultValue: "pending",
      allowNull: false,
    },
    initiated_by: {
      type: DataTypes.UUID, // User ID (admin, customer, seller)
      allowNull: true,
    },
    processed_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Track retip refunds separately if applicable
    retip_refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "refunds",
    indexes: [
      { fields: ["order_id"] },
      { fields: ["order_item_id"] },
      { fields: ["stripe_refund_id"] },
    ],
  }
);

module.exports = Refund;
