// src/models/stripeAccount.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const StripeAccount = sequelize.define(
  "StripeAccount",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    stripe_account_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    account_type: {
      type: DataTypes.ENUM("express", "standard"),
      defaultValue: "express",
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(2), // ISO country code
      allowNull: false,
      defaultValue: "US",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    onboarding_completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    charges_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    payouts_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    details_submitted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    requirements: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "complete", "restricted", "inactive"),
      defaultValue: "pending",
      allowNull: false,
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "stripe_accounts",
    indexes: [
      { fields: ["user_id"] },
      { fields: ["stripe_account_id"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = StripeAccount;
