const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Commission = sequelize.define(
  "Commission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    category: {
      type: DataTypes.ENUM(
        "Core Drill Bits",
        "Core Drills",
        "Flat Saws",
        "Wall Saws & Wire Saws",
        "Diamond Consumables",
        "Handheld Power Saws",
        "Specialty Saws",
        "Drilling Equipment",
        "Joint Sealant & Repair Equipment",
        "Materials & Consumables",
        "Demolition Equipment",
        "Accessories"
      ),
      allowNull: false,
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2), // Allows for percentages like 10.50%
      allowNull: false,
      validate: {
        min: 0,
        max: 100, // Maximum 100%
      },
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "commissions",
  }
);

module.exports = Commission;
