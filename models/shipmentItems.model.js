const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ShipmentItem = sequelize.define(
  "ShipmentItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shipment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "shipments",
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
    quantity_shipped: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "shipment_items",
  }
);

module.exports = ShipmentItem;
