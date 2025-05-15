// src/models/inventory.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Inventory = sequelize.define(
  "Inventory",
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
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "companies",
        key: "id",
      },
    },
    drill_bit_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "drill_bits",
        key: "id",
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    tube_condition: {
      type: DataTypes.ENUM("New", "Used - No Dents", "Used Some Dents"),
      allowNull: false,
    },
    segment_condition: {
      type: DataTypes.ENUM("New", "75%+", "50%+", "25%+", "Tube"),
      allowNull: false,
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    images: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    condition_answers: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    is_listed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "inventory",
  }
);

module.exports = Inventory;
