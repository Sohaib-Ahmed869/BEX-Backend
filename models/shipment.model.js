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
    tracking_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ups_shipment_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    carrier: {
      type: DataTypes.STRING,
      defaultValue: "UPS",
      allowNull: false,
    },
    service_code: {
      type: DataTypes.STRING,
      defaultValue: "03", // UPS Ground
      allowNull: false,
    },
    service_description: {
      type: DataTypes.STRING,
      defaultValue: "Ground",
      allowNull: false,
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    dimensions: {
      type: DataTypes.JSONB,
      allowNull: false,
      // { length: 10, width: 8, height: 6 }
    },
    shipping_address: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    shipper_address: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "created",
        "pickup_scheduled",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "exception",
        "cancelled",
        "returned"
      ),
      defaultValue: "pending",
      allowNull: false,
    },
    label_url: {
      type: DataTypes.TEXT,
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
    // Pickup related fields
    pickup_request_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pickup_date: {
      type: DataTypes.STRING, // YYYYMMDD format
      allowNull: true,
    },
    pickup_ready_time: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pickup_close_time: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Return related fields
    return_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    original_shipment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "shipments",
        key: "id",
      },
    },
    return_shipment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "shipments",
        key: "id",
      },
    },
    // UPS API responses
    ups_response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ups_pickup_response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tracking_events: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
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
