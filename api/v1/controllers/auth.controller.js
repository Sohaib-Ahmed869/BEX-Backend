const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../../models/user.model");
require("dotenv").config();

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
      { expiresIn: "24h" }
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
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Handle license image upload if provided
    let licenseImagePath = null;
    if (req.files && req.files.licenseImage) {
      const licenseImage = req.files.licenseImage;

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, "../uploads/licenses");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const fileName = `license_${Date.now()}${path.extname(
        licenseImage.name
      )}`;
      const uploadPath = path.join(uploadsDir, fileName);

      // Save the file
      await licenseImage.mv(uploadPath);
      licenseImagePath = `/uploads/licenses/${fileName}`;
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
      license_image_path: licenseImagePath,
      seller_approval_status: "pending",
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newSeller.id,
        email: newSeller.email,
        role: newSeller.role,
      },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "24h" }
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
  } catch (error) {
    console.error("Seller signup error:", error);
    res
      .status(500)
      .json({ message: "Error creating seller account", error: error.message });
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

    // Validate password
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "bex-jwt-secret-change-this",
      { expiresIn: "24h" }
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
};
