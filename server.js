// const express = require("express");
// const cors = require("cors");
// const { sequelize } = require("./config/db");
// const User = require("./models/user.model");
// const path = require("path");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const passport = require("passport");
// const session = require("express-session");
// const GoogleStrategy = require("passport-google-oauth20").Strategy;
// require("dotenv").config();
// const authRoutes = require("./api/v1/routes/auth.routes");
// const productRoutes = require("./api/v1/routes/product.routes");
// const cartRoutes = require("./api/v1/routes/cart.routes");
// const wishlistRoutes = require("./api/v1/routes/wishlist.routes");
// const checkoutRoutes = require("./api/v1/routes/checkout.routes");
// const googleAuthRoutes = require("./api/v1/routes/googleAuth.routes");
// const SellerDashboardRoutes = require("./api/v1/routes/SellerDashboardStats.routes");
// const AdminDashboardRoutes = require("./api/v1/routes/AdminDashboardStats.routes");
// const ProductListingRoutes = require("./api/v1/routes/ProductListings.routes");
// const OrdersRoutes = require("./api/v1/routes/orders.routes");
// const UserRoutes = require("./api/v1/routes/users.routes");
// const ProductFlaggingRoutes = require("./api/v1/routes/flagProducts.routes");
// const CategoryCommissionRoutes = require("./api/v1/routes/commission.routes");
// const OrderDisputeRoutes = require("./api/v1/routes/orderDisputes.routes");
// const shipstationRoutes = require("./api/v1/routes/shipment.routes");
// const OrderAnalyticsRoutes = require("./api/v1/routes/orderAnalytics.routes");
// const { setupChatSocket } = require("./api/v1/socket/chatSocket");
// const ChatRoutes = require("./api/v1/routes/chat.routes");
// const UserPermissionRoutes = require("./api/v1/routes/userPermissions.routes");
// const RefundRoutes = require("./api/v1/routes/refund.routes");
// const StripeConnectRoutes = require("./api/v1/routes/stripeConnect.routes");
// const PayoutStatsRoutes = require("./api/v1/routes/PayoutStats.routes");
// const http = require("http");
// const socketIo = require("socket.io");
// const {
//   startProductExpirationCronJob,
// } = require("./jobs/ProductExpirationCronJob");

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || "http://localhost:3000",
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "http://localhost:3173",
//     credentials: true,
//   })
// );
// // Make sure socket.io instance is available to routes
// app.set("io", io);
// // Setup Socket.IO
// setupChatSocket(io);

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Session configuration
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "bex-secret-key-change-this",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       maxAge: 24 * 60 * 60 * 1000, // 24 hours
//     },
//   })
// );

// // Routes
// // AUTH
// app.use("/api/auth", authRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/listing", ProductListingRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/checkout", checkoutRoutes);
// app.use("/api/sellerdashboard", SellerDashboardRoutes);
// app.use("/api/orderanalytics", OrderAnalyticsRoutes);
// app.use("/api/orders", OrdersRoutes);
// app.use("/api/user", UserRoutes);
// app.use("/api/orderdispute", OrderDisputeRoutes);
// app.use("/api/admin/dashboard", AdminDashboardRoutes);
// app.use("/api/admin/flagproduct", ProductFlaggingRoutes);
// app.use("/api/admin/commission", CategoryCommissionRoutes);
// app.use("/api/admin/userpermission", UserPermissionRoutes);
// app.use("/api/admin/refund", RefundRoutes);
// app.use("/api/stripe-connect", StripeConnectRoutes);
// app.use("/api/admin/payoutStats", PayoutStatsRoutes);
// app.use("/api/chat", ChatRoutes);
// app.use("/api/shipstation", shipstationRoutes);
// app.use(
//   "/api/webhooks/shipstation",
//   express.raw({ type: "application/json" }),
//   shipstationRoutes
// );

// app.use(passport.initialize());

// // Add Google auth routes
// app.use("/api/googleauth", googleAuthRoutes);
// // Handle mobile upload route specifically (add this before the basic route)
// app.get("/mobile-upload/:token", (req, res) => {
//   // This will serve your React app which handles the routing
//   res.sendFile(path.join(__dirname, "../build", "index.html"));
// });
// // Basic route
// app.get("/", (req, res) => {
//   res.send("BEX API is running");
// });
// startProductExpirationCronJob();

// // Sync database and start server
// async function startServer() {
//   try {
//     // First test the connection
//     await sequelize.authenticate();
//     console.log("Database connection established successfully.");

//     // Sync models with database (create tables if they don't exist)
//     await sequelize.sync({ alter: true });
//     console.log("Database synchronized");

//     // IMPORTANT: Use server.listen() instead of app.listen()
//     server.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//       console.log(`Socket.IO server is ready`);
//     });
//   } catch (error) {
//     console.error("Unable to start server:", error);
//   }
// }

// startServer();
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
const { setupUploadSocket } = require("./api/v1/socket/mobileUploadSocket");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:3000",
      process.env.CLIENT_URL || "http://localhost:3173",
      "http://localhost:3000",
      "http://localhost:3173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL || "http://localhost:3173",
      "http://localhost:3000",
      "http://localhost:3173",
    ],
    credentials: true,
  })
);

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

// Make socket.io instance available to routes
app.set("io", io);

// Setup Socket.IO
setupChatSocket(io); // Chat socket with authentication
const uploadNamespace = setupUploadSocket(io); // Upload socket without authentication

// Make upload namespace available to routes too
app.set("uploadNamespace", uploadNamespace);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/googleauth/callback",
    },
    (accessToken, refreshToken, profile, cb) => {
      User.findOrCreate({
        where: { googleId: profile.id },
        defaults: { name: profile.displayName },
      }).then(([user]) => {
        return cb(null, user);
      });
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser((id, cb) => {
  User.findByPk(id).then((user) => {
    cb(null, user);
  });
});

app.use(passport.initialize());

// Routes
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

// Add Google auth routes
app.use("/api/googleauth", googleAuthRoutes);

// Handle mobile upload route specifically
app.get("/mobile-upload/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

// Basic route
app.get("/", (req, res) => {
  res.send("BEX API is running");
});

startProductExpirationCronJob();

// Main Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`New socket connection: ${socket.id}`);

  // Send connection confirmation
  socket.emit("connection-confirmed", {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  });

  // Handle upload token registration (for QR code uploads)
  socket.on("register-upload-token", (data) => {
    const { token, userId } = data;
    console.log(`Registering upload token: ${token} for user: ${userId}`);

    // Join a room specific to this upload token
    socket.join(`upload-${token}`);

    // Confirm registration
    socket.emit("token-registered", {
      success: true,
      token,
      message: "Upload token registered successfully",
    });
  });

  // Handle upload token cleanup
  socket.on("cleanup-upload-token", (data) => {
    const { token } = data;
    console.log(`Cleaning up upload token: ${token}`);
    socket.leave(`upload-${token}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected: ${reason}`);
  });
});

// Start server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    await sequelize.sync({ alter: true });
    console.log("Database synchronized");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO server is ready`);
      console.log(`Chat socket: /`);
      console.log(`Upload socket: /uploads`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
}

startServer();
