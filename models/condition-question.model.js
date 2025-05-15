// src/models/condition-question.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ConditionQuestion = sequelize.define(
  "ConditionQuestion",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    product_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "product_types",
        key: "id",
      },
    },
    question: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    question_type: {
      type: DataTypes.ENUM("text", "select", "boolean", "number"),
      allowNull: false,
    },
    possible_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "condition_questions",
  }
);

module.exports = ConditionQuestion;
