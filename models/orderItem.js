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
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    retip_added: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    platform_commission: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    retip_price: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    order_status: {
      type: DataTypes.ENUM(
        "pending approval",
        "refunded",
        "approved",
        "rejected",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
      ),
      defaultValue: "pending approval",
      allowNull: false,
    },
    seller_paid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    payment_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "order_items",
  }
);

module.exports = OrderItem;
