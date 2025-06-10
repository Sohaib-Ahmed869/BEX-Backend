const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const FlaggedProducts = sequelize.define(
  "FlaggedProducts",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    flagging_reason: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    severity_level: {
      type: DataTypes.ENUM,
      values: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      allowNull: false,
      defaultValue: "MEDIUM",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    flagged_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM,
      values: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"],
      allowNull: false,
      defaultValue: "PENDING",
    },
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "flagged_products",
    indexes: [
      {
        fields: ["product_id"],
      },
      {
        fields: ["severity_level"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
    hooks: {
      afterCreate: async (flaggedProduct) => {
        // Automatically update the product's is_flagged status
        const { Product } = require("./product.modal"); // Adjust path as needed
        await Product.update(
          { is_flagged: true },
          { where: { id: flaggedProduct.product_id } }
        );
      },
      afterUpdate: async (flaggedProduct) => {
        // If status is resolved or dismissed, check if product should remain flagged
        if (
          flaggedProduct.status === "RESOLVED" ||
          flaggedProduct.status === "DISMISSED"
        ) {
          const { Product } = require("./product.modal"); // Adjust path as needed

          // Check if there are any other active flags for this product
          const otherActiveFlags = await FlaggedProducts.count({
            where: {
              product_id: flaggedProduct.product_id,
              status: ["PENDING", "REVIEWED"],
              id: { [require("sequelize").Op.ne]: flaggedProduct.id },
            },
          });

          // If no other active flags, update product's is_flagged status
          if (otherActiveFlags === 0) {
            await Product.update(
              { is_flagged: false },
              { where: { id: flaggedProduct.product_id } }
            );
          }
        }

        // Set resolved_at timestamp when status changes to resolved
        if (
          flaggedProduct.status === "RESOLVED" &&
          !flaggedProduct.resolved_at
        ) {
          flaggedProduct.resolved_at = new Date();
          await flaggedProduct.save();
        }
      },
    },
  }
);

// Define associations

module.exports = {
  FlaggedProducts,
};
