// src/models/index.js
const User = require("./user.model");
const Company = require("./company.model");
const ProductType = require("./product-type.model");
const ConditionQuestion = require("./condition-question.model");
const DrillBit = require("./drill-bit.model");
const Inventory = require("./inventory.model");
const Listing = require("./listing.model");
const Order = require("./order.model");
const OrderItem = require("./order-item.model");
const Transaction = require("./transaction.model");
const TransactionLog = require("./transaction-log.model");
const RetippingRequest = require("./retipping-request.model");
const RetippingStatus = require("./retipping-status.model");

// User associations
User.hasMany(Company, { foreignKey: "user_id" });
User.hasMany(Listing, { foreignKey: "user_id" });
User.hasMany(Order, { foreignKey: "buyer_id" });
User.hasMany(Inventory, { foreignKey: "user_id" });
User.hasMany(RetippingRequest, { foreignKey: "user_id" });
User.hasMany(RetippingStatus, { foreignKey: "updated_by_user_id" });

// Company associations
Company.belongsTo(User, { foreignKey: "user_id" });
Company.hasMany(Listing, { foreignKey: "company_id" });
Company.hasMany(Inventory, { foreignKey: "company_id" });

// ProductType associations
ProductType.hasMany(DrillBit, { foreignKey: "product_type_id" });
ProductType.hasMany(ConditionQuestion, { foreignKey: "product_type_id" });

// ConditionQuestion associations
ConditionQuestion.belongsTo(ProductType, { foreignKey: "product_type_id" });

// DrillBit associations
DrillBit.belongsTo(ProductType, { foreignKey: "product_type_id" });
DrillBit.hasMany(Inventory, { foreignKey: "drill_bit_id" });
DrillBit.hasMany(Listing, { foreignKey: "drill_bit_id" });

// Inventory associations
Inventory.belongsTo(User, { foreignKey: "user_id" });
Inventory.belongsTo(Company, { foreignKey: "company_id" });
Inventory.belongsTo(DrillBit, { foreignKey: "drill_bit_id" });
Inventory.hasMany(Listing, { foreignKey: "inventory_id" });
Inventory.hasMany(RetippingRequest, { foreignKey: "inventory_id" });

// Listing associations
Listing.belongsTo(User, { foreignKey: "user_id" });
Listing.belongsTo(Company, { foreignKey: "company_id" });
Listing.belongsTo(DrillBit, { foreignKey: "drill_bit_id" });
Listing.belongsTo(Inventory, { foreignKey: "inventory_id" });
Listing.hasMany(OrderItem, { foreignKey: "listing_id" });

// Order associations
Order.belongsTo(User, { foreignKey: "buyer_id", as: "Buyer" });
Order.hasMany(OrderItem, { foreignKey: "order_id" });
Order.hasMany(Transaction, { foreignKey: "order_id" });
Order.hasMany(RetippingRequest, { foreignKey: "order_id" });

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: "order_id" });
OrderItem.belongsTo(Listing, { foreignKey: "listing_id" });

// Transaction associations
Transaction.belongsTo(Order, { foreignKey: "order_id" });
Transaction.hasMany(TransactionLog, { foreignKey: "transaction_id" });

// TransactionLog associations
TransactionLog.belongsTo(Transaction, { foreignKey: "transaction_id" });

// RetippingRequest associations
RetippingRequest.belongsTo(User, { foreignKey: "user_id" });
RetippingRequest.belongsTo(Order, { foreignKey: "order_id" });
RetippingRequest.belongsTo(Inventory, { foreignKey: "inventory_id" });
RetippingRequest.hasMany(RetippingStatus, {
  foreignKey: "retipping_request_id",
});

// RetippingStatus associations
RetippingStatus.belongsTo(RetippingRequest, {
  foreignKey: "retipping_request_id",
});
RetippingStatus.belongsTo(User, {
  foreignKey: "updated_by_user_id",
  as: "UpdatedBy",
});

module.exports = {
  User,
  Company,
  ProductType,
  ConditionQuestion,
  DrillBit,
  Inventory,
  Listing,
  Order,
  OrderItem,
  Transaction,
  TransactionLog,
  RetippingRequest,
  RetippingStatus,
};
