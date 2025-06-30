// src/models/index.js
const User = require("./user.model");
const Company = require("./company.model");
const ProductType = require("./product-type.model");
const ConditionQuestion = require("./condition-question.model");
const DrillBit = require("./drill-bit.model");
const Inventory = require("./inventory.model");
const Order = require("./order.model");
const OrderItem = require("./orderItem");
const Transaction = require("./transaction.model");
const TransactionLog = require("./transaction-log.model");
const RetippingRequest = require("./retipping-request.model");
const RetippingStatus = require("./retipping-status.model");
const { Product, ProductRetippingDetails } = require("./product.modal");
const { CartItem, Cart } = require("./cart.model");
const { Wishlist, WishlistItem } = require("./wishlist.model");
const { ProductListing } = require("./ProductListing.model");
const OrderDispute = require("./orderdisputes.model");
const { Chat } = require("./chat.model");
const { Message } = require("./message.model");
const Refund = require("./refund.model");
const { FlaggedProducts } = require("./flagged-products.model");
const UserPermissions = require("./userPermissions.model");
const Payout = require("./stripePayout.model"); // Add this import
const ShipmentItem = require("./shipmentItems.model");
const Shipment = require("./shipment.model");

// Order - OrderItem associations
Order.hasMany(OrderItem, {
  foreignKey: "order_id",
  as: "items",
});

OrderItem.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// Product - OrderItem associations
OrderItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

Product.hasMany(OrderItem, {
  foreignKey: "product_id",
});

// User - Order associations
User.hasMany(Order, {
  foreignKey: "buyer_id",
  as: "orders",
});

Order.belongsTo(User, {
  foreignKey: "buyer_id",
  as: "buyer",
});

// Cart associations
User.hasOne(Cart, {
  foreignKey: "user_id",
  as: "cart",
});

Cart.hasMany(CartItem, {
  foreignKey: "cart_id",
  as: "items",
});

CartItem.belongsTo(Cart, {
  foreignKey: "cart_id",
});

Cart.belongsToMany(Product, {
  through: CartItem,
  foreignKey: "cart_id",
  otherKey: "product_id",
});

Product.belongsToMany(Cart, {
  through: CartItem,
  foreignKey: "product_id",
  otherKey: "cart_id",
});

// CartItem to Product relationship
CartItem.belongsTo(Product, {
  foreignKey: "product_id",
});

Product.hasMany(CartItem, {
  foreignKey: "product_id",
});

// Wishlist associations
Wishlist.hasMany(WishlistItem, {
  foreignKey: "wishlist_id",
  as: "items",
  onDelete: "CASCADE",
});

WishlistItem.belongsTo(Wishlist, {
  foreignKey: "wishlist_id",
  as: "wishlist",
});

// Product - ProductRetippingDetails associations
Product.hasOne(ProductRetippingDetails, {
  foreignKey: "product_id",
  as: "retipping_details",
  onDelete: "CASCADE",
});

ProductRetippingDetails.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// User associations
User.hasMany(Company, {
  foreignKey: "user_id",
});

User.hasMany(Inventory, {
  foreignKey: "user_id",
});

User.hasMany(RetippingRequest, {
  foreignKey: "user_id",
});

User.hasMany(RetippingStatus, {
  foreignKey: "updated_by_user_id",
});
// User - Product associations (Seller relationship)
User.hasMany(Product, {
  foreignKey: "user_id",
  as: "products",
});

Product.belongsTo(User, {
  foreignKey: "user_id",
  as: "seller",
});
// ProductListing - Product associations (One-to-Many)
ProductListing.hasMany(Product, {
  foreignKey: "listing_id",
  as: "products",
  onDelete: "CASCADE",
});

Product.belongsTo(ProductListing, {
  foreignKey: "listing_id",
  as: "listing",
});

// User - ProductListing associations
User.hasMany(ProductListing, {
  foreignKey: "user_id",
  as: "listings",
});

ProductListing.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Order Disputes
User.hasMany(OrderDispute, {
  foreignKey: "user_id",
  as: "disputes",
});

OrderDispute.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Order - OrderDispute (One order can have many disputes through order items)
Order.hasMany(OrderDispute, {
  foreignKey: "order_id",
  as: "disputes",
});

OrderDispute.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// OrderItem - OrderDispute (One order item can have only one dispute)
OrderItem.hasOne(OrderDispute, {
  foreignKey: "order_item_id",
  as: "dispute",
});

OrderDispute.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  as: "orderItem",
});

// Product - OrderDispute (One product can have many disputes)
Product.hasMany(OrderDispute, {
  foreignKey: "product_id",
  as: "disputes",
});

OrderDispute.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// Messaging

Chat.hasMany(Message, { foreignKey: "chat_id", as: "messages" });
Message.belongsTo(Chat, { foreignKey: "chat_id", as: "chat" });

// User associations
Chat.belongsTo(User, { foreignKey: "buyer_id", as: "buyer" });
Chat.belongsTo(User, { foreignKey: "seller_id", as: "seller" });
Chat.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});
Chat.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  as: "orderItem",
});

OrderItem.hasMany(Chat, {
  foreignKey: "order_item_id",
  as: "chats",
});

Message.belongsTo(User, { foreignKey: "sender_id", as: "sender" });
// Flag Products
FlaggedProducts.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// Belongs to User (flagged by)
FlaggedProducts.belongsTo(User, {
  foreignKey: "flagged_by",
  as: "flagger",
});

// Belongs to User (resolved by)
FlaggedProducts.belongsTo(User, {
  foreignKey: "resolved_by",
  as: "resolver",
});
// user permissions
User.hasOne(UserPermissions, {
  foreignKey: "user_id",
  as: "permissions",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Refund associations
Order.hasMany(Refund, {
  foreignKey: "order_id",
  as: "refunds",
});

Refund.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

OrderItem.hasMany(Refund, {
  foreignKey: "order_item_id",
  as: "refunds",
});

Refund.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  as: "orderItem",
});

// User association for who initiated the refund
User.hasMany(Refund, {
  foreignKey: "initiated_by",
  as: "initiatedRefunds",
});

Refund.belongsTo(User, {
  foreignKey: "initiated_by",
  as: "initiator",
});
// Payout association
User.hasMany(Payout, {
  foreignKey: "seller_id",
  as: "payouts", // Payouts received by the seller
});

Payout.belongsTo(User, {
  foreignKey: "seller_id",
  as: "seller",
});

// User - Payout associations (Initiated by relationship)
User.hasMany(Payout, {
  foreignKey: "initiated_by",
  as: "initiatedPayouts", // Payouts initiated by admin/user
});

Payout.belongsTo(User, {
  foreignKey: "initiated_by",
  as: "initiator",
});
// shipment association
// Shipment associations
Order.hasMany(Shipment, {
  foreignKey: "order_id",
  as: "shipments",
});

Shipment.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

User.hasMany(Shipment, {
  foreignKey: "seller_id",
  as: "shipments",
});

Shipment.belongsTo(User, {
  foreignKey: "seller_id",
  as: "seller",
});

// Shipment - ShipmentItem associations
Shipment.hasMany(ShipmentItem, {
  foreignKey: "shipment_id",
  as: "items",
  onDelete: "CASCADE",
});

ShipmentItem.belongsTo(Shipment, {
  foreignKey: "shipment_id",
  as: "shipment",
});

// OrderItem - ShipmentItem associations
OrderItem.hasMany(ShipmentItem, {
  foreignKey: "order_item_id",
  as: "shipment_items",
});

ShipmentItem.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  as: "order_item",
});
module.exports = {
  User,
  Refund,
  Company,
  ProductType,
  Cart,
  CartItem,
  FlaggedProducts,
  ConditionQuestion,
  DrillBit,
  Inventory,
  Order,
  OrderItem,
  Transaction,
  TransactionLog,
  RetippingRequest,
  RetippingStatus,
  Product,
  ProductRetippingDetails,
  Wishlist,
  WishlistItem,
  ProductListing,
  OrderDispute,
  Chat,
  Message,
  Shipment,
  ShipmentItem,
  UserPermissions,
  Payout,
};
