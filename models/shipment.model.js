const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Shipment = sequelize.define(
  "Shipment",
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
    seller_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    ups_account_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tracking_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ups_shipment_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shipment_status: {
      type: DataTypes.ENUM(
        "created",
        "processing",
        "shipped",
        "in_transit",
        "delivered",
        "exception",
        "returned"
      ),
      defaultValue: "created",
      allowNull: false,
    },
    shipping_service: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "UPS Ground",
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    estimated_delivery_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actual_delivery_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    package_weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    package_dimensions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    shipping_label_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ups_response_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    shipped_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Store order item IDs that are included in this shipment
    order_item_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    // Additional UPS specific fields
    ups_service_code: {
      type: DataTypes.STRING,
      allowNull: true, // 03 for Ground, 01 for Next Day Air, etc.
    },
    delivery_confirmation: {
      type: DataTypes.STRING,
      allowNull: true, // 1 for Delivery Confirmation, 2 for Signature Required
    },
    insurance_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "shipments",
  }
);

module.exports = Shipment;
