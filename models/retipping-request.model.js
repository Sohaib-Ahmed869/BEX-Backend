// src/models/retipping-request.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const RetippingRequest = sequelize.define(
  "RetippingRequest",
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
    order_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "orders",
        key: "id",
      },
    },
    inventory_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "inventory",
        key: "id",
      },
    },
    request_type: {
      type: DataTypes.ENUM("order_retipping", "direct_retipping"),
      allowNull: false,
    },
    shipping_details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    shipstation_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    retipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "retipping_requests",
    validate: {
      orderOrInventory() {
        if (!this.order_id && !this.inventory_id) {
          throw new Error("Either order_id or inventory_id must be provided");
        }
        if (this.order_id && this.inventory_id) {
          throw new Error(
            "Only one of order_id or inventory_id should be provided"
          );
        }
        if (this.order_id && this.request_type !== "order_retipping") {
          throw new Error(
            "When order_id is provided, request_type must be order_retipping"
          );
        }
        if (this.inventory_id && this.request_type !== "direct_retipping") {
          throw new Error(
            "When inventory_id is provided, request_type must be direct_retipping"
          );
        }
      },
    },
  }
);

module.exports = RetippingRequest;
