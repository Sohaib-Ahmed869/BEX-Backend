const { Sequelize } = require("sequelize");
require("dotenv").config();

// Create connection specifically to PostgreSQL 17
// PostgreSQL 17 might be running on a different port than the default 5432
// Common alternate ports might be 5433, 5434, etc.
const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  // Check which port PostgreSQL 17 is running on and update this
  port: process.env.DB_PORT || 5432, // Assuming PostgreSQL 17 is on port 5433
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "kitkat123",
  database: process.env.DB_NAME || "BEX",
  logging: console.log,
  // Explicitly disable SSL for local development
  dialectOptions: {
    ssl: false,
  },
});

// Detailed connection test function
const testConnection = async () => {
  try {
    // Test basic connection
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    // Get PostgreSQL version information
    const [results] = await sequelize.query("SELECT version();");
    console.log("Connected to PostgreSQL version:", results[0].version);

    return true;
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    return false;
  }
};

// Run test on module import
testConnection();

module.exports = { sequelize, testConnection };
