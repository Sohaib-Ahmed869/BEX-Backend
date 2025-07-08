const express = require("express");
const cors = require("cors");
const { sequelize } = require("./config/db");
const User = require("./models/user.model");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
const authRoutes = require("./api/v1/routes/auth.routes");
const productRoutes = require("./api/v1/routes/product.routes");
const cartRoutes = require("./api/v1/routes/cart.routes");
const wishlistRoutes = require("./api/v1/routes/wishlist.routes");
const checkoutRoutes = require("./api/v1/routes/checkout.routes");
const googleAuthRoutes = require("./api/v1/routes/googleAuth.routes");
const SellerDashboardRoutes = require("./api/v1/routes/SellerDashboardStats.routes");
const AdminDashboardRoutes = require("./api/v1/routes/AdminDashboardStats.routes");
const ProductListingRoutes = require("./api/v1/routes/ProductListings.routes");
const OrdersRoutes = require("./api/v1/routes/orders.routes");
const UserRoutes = require("./api/v1/routes/users.routes");
const ProductFlaggingRoutes = require("./api/v1/routes/flagProducts.routes");
const CategoryCommissionRoutes = require("./api/v1/routes/commission.routes");
const OrderDisputeRoutes = require("./api/v1/routes/orderDisputes.routes");
const shipstationRoutes = require("./api/v1/routes/shipment.routes");
const OrderAnalyticsRoutes = require("./api/v1/routes/orderAnalytics.routes");
const { setupChatSocket } = require("./api/v1/socket/chatSocket");
const ChatRoutes = require("./api/v1/routes/chat.routes");
const UserPermissionRoutes = require("./api/v1/routes/userPermissions.routes");
const RefundRoutes = require("./api/v1/routes/refund.routes");
const StripeConnectRoutes = require("./api/v1/routes/stripeConnect.routes");
const PayoutStatsRoutes = require("./api/v1/routes/PayoutStats.routes");
const http = require("http");
const socketIo = require("socket.io");
const {
  startProductExpirationCronJob,
} = require("./jobs/ProductExpirationCronJob");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3173",
    credentials: true,
  })
);
// Make sure socket.io instance is available to routes
app.set("io", io);
// Setup Socket.IO
setupChatSocket(io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bex-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Routes
// AUTH
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/listing", ProductListingRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/sellerdashboard", SellerDashboardRoutes);
app.use("/api/orderanalytics", OrderAnalyticsRoutes);
app.use("/api/orders", OrdersRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/orderdispute", OrderDisputeRoutes);
app.use("/api/admin/dashboard", AdminDashboardRoutes);
app.use("/api/admin/flagproduct", ProductFlaggingRoutes);
app.use("/api/admin/commission", CategoryCommissionRoutes);
app.use("/api/admin/userpermission", UserPermissionRoutes);
app.use("/api/admin/refund", RefundRoutes);
app.use("/api/stripe-connect", StripeConnectRoutes);
app.use("/api/admin/payoutStats", PayoutStatsRoutes);
app.use("/api/chat", ChatRoutes);
app.use("/api/shipstation", shipstationRoutes);
app.use(
  "/api/webhooks/shipstation",
  express.raw({ type: "application/json" }),
  shipstationRoutes
);

app.use(passport.initialize());

// Add Google auth routes
app.use("/api/googleauth", googleAuthRoutes);
// Handle mobile upload route specifically (add this before the basic route)
app.get("/mobile-upload/:token", (req, res) => {
  // This will serve your React app which handles the routing
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});
// Basic route
app.get("/", (req, res) => {
  res.send("BEX API is running");
});
startProductExpirationCronJob();

// Sync database and start server
async function startServer() {
  try {
    // First test the connection
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync models with database (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("Database synchronized");

    // IMPORTANT: Use server.listen() instead of app.listen()
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO server is ready`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
}

startServer();
