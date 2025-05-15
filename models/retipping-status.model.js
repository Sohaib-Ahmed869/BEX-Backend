// src/models/retipping-status.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const RetippingStatus = sequelize.define(
  "RetippingStatus",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    retipping_request_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "retipping_requests",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM(
        "received",
        "assessing",
        "can_retip",
        "cannot_retip",
        "retipping",
        "retipped",
        "shipping",
        "delivered",
        "returned"
      ),
      allowNull: false,
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tracking_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "retipping_statuses",
  }
);

module.exports = RetippingStatus;
