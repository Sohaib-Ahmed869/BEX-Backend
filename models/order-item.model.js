// src/models/order-item.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const OrderItem = sequelize.define(
  "OrderItem",
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
    listing_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "listings",
        key: "id",
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    line_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    retipping_requested: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    retipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "order_items",
    hooks: {
      beforeCreate: (orderItem) => {
        // Calculate line total if not provided
        if (!orderItem.line_total) {
          orderItem.line_total =
            parseFloat(orderItem.unit_price) * orderItem.quantity;
        }
      },
      beforeUpdate: (orderItem) => {
        // Recalculate line total if quantity or unit price has changed
        if (orderItem.changed("quantity") || orderItem.changed("unit_price")) {
          orderItem.line_total =
            parseFloat(orderItem.unit_price) * orderItem.quantity;
        }
      },
    },
  }
);

module.exports = OrderItem;
