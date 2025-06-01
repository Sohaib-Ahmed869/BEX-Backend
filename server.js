const express = require("express");
const cors = require("cors");
const { sequelize } = require("./config/db");
const User = require("./models/user.model");
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
const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
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
app.use("/api/orders", OrdersRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/admin/dashboard", AdminDashboardRoutes);
app.use("/api/admin/flagproduct", ProductFlaggingRoutes);

app.use(passport.initialize());

// Add Google auth routes
app.use("/api/googleauth", googleAuthRoutes);
// // Initialize Passport
// app.use(passport.initialize());
// app.use(passport.session());

// // Passport configuration
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await User.findByPk(id);
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });

// // Google OAuth Strategy
// if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
//   passport.use(
//     new GoogleStrategy(
//       {
//         clientID: process.env.GOOGLE_CLIENT_ID,
//         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//         callbackURL: `${
//           process.env.API_URL || "http://localhost:5000"
//         }/api/auth/google/callback`,
//         userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
//       },
//       async (accessToken, refreshToken, profile, done) => {
//         try {
//           // Check if user already exists
//           const existingUser = await User.findOne({
//             where: { email: profile.emails[0].value },
//           });

//           if (existingUser) {
//             return done(null, existingUser);
//           }

//           // Create new user if doesn't exist
//           const newUser = await User.create({
//             email: profile.emails[0].value,
//             password_hash: Math.random().toString(36).substring(2), // Random password
//             first_name:
//               profile.name.givenName || profile.displayName.split(" ")[0],
//             last_name:
//               profile.name.familyName ||
//               profile.displayName.split(" ").slice(1).join(" "),
//             email_verified: true,
//           });

//           return done(null, newUser);
//         } catch (error) {
//           return done(error, null);
//         }
//       }
//     )
//   );
// } else {
//   console.log(
//     "Google OAuth credentials not provided. Google login will not be available."
//   );
// }

// Basic route
app.get("/", (req, res) => {
  res.send("BEX API is running");
});

// Google OAuth routes
// app.get(
//   "/api/auth/google",
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//   })
// );

// app.get(
//   "/api/auth/google/callback",
//   passport.authenticate("google", { failureRedirect: "/login" }),
//   (req, res) => {
//     // Generate JWT token for frontend
//     const token = jwt.sign(
//       { id: req.user.id, email: req.user.email, role: req.user.role },
//       process.env.JWT_SECRET || "bex-jwt-secret-change-this",
//       { expiresIn: "24h" }
//     );

//     // Redirect to frontend with token
//     res.redirect(
//       `${
//         process.env.CLIENT_URL || "http://localhost:5173"
//       }/auth/success?token=${token}`
//     );
//   }
// );

// Sync database and start server
async function startServer() {
  try {
    // First test the connection
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync models with database (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("Database synchronized");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
}

startServer();
