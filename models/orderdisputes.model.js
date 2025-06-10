const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const OrderDispute = sequelize.define(
  "OrderDispute",
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
    user_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    dispute_category: {
      type: DataTypes.ENUM(
        "product_quality",
        "shipping_delay",
        "wrong_item",
        "damaged_item",
        "not_received",
        "billing_issue",
        "refund_request",
        "other"
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "orders",
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
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
    },
    dispute_status: {
      type: DataTypes.ENUM(
        "open",
        "in_progress",
        "resolved",
        "closed",
        "rejected"
      ),
      defaultValue: "open",
      allowNull: false,
    },
    // Updated field to store all responses in chronological order
    responses: {
      type: DataTypes.JSON, // Using JSON instead of ARRAY for better structure
      allowNull: true,
      defaultValue: [],
      comment: "Array of response objects with sender, message, timestamp",
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "order_disputes",

    // Instance methods for managing responses
    instanceMethods: {
      // Add a new response to the dispute
      addResponse: function (senderType, senderId, senderName, message) {
        const newResponse = {
          id: require("crypto").randomUUID(),
          sender_type: senderType, // 'user' or 'admin'
          sender_id: senderId,
          sender_name: senderName,
          message: message,
          timestamp: new Date().toISOString(),
          created_at: new Date(),
        };

        this.responses = [...(this.responses || []), newResponse];
        return this.save();
      },

      // Get responses sorted chronologically
      getResponsesChronologically: function () {
        return (this.responses || []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
      },

      // Get latest response
      getLatestResponse: function () {
        const responses = this.getResponsesChronologically();
        return responses.length > 0 ? responses[responses.length - 1] : null;
      },

      // Check if waiting for admin response
      isWaitingForAdmin: function () {
        const latestResponse = this.getLatestResponse();
        return !latestResponse || latestResponse.sender_type === "user";
      },

      // Check if waiting for user response
      isWaitingForUser: function () {
        const latestResponse = this.getLatestResponse();
        return latestResponse && latestResponse.sender_type === "admin";
      },
    },
  }
);

module.exports = OrderDispute;
