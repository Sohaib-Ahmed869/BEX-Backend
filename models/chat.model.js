// models/Chat.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Chat = sequelize.define(
  "Chat",
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
    },
    buyer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
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
    chat_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "chats",
    indexes: [
      {
        unique: true,
        fields: ["product_id", "buyer_id", "seller_id"],
      },
    ],
  }
);

// Define associations
module.exports = {
  Chat,
};
