const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../../models/user.model");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const {
  sendBuyerRegistrationEmail,
  sendSellerRegistrationEmail,
} = require("../../../utils/EmailService");
const UserPermissions = require("../../../models/userPermissions.model");
require("dotenv").config();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const uploadFileToS3 = async (file) => {
  // Validate file type
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(
      "Invalid file format. Only JPEG, JPG, PNG and PDF are allowed"
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

// Register a new user
const RegisterBuyer = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Create a new user
    const newUser = await User.create({
      email,
      password_hash: password, // Model hooks will hash this
      first_name: first_name || "",
      last_name: last_name || "",
      phone: phone || null,
      role: role || "buyer",
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "8h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
      },
    });
    try {
      await sendBuyerRegistrationEmail({
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
      });
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.error("Signup error:", error);
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};
const RegisterSeller = async (req, res) => {
  try {
    // Extract fields from request body
    const {
      email,
      password,
      name,
      companyName,
      companyRegistrationNumber,
      countryOfRegistration,
      businessAddress,
      websiteUrl,
      city,
      postalCode,
    } = req.body;

    // Debug log to check what we're receiving
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
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

    // Split the name into first name and last name (if provided as a full name)
    let first_name = name;
    let last_name = "";

    if (name && name.includes(" ")) {
      const nameParts = name.split(" ");
      first_name = nameParts[0];
      last_name = nameParts.slice(1).join(" ");
    }

    // Create a new seller user
    const newSeller = await User.create({
      email,
      password_hash: password, // Model hooks will hash this
      first_name,
      last_name,
      role: "seller",
      company_name: companyName,
      company_registration_number: companyRegistrationNumber,
      country_of_registration: countryOfRegistration,
      business_address: businessAddress,
      website_url: websiteUrl,
      license_image_path: licenseImageUrl, // Store S3 URL instead of local path
      seller_approval_status: "pending",
      city,
      postal_code: postalCode,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newSeller.id,
        email: newSeller.email,
        role: newSeller.role,
      },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "8h" }
    );

    res.status(201).json({
      message: "Seller registered successfully. Awaiting approval.",
      token,
      user: {
        id: newSeller.id,
        email: newSeller.email,
        first_name: newSeller.first_name,
        last_name: newSeller.last_name,
        role: newSeller.role,
        company_name: newSeller.company_name,
        seller_approval_status: newSeller.seller_approval_status,
      },
    });
    try {
      await sendSellerRegistrationEmail({
        email: newSeller.email,
        first_name: newSeller.first_name,
        last_name: newSeller.last_name,
        company_name: newSeller.company_name,
      });
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.error("Seller signup error:", error);
    res
      .status(500)
      .json({ message: "Error creating seller account", error: error.message });
  }
};
const RegisterAdmin = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Create a new admin user
    const newAdmin = await User.create({
      email,
      password_hash: password, // Model hooks will hash this
      first_name: first_name || "",
      last_name: last_name || "",
      phone: phone || null,
      role: "admin",
    });

    // Define default permissions for non-root admin
    const defaultPermissions = {
      user_id: newAdmin.id,
      dashboard: true,
      users: false, // Limited access to user management
      orders: true,
      product_list: true,
      commission: false, // No commission access by default
      disputes: true,
      settings: false, // No settings access by default
      can_manage_permissions: false, // Cannot manage other admin permissions
      is_root_admin: false, // Not a root admin
    };
    // Create permissions record
    await UserPermissions.create(defaultPermissions);

    // Generate JWT token
    const token = jwt.sign(
      { id: newAdmin.id, email: newAdmin.email, role: newAdmin.role },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "8h" }
    );

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        first_name: newAdmin.first_name,
        last_name: newAdmin.last_name,
        role: newAdmin.role,
      },
      permissions: {
        dashboard: defaultPermissions.dashboard,
        users: defaultPermissions.users,
        orders: defaultPermissions.orders,
        product_list: defaultPermissions.product_list,
        commission: defaultPermissions.commission,
        disputes: defaultPermissions.disputes,
        settings: defaultPermissions.settings,
        can_manage_permissions: defaultPermissions.can_manage_permissions,
        is_root_admin: defaultPermissions.is_root_admin,
      },
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    res
      .status(500)
      .json({ message: "Error creating admin account", error: error.message });
  }
};

// Login Function
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is suspended
    if (user.is_suspended) {
      return res.status(403).json({
        message:
          "Your account has been suspended. Please contact support for assistance.",
      });
    }

    // Validate password
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "8h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ message: "Error during login", error: error.message });
  }
};

module.exports = {
  RegisterBuyer,
  RegisterSeller,
  login,
  RegisterAdmin,
};
