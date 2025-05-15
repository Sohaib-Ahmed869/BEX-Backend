// src/models/product-type.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ProductType = sequelize.define(
  "ProductType",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    specifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    requires_retipping: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "product_types",
  }
);

module.exports = ProductType;
