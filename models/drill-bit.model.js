// src/models/drill-bit.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const DrillBit = sequelize.define(
  "DrillBit",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    product_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "product_types",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    diameter: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    length: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    specifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "drill_bits",
  }
);

module.exports = DrillBit;
