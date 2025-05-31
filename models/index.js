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

module.exports = {
  User,
  Company,
  ProductType,
  Cart,
  CartItem,
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
};
