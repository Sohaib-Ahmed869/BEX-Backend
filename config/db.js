const { Sequelize } = require("sequelize");
require("dotenv").config();

// Neon DB configuration - BEX Project
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Important for Neon DB
    },
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
});

// Alternative configuration if you prefer to use individual connection parameters
// const sequelize = new Sequelize({
//   dialect: "postgres",
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT || 5432,
//   username: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   logging: process.env.NODE_ENV === 'development' ? console.log : false,
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false
//     },
//   },
//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000
//   }
// });

// Enhanced connection test function
const testConnection = async () => {
  try {
    // Test basic connection
    await sequelize.authenticate();
    console.log(
      "✅ Neon Database connection has been established successfully."
    );

    // Get PostgreSQL version information
    const [results] = await sequelize.query("SELECT version();");
    console.log("📊 Connected to PostgreSQL version:", results[0].version);

    // Test connection pool
    // const pool = sequelize.connectionManager.pool;
    // // console.log(
    // //   `🏊 Connection pool - Max: ${pool.options.max}, Min: ${pool.options.min}`
    // // );

    return true;
  } catch (error) {
    console.error("❌ Unable to connect to the Neon database:", error.message);

    // More specific error handling
    if (error.message.includes("ENOTFOUND")) {
      console.error("🔍 DNS resolution failed. Check your host URL.");
    } else if (error.message.includes("authentication failed")) {
      console.error(
        "🔐 Authentication failed. Check your username and password."
      );
    } else if (error.message.includes("SSL")) {
      console.error("🔒 SSL connection issue. Neon requires SSL connections.");
    }

    return false;
  }
};

// Test connection when module is loaded
testConnection();

module.exports = { sequelize, testConnection };
