// src/models/listing.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Listing = sequelize.define(
  "Listing",
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
    inventory_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "inventory",
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
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
    images: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expiration_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    can_be_retipped: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "listings",
    hooks: {
      beforeCreate: (listing) => {
        // Set expiration date to 30 days from now if not provided
        if (!listing.expiration_date) {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          listing.expiration_date = thirtyDaysFromNow;
        }
      },
    },
  }
);

module.exports = Listing;
