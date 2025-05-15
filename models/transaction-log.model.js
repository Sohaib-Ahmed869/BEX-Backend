// src/models/transaction-log.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const TransactionLog = sequelize.define(
  "TransactionLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    transaction_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "transactions",
        key: "id",
      },
    },
    event: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updatedAt field
    tableName: "transaction_logs",
  }
);

module.exports = TransactionLog;
