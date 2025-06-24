const jwt = require("jsonwebtoken");
const User = require("../../models/user.model"); // Fix: Change the import style

/**
 * Authentication middleware
 * Verifies JWT token in Authorization header
 * Sets req.user to decoded user information if token is valid
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];
    console.log("token", token);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token format.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists in database
    const user = await User.findByPk(decoded.id); // Fix: Use 'id' instead of 'userId'

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.id, // Fix: Use 'id' instead of 'userId'
      email: decoded.email,
      role: decoded.role || "user",
    };

    // Verify that the user ID in the route params matches the token's user ID
    // This prevents users from accessing other users' carts
    // const userIdParam = req.params.userId;

    // if (userIdParam && userIdParam !== decoded.id) {
    //   // Fix: Use 'id' instead of 'userId'
    //   return res.status(403).json({
    //     success: false,
    //     message: "Forbidden. You cannot access another user's resources.",
    //   });
    // }

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      });
    }

    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

/**
 * Authorization middleware for admin users only
 * Should be used after the authenticate middleware
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }

  next();
};
