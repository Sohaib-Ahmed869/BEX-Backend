// // models/Chat.js
// const { DataTypes } = require("sequelize");
// const { sequelize } = require("../config/db");

// const Chat = sequelize.define(
//   "Chat",
//   {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     product_id: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       references: {
//         model: "products",
//         key: "id",
//       },
//     },
//     buyer_id: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       references: {
//         model: "users",
//         key: "id",
//       },
//     },
//     seller_id: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       references: {
//         model: "users",
//         key: "id",
//       },
//     },
//     chat_name: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     last_message: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//     last_message_at: {
//       type: DataTypes.DATE,
//       allowNull: true,
//     },
//     is_active: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: true,
//     },
//   },
//   {
//     timestamps: true,
//     createdAt: "created_at",
//     updatedAt: "updated_at",
//     tableName: "chats",
//     indexes: [
//       {
//         unique: true,
//         fields: ["product_id", "buyer_id", "seller_id"],
//       },
//     ],
//   }
// );

// // Define associations
// module.exports = {
//   Chat,
// };
// Updated Chat model with improved indexes
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
      allowNull: true, // nullable for order discussion chats
      references: {
        model: "products",
        key: "id",
      },
    },
    order_item_id: {
      type: DataTypes.UUID,
      allowNull: true, // nullable for product discussion chats
      references: {
        model: "order_items",
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
    chat_type: {
      type: DataTypes.ENUM("product_discussion", "order_discussion"),
      allowNull: false,
      defaultValue: "product_discussion",
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
        fields: ["product_id", "buyer_id", "seller_id", "chat_type"],
        name: "unique_product_chat",
        where: {
          chat_type: "product_discussion",
          product_id: {
            [sequelize.Sequelize.Op.ne]: null,
          },
        },
      },
      {
        unique: true,
        fields: ["order_item_id", "buyer_id", "seller_id", "chat_type"],
        name: "unique_order_item_chat",
        where: {
          chat_type: "order_discussion",
          order_item_id: {
            [sequelize.Sequelize.Op.ne]: null,
          },
        },
      },
    ],
    // validate: {
    //   // Custom validation to ensure either product_id or order_item_id is provided
    //   eitherProductOrOrderItem() {
    //     if (this.chat_type === "product_discussion" && !this.product_id) {
    //       throw new Error("product_id is required for product discussions");
    //     }
    //     if (this.chat_type === "order_discussion" && !this.order_item_id) {
    //       throw new Error("order_item_id is required for order discussions");
    //     }
    //   },
    // },
  }
);

module.exports = {
  Chat,
};
