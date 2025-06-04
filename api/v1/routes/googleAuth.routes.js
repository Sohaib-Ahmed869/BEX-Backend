const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const User = require("../../../models/user.model"); // Adjust path as needed
const router = express.Router();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// S3 upload function
const uploadFileToS3 = async (file) => {
  // Validate file type
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(
      "Invalid file format. Only JPEG, JPG, PNG, PDF and WEBP are allowed"
    );
  }

  // Create unique filename
  const filename = `${uuidv4()}${fileExtension}`;

  // Upload to S3
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `licenses/${filename}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
};
// Configure Google Strategy with your credentials
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/googleauth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile);

        // Check if user exists
        let user = await User.findOne({
          where: { email: profile.emails[0].value },
        });

        if (user) {
          // Existing user
          console.log("Existing user found:", user.email);
          return done(null, { user, isNewUser: false });
        } else {
          // New user - we'll handle registration in the callback
          const userData = {
            email: profile.emails[0].value,
            first_name: profile.name.givenName || "",
            last_name: profile.name.familyName || "",
            googleId: profile.id,
            picture: profile.photos[0]?.value || null,
          };
          console.log("New user data:", userData);
          return done(null, { userData, isNewUser: true });
        }
      } catch (error) {
        console.error("Google strategy error:", error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session (though we're not using sessions)
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google auth route
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// Google callback route
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    try {
      console.log("Google callback received:", req.user);

      const { user, userData, isNewUser } = req.user;

      if (isNewUser) {
        // New user - create temporary token and redirect for role selection
        const tempToken = jwt.sign(
          { tempUser: userData },
          process.env.JWT_SECRET || "bex-jwt-secret-change-this",
          { expiresIn: "10m" }
        );

        // Determine frontend URL based on environment
        const frontendUrl =
          process.env.NODE_ENV === "production"
            ? "https://bex-ten.vercel.app"
            : "http://localhost:5173";

        console.log("Redirecting new user with temp token");
        res.redirect(`${frontendUrl}/login?token=${tempToken}&newUser=true`);
      } else {
        // Existing user - create full token and redirect based on role
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || "bex-jwt-secret-change-this",
          { expiresIn: "24h" }
        );

        const frontendUrl =
          process.env.NODE_ENV === "production"
            ? "https://bex-ten.vercel.app"
            : "http://localhost:5173";

        console.log("Redirecting existing user:", user.role);
        res.redirect(`${frontendUrl}/login?token=${token}`);
      }
    } catch (error) {
      console.error("Callback error:", error);
      const frontendUrl =
        process.env.NODE_ENV === "production"
          ? "https://bex-ten.vercel.app"
          : "http://localhost:5173";
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

// Get user data for new users
router.get("/google/user-data", authenticateToken, (req, res) => {
  try {
    console.log("Getting user data for:", req.user);
    if (req.user.tempUser) {
      res.json(req.user.tempUser);
    } else {
      res.status(400).json({ message: "No temporary user data found" });
    }
  } catch (error) {
    console.error("Error getting user data:", error);
    res.status(500).json({ message: "Error getting user data" });
  }
});

router.post(
  "/google/complete-registration",
  upload.single("licenseImage"), // Add multer middleware
  authenticateToken,
  async (req, res) => {
    try {
      console.log("Completing registration:", req.body);
      console.log("Request file:", req.file);

      const {
        role,
        companyName,
        companyRegistrationNumber,
        countryOfRegistration,
        businessAddress,
        websiteUrl,
        city,
        postalCode,
      } = req.body;
      const tempUserData = req.user.tempUser;

      if (!tempUserData) {
        return res
          .status(400)
          .json({ message: "No temporary user data found" });
      }

      // Handle license image upload to S3 if provided
      let licenseImageUrl = null;
      if (req.file) {
        try {
          licenseImageUrl = await uploadFileToS3(req.file);
          console.log("License image uploaded successfully:", licenseImageUrl);
        } catch (uploadError) {
          console.error("Error uploading license image:", uploadError);
          return res.status(400).json({
            message: "Error uploading license image",
            error: uploadError.message,
          });
        }
      }

      // Create the user
      const newUser = await User.create({
        email: tempUserData.email,
        password_hash: "google_auth_" + Date.now(), // Unique placeholder for Google auth users
        first_name: tempUserData.first_name,
        last_name: tempUserData.last_name,
        role: role,
        // Seller specific fields
        company_name: companyName || null,
        company_registration_number: companyRegistrationNumber || null,
        country_of_registration: countryOfRegistration || null,
        business_address: businessAddress || null,
        website_url: websiteUrl || null,
        city: city || null,
        postal_code: postalCode || null,
        // Buyer specific fields
        license_image_path: licenseImageUrl, // Store S3 URL
        seller_approval_status: role === "seller" ? "pending" : null,
        email_verified: true, // Google users are pre-verified
      });

      console.log("User created:", newUser.id);

      // Generate final token
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || "bex-jwt-secret-change-this",
        { expiresIn: "24h" }
      );

      res.json({
        message: "Registration completed successfully",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
          company_name: newUser.company_name,
          seller_approval_status: newUser.seller_approval_status,
        },
      });
    } catch (error) {
      console.error("Google registration completion error:", error);
      res.status(500).json({
        message: "Error completing registration",
        error: error.message,
      });
    }
  }
);
// Get current user info
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    });
  } catch (error) {
    console.error("Error getting user info:", error);
    res.status(500).json({ message: "Error getting user info" });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "bex-jwt-secret-change-this",
    (err, user) => {
      if (err) {
        console.error("Token verification error:", err);
        return res.status(403).json({ message: "Invalid token" });
      }
      req.user = user;
      next();
    }
  );
}

module.exports = router;
