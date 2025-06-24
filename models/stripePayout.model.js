// src/models/payout.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Payout = sequelize.define(
  "Payout",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    seller_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    stripe_account_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stripe_transfer_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "USD",
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "in_transit",
        "paid",
        "failed",
        "canceled"
      ),
      defaultValue: "pending",
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    initiated_by: {
      type: DataTypes.UUID, // Admin user ID
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    order_items: {
      type: DataTypes.JSONB, // Array of order item IDs included in this payout
      allowNull: true,
    },
    fee_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },
    net_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "payouts",
    indexes: [
      { fields: ["seller_id"] },
      { fields: ["stripe_account_id"] },
      { fields: ["stripe_transfer_id"] },
      { fields: ["status"] },
      { fields: ["initiated_by"] },
    ],
  }
);

module.exports = Payout;
