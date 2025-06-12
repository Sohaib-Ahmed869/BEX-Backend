// utils/emailService.js
const { sendEmail } = require("../utils/emailUtil");

/**
 * Comprehensive email service for BEX Marketplace
 * Handles all email notifications with professional templates
 */

// Email template components with responsive design
// In your emailService.js file, replace the emailHeader with this updated version:

const emailHeader = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>BEX Marketplace</title>
  <style type="text/css">
    /* CLIENT-SPECIFIC STYLES */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* RESET STYLES */
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Base container */
    .email-wrapper {
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* Header */
    .email-header {
      background: #f47458;
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    
    .logo-container {
      margin-bottom: 15px;
    }
    
    .logo {
      max-width: 200px;
      height: auto;
    }
    
    /* Body */
    .email-body {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    /* Footer */
    .email-footer {
      text-align: center;
      margin-top: 20px;
      padding: 20px;
      font-size: 14px;
      color: #6c757d;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    
    /* Typography */
    h1, h2, h3 {
      color: #2c3e50;
      margin-top: 0;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    }
    
    h1 {
      color: white;
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    h2 {
      color: #f47458;
      font-size: 24px;
      margin-bottom: 20px;
    }
    
    p, ul, ol, li {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #495057;
    }
    
    /* Button container */
    .button-container {
      text-align: center;
      margin: 25px 0;
    }
    
    /* Base button styles */
    .button {
      background-color: #f47458;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
      transition: background-color 0.3s ease;
      text-align: center;
      min-width: 120px;
      box-sizing: border-box;
      white-space: nowrap;
      margin: 5px 10px;
      vertical-align: top;
    }
    
    .button:hover {
      background-color: #e74c3c;
    }
    
    /* Button variants */
    .button-success {
      background-color: #28a745;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
      transition: background-color 0.3s ease;
      text-align: center;
      min-width: 120px;
      box-sizing: border-box;
      white-space: nowrap;
      margin: 5px 10px;
      vertical-align: top;
    }
    
    .button-success:hover {
      background-color: #218838;
    }
    
    .button-warning {
      background-color: #ffc107;
      color: #212529 !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
      transition: background-color 0.3s ease;
      text-align: center;
      min-width: 120px;
      box-sizing: border-box;
      white-space: nowrap;
      margin: 5px 10px;
      vertical-align: top;
    }
    
    .button-warning:hover {
      background-color: #e0a800;
    }
    
    .button-danger {
      background-color: #dc3545;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
      transition: background-color 0.3s ease;
      text-align: center;
      min-width: 120px;
      box-sizing: border-box;
      white-space: nowrap;
      margin: 5px 10px;
      vertical-align: top;
    }
    
    .button-danger:hover {
      background-color: #c82333;
    }
    
    /* Info boxes */
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #f47458;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 5px 5px 0;
    }
    
    .success-box {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      padding : 5px 10px;
    }
    
    .warning-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 5px 10px;
    }
    
    .danger-box {
      background-color: #f8d7da;
      border-left: 4px solid #f47458;
            padding: 5px 10px;

    }
    
   /* Order item styles - Add this to your existing CSS in emailHeader */

/* Order items container */
.order-details {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-left: 4px solid #f47458;
  border-radius: 8px;
  padding: 25px;
  margin: 25px 0;
}

/* Individual order item */
.order-item {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  border-bottom: 1px solid #dee2e6;
  padding: 20px 0;
  margin-bottom: 15px;
}

.order-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

/* Product image container */
.product-image {
margin-right: 20px;
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e9ecef;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.product-image img:hover {
  transform: scale(1.05);
}

/* Product details container */
.product-details {
  flex: 1;
  min-width: 0; /* Prevents flex item from overflowing */
}

.product-details h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  word-wrap: break-word;
}

.product-details p {
  margin: 8px 0;
  font-size: 15px;
  line-height: 1.4;
  color: #495057;
}

.product-details p strong {
  color: #2c3e50;
  font-weight: 600;
}

/* Price styling */
.product-subtotal {
  font-size: 16px;
  font-weight: 700;
  color: #28a745 !important;
  margin-top: 12px !important;
}

.product-price {
  color: #f47458 !important;
  font-weight: 600;
}

/* Seller name styling */
.seller-info {
  background-color: #e8f4fd;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 10px;
  border-left: 3px solid #007bff;
}

.seller-info strong {
  color: #007bff !important;
}

/* Mobile responsive styles for order items */
@media screen and (max-width: 600px) {
  .order-item {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .product-image {
    width: 100px;
    height: 100px;
    margin: 0 auto;
  }
  
  .product-details {
    text-align: left;
  }
  
  .product-details h4 {
    font-size: 16px;
    text-align: center;
    margin-bottom: 15px;
  }
}

@media screen and (max-width: 480px) {
  .order-details {
    padding: 15px;
  }
  
  .order-item {
    padding: 15px 0;
  }
  
  .product-image {
    width: 80px;
    height: 80px;
  }
  
  .product-details h4 {
    font-size: 15px;
  }
  
  .product-details p {
    font-size: 14px;
  }
}
    
    /* Status badges */
    .status-badge {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .status-confirmed {
      background-color: #28a745;
      color: white;
    }
    
    .status-rejected {
      background-color: #dc3545;
      color: white;
    }
    
    .status-pending {
      background-color: #ffc107;
      color: #212529;
    }
    
    /* MOBILE RESPONSIVE STYLES */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 10px !important;
      }
      
      .email-body {
        padding: 20px !important;
      }
      
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      
      /* Mobile button styles */
      .button,
      .button-success,
      .button-warning,
      .button-danger {
        display: block !important;
        width: 100% !important;
        max-width: 280px !important;
        margin: 10px auto !important;
        padding: 12px 20px !important;
        font-size: 14px !important;
        text-align: center !important;
        white-space: normal !important;
        word-wrap: break-word !important;
        box-sizing: border-box !important;
      }
      
      .button-container {
        text-align: center !important;
        margin: 20px 0 !important;
      }
    }

    /* Small mobile devices */
    @media screen and (max-width: 480px) {
      .button,
      .button-success,
      .button-warning,
      .button-danger {
        font-size: 13px !important;
        padding: 10px 15px !important;
        max-width: 250px !important;
      }
    }

    /* Very small screens */
    @media screen and (max-width: 320px) {
      .button,
      .button-success,
      .button-warning,
      .button-danger {
        font-size: 12px !important;
        padding: 8px 12px !important;
        max-width: 200px !important;
      }
    }

    /* Email client specific fixes */
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
      .button,
      .button-success,
      .button-warning,
      .button-danger {
        min-height: 44px !important;
      }
    }

    @media screen and (-webkit-min-device-pixel-ratio: 2),
           screen and (min-resolution: 192dpi) {
      .button,
      .button-success,
      .button-warning,
      .button-danger {
        border: 1px solid rgba(0,0,0,0.1) !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa;">
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <div class="logo-container">
          <img src="https://bexbucket.s3.eu-north-1.amazonaws.com/Logo/logo.png" alt="BEX Marketplace Logo">
        </div>
      </div>
      <div class="email-body">
`;

const emailFooter = `
      </div>
      <div class="email-footer">
        <p>
          <strong>BEX Marketplace</strong><br>
          Email: <a href="mailto:support@bexmarketplace.com" style="color: #007bff; text-decoration: none;">support@bexmarketplace.com</a><br>
          Phone: <a href="tel:+1234567890" style="color: #007bff; text-decoration: none;">+1 (234) 567-890</a><br>
          Website: <a href="https://bex-ten.vercel.app" style="color: #007bff; text-decoration: none;">BEX Marketplace</a>
        </p>
        <p>© ${new Date().getFullYear()} BEX Marketplace. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Send order confirmation email
 * @param {Object} orderData - Order information
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendOrderConfirmationEmail = async (orderData, userData) => {
  try {
    const {
      id: orderId,
      items,
      total_amount,
      shipping_address,
      payment_method,
    } = orderData;

    const { email, first_name, last_name } = userData;

    const subject = `Order Confirmation - Order #${orderId.slice(0, 8)}`;

    const itemsHtml = items
      .map(
        (item) => `
    <div class="order-item">
      <div class="product-image">
        <img src="${
          item.product_image ||
          "https://via.placeholder.com/120x120?text=No+Image"
        }" 
             alt="${item.product_name}" 
             onerror="this.src='https://via.placeholder.com/120x120?text=No+Image'">
      </div>
      <div class="product-details">
        <h4>${item.product_name}</h4>
        <p><strong>Quantity:</strong> ${item.quantity}</p>
        <p><strong>Unit Price:</strong> <span class="product-price">$${parseFloat(
          item.price
        ).toFixed(2)}</span></p>
        <p class="product-subtotal"><strong>Subtotal:</strong> $${(
          item.quantity * parseFloat(item.price)
        ).toFixed(2)}</p>
      </div>
    </div>
  `
      )
      .join("");

    // Format shipping information
    const shippingInfoHtml =
      typeof shipping_address === "object"
        ? `
      <p><strong>Recipient:</strong> ${shipping_address.name}</p>
      <p><strong>Email:</strong> ${shipping_address.email}</p>
      <p><strong>Address:</strong> ${shipping_address.address}</p>
    `
        : `
      <p><strong>Address:</strong> ${shipping_address}</p>
    `;

    const body = `
      <h2>Thank you for your order, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your order has been confirmed!</strong></p>
        <p>Order #${orderId.slice(
          0,
          8
        )} has been successfully placed and is being processed.</p>
      </div>
      
      <div class="order-details">
        <h3>Order Details</h3>
        ${itemsHtml}
        
        <div style="border-top: 2px solid #007bff; padding-top: 15px; margin-top: 15px;">
          <p class="price">All Items Amount: $${total_amount}</p>
        </div>
      </div>
      
      <div class="info-box">
        <h3>Shipping Information</h3>
        ${shippingInfoHtml}
        <p><strong>Payment Method:</strong> ${payment_method}</p>
        <p><strong>Order Status:</strong> Order Placed</p>
      </div>
      
      <div class="button-container">
        <a href="${process.env.CLIENT_URL}/" class="button">Track Your Order</a>
      </div>
      
      <p>You will receive updates about your order status via email. If you have any questions, please don't hesitate to contact our support team.</p>
      
      <p>Thank you for choosing BEX Marketplace!</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    return {
      success: false,
      message: "Failed to send order confirmation email",
    };
  }
};

/**
 * Send order rejection email
 * @param {Object} orderData - Order information
 * @param {Object} userData - User information
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<Object>} Email sending result
 */
const sendOrderRejectionEmail = async (orderData, userData) => {
  try {
    const {
      id: orderId,
      items,
      total_amount,
      shipping_address,
      payment_method,
    } = orderData;

    const { email, first_name, last_name } = userData;

    const subject = `Order Rejected - Order #${orderId.slice(0, 8)}`;

    const itemsHtml = items
      .map(
        (item) => `
    <div class="order-item">
      <div class="product-image">
        <img src="${
          item.product_image ||
          "https://via.placeholder.com/120x120?text=No+Image"
        }" 
             alt="${item.product_name}" 
             onerror="this.src='https://via.placeholder.com/120x120?text=No+Image'">
      </div>
      <div class="product-details">
        <h4>${item.product_name}</h4>
        <p><strong>Quantity:</strong> ${item.quantity}</p>
        <p><strong>Unit Price:</strong> <span class="product-price">$${parseFloat(
          item.price
        ).toFixed(2)}</span></p>
        <p class="product-subtotal"><strong>Subtotal:</strong> $${(
          item.quantity * parseFloat(item.price)
        ).toFixed(2)}</p>
      </div>
    </div>
  `
      )
      .join("");

    // Format shipping information
    const shippingInfoHtml =
      typeof shipping_address === "object"
        ? `
      <p><strong>Recipient:</strong> ${shipping_address.name}</p>
      <p><strong>Email:</strong> ${shipping_address.email}</p>
      <p><strong>Address:</strong> ${shipping_address.address}</p>
    `
        : `
      <p><strong>Address:</strong> ${shipping_address}</p>
    `;

    const body = `
      <h2>Order Update - ${first_name}</h2>
      
      <div class="danger-box">
        <p><strong>We regret to inform you that your order has been rejected.</strong></p>
        <p>Order #${orderId.slice(
          0,
          8
        )} could not be processed at this time.</p>
      </div>
      
      <div class="order-details">
        <h3>Rejected Order Details</h3>
        ${itemsHtml}
        
        <div style="border-top: 2px solid #dc3545; padding-top: 15px; margin-top: 15px;">
          <p class="price">All Items Amount: $${total_amount}</p>
        </div>
      </div>
      
      <div class="info-box">
        <h3>Shipping Information</h3>
        ${shippingInfoHtml}
        <p><strong>Payment Method:</strong> ${payment_method}</p>
        <p><strong>Order Status:</strong> Rejected</p>
      </div>
      
      <div class="info-box">
        <h3>Issue Resolution</h3>
        <p>You can chat with the seller to discuss about why the order was rejected</p>
      </div>
      
      <div class="info-box">
        <h3>What happens next?</h3>
        <ul>
          <li>If you made a payment, it will be refunded within 3-5 business days</li>
          <li>You can browse similar products and place a new order</li>
          <li>Contact our support team if you need assistance</li>
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button">View Order Details</a>
        <a href="${process.env.CLIENT_URL}/" class="button">Browse Products</a>
      </div>
      
      <p>We apologize for any inconvenience caused. Our team is here to help you find the products you need.</p>
      
      <p>Thank you for choosing BEX Marketplace!</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending order rejection email:", error);
    return { success: false, message: "Failed to send order rejection email" };
  }
};

/**
 * Send buyer registration welcome email
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendBuyerRegistrationEmail = async (userData) => {
  try {
    const { email, first_name, last_name } = userData;

    const subject = "Welcome to BEX Marketplace!";

    const body = `
      <h2>Welcome to BEX Marketplace, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your buyer account has been successfully created!</strong></p>
        <p>You can now start shopping from our wide range of products.</p>
      </div>
      
      <div class="info-box">
        <h3>Getting Started</h3>
        <ul>
          <li>Browse  products from verified sellers</li>
          <li>Add items to your cart and checkout securely</li>
          <li>Track your orders in real-time</li>
          <li>Manage your profile and preferences</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>Your Account Details</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Account Type:</strong> Buyer</p>
        <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-success">Start Shopping</a>
        <a href="${
          process.env.CLIENT_URL
        }/" class="button">Complete Your Profile</a>
      </div>
      
      <div class="info-box">
        <h3>Need Help?</h3>
        <p>If you have any questions or need assistance, our support team is ready to help:</p>
        <ul>
          <li>Contact us via email</li>
          <li>Chat with our support team</li>
        </ul>
      </div>
      
      <p>Thank you for joining BEX Marketplace. We're excited to have you as part of our community!</p>
      
      <p>Happy shopping!<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending buyer registration email:", error);
    return {
      success: false,
      message: "Failed to send buyer registration email",
    };
  }
};

/**
 * Send seller registration email
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendSellerRegistrationEmail = async (userData) => {
  try {
    const { email, first_name, last_name, company_name } = userData;

    const subject = "Seller Registration Received - Pending Approval";

    const body = `
      <h2>Thank you for registering, ${first_name}!</h2>
      
      <div class="warning-box">
        <p><strong>Your seller account is pending approval.</strong></p>
        <p>We've received your registration and our team is reviewing your application.</p>
      </div>
      
      <div class="info-box">
        <h3>Your Registration Details</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${
          company_name ? `<p><strong>Company:</strong> ${company_name}</p>` : ""
        }
        <p><strong>Account Type:</strong> Seller</p>
        <p><strong>Status:</strong> <span class="status-badge status-pending">Pending Approval</span></p>
        <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="info-box">
        <h3>What's Next?</h3>
        <ol>
          <li><strong>Verification Process:</strong> We'll verify your business information</li>
          <li><strong>Approval Notification:</strong> You'll receive an email once approved</li>
          <li><strong>Start Selling:</strong> Begin listing your products and start earning</li>
        </ol>
      </div>
      
      <div class="info-box">
        <h3>Approval Timeline</h3>
        <p>The approval process typically takes 2-3 business days. We'll notify you via email once your account is approved or if we need additional information.</p>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button">Check Application Status</a>
      </div>
      
      <div class="info-box">
        <h3>While You Wait</h3>
        <ul>
          <li>Prepare your product listings and descriptions</li>
          <li>Set up your payment and shipping preferences</li>
          <li>Review our seller guidelines and policies</li>
          <li>Complete your seller profile</li>
        </ul>
      </div>
      
      <p>If you have any questions about your application or need assistance, please don't hesitate to contact our seller support team.</p>
      
      <p>Thank you for choosing BEX Marketplace!</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending seller registration email:", error);
    return {
      success: false,
      message: "Failed to send seller registration email",
    };
  }
};

/**
 * Send account suspension email
 * @param {Object} userData - User information
 * @param {string} reason - Suspension reason
 * @returns {Promise<Object>} Email sending result
 */
const sendAccountSuspensionEmail = async (userData) => {
  try {
    const { email, first_name, last_name, role, reason } = userData;

    const subject = "Account Suspended - BEX Marketplace";

    const body = `
      <h2>Account Suspension Notice - ${first_name} ${last_name}</h2>
      
      <div class="danger-box">
        <p><strong>Your account has been suspended.</strong></p>
        <p>Your ${role} account access has been temporarily restricted.</p>
      </div>
      
      <div class="info-box">
        <h3>Account Information</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Account Type:</strong> ${
          role.charAt(0).toUpperCase() + role.slice(1)
        }</p>
        <p><strong>Status:</strong> <span class="status-badge status-rejected">Suspended</span></p>
        <p><strong>Suspension Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="info-box">
        <h3>Reason for Suspension</h3>
        <p>${
          reason ||
          "No specific reason provided. Please contact support for more details."
        }</p>
      </div>
      
      <div class="info-box">
        <h3>What This Means</h3>
        <ul>
          <li>You cannot access your account dashboard</li>
          ${
            role === "seller"
              ? "<li>Your product listings have been temporarily hidden</li>"
              : ""
          }
          ${role === "buyer" ? "<li>You cannot place new orders</li>" : ""}
          <li>Existing orders will be processed normally</li>
          <li>You can still contact our support team</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>Next Steps</h3>
        <p>If you believe this suspension is in error or would like to appeal this decision, please contact our support team immediately.</p>
        <ul>
          <li>Gather any relevant documentation</li>
          <li>Submit an appeal through our support system</li>
        </ul>
      </div>
      
      <p>Thank you for your understanding.</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
      <p>We take account security and community guidelines seriously. If you have any questions about this suspension, please contact our support team.</p>
      
      <p>Best regards,<br>BEX Marketplace Administration Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending account suspension email:", error);
    return {
      success: false,
      message: "Failed to send account suspension email",
    };
  }
};

/**
 * Send account unsuspension email
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendAccountUnsuspensionEmail = async (userData) => {
  try {
    const { email, first_name, last_name, role } = userData;

    const subject = "Account Reactivated - Welcome Back to BEX Marketplace";

    const body = `
      <h2>Welcome Back, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your account has been reactivated!</strong></p>
        <p>You now have full access to your BEX Marketplace account.</p>
      </div>
      
      <div class="info-box">
        <h3>Account Information</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Account Type:</strong> ${
          role.charAt(0).toUpperCase() + role.slice(1)
        }</p>
        <p><strong>Status:</strong> <span class="status-badge status-confirmed">Active</span></p>
        <p><strong>Reactivation Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="info-box">
        <h3>Your Account Access</h3>
        <ul>
          <li>Full access to your account dashboard</li>
          ${
            role === "seller"
              ? "<li>Your product listings are now visible again</li>"
              : ""
          }
          ${
            role === "seller"
              ? "<li>You can manage orders and inventory</li>"
              : ""
          }
          ${
            role === "buyer"
              ? "<li>You can browse and purchase products</li>"
              : ""
          }
          <li>All account features are now available</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>Moving Forward</h3>
        <p>To ensure your account remains in good standing, please:</p>
        <ul>
          <li>Maintain professional communication with other users</li>
          <li>Keep your account information up to date</li>
          <li>Report any issues to our support team</li>
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-success">Access Your Dashboard</a>
       
      </div>
      
      <p>Thank you for your understanding during the suspension period. We're glad to have you back as an active member of our community!</p>
      
      <p>If you have any questions or need assistance, our support team is here to help.</p>
      
      <p>Welcome back!<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending account unsuspension email:", error);
    return {
      success: false,
      message: "Failed to send account unsuspension email",
    };
  }
};

/**
 * Send order placement notification email
 * @param {Object} orderData - Order information
 * @param {Object} userData - User information
 * @param {Array} items - Order items array
 * @returns {Promise<Object>} Email sending result
 */
const sendOrderPlacementEmail = async (orderData, userData, items) => {
  try {
    const {
      id: orderId,
      total_amount,
      shipping_address,
      platform_fee,
      shipping_cost,
      requires_retipping,
    } = orderData;

    const { email, first_name, last_name } = userData;

    const subject = `Order Placed Successfully - Order #${orderId.slice(0, 8)}`;

    // Calculate subtotals
    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
      0
    );
    const retipTotal = items.reduce((sum, item) => {
      const retipPrice = item.retipAdded ? parseFloat(item.retipPrice || 0) : 0;
      return sum + retipPrice * parseInt(item.quantity);
    }, 0);
    const tax =
      parseFloat(total_amount) -
      subtotal -
      parseFloat(platform_fee) -
      parseFloat(shipping_cost) -
      retipTotal;

    const itemsHtml = items
      .map(
        (item) => `
    <div class="order-item">
      <div class="product-image">
        <img src="${
          item.product_image ||
          "https://via.placeholder.com/120x120?text=No+Image"
        }" 
             alt="${item.title}" 
             onerror="this.src='https://via.placeholder.com/120x120?text=No+Image'">
      </div>
      <div class="product-details">
        <h4>${item.title}</h4>
        <p><strong>Quantity:</strong> ${item.quantity}</p>
        <p><strong>Unit Price:</strong> <span class="product-price">$${parseFloat(
          item.price
        ).toFixed(2)}</span></p>
        ${
          item.retipAdded
            ? `<p><strong>Retipping Service:</strong> <span class="product-price">$${parseFloat(
                item.retipPrice || 0
              ).toFixed(2)} per item</span></p>`
            : ""
        }
        <p class="product-subtotal"><strong>Subtotal:</strong> $${(
          parseInt(item.quantity) * parseFloat(item.price) +
          (item.retipAdded
            ? parseInt(item.quantity) * parseFloat(item.retipPrice || 0)
            : 0)
        ).toFixed(2)}</p>
      </div>
    </div>
  `
      )
      .join("");

    // Format shipping information
    const shippingInfoHtml =
      typeof shipping_address === "object"
        ? `
      <p><strong>Recipient:</strong> ${
        shipping_address.name || `${first_name} ${last_name}`
      }</p>
      <p><strong>Email:</strong> ${shipping_address.email || email}</p>
      <p><strong>Address:</strong> ${shipping_address.address}</p>
      ${
        shipping_address.city
          ? `<p><strong>City:</strong> ${shipping_address.city}</p>`
          : ""
      }
      ${
        shipping_address.state
          ? `<p><strong>State:</strong> ${shipping_address.state}</p>`
          : ""
      }
      ${
        shipping_address.zipCode
          ? `<p><strong>ZIP Code:</strong> ${shipping_address.zipCode}</p>`
          : ""
      }
    `
        : `
      <p><strong>Address:</strong> ${shipping_address}</p>
    `;

    const body = `
      <h2>Order Placed Successfully, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your order has been placed successfully!</strong></p>
        <p>Order #${orderId.slice(
          0,
          8
        )} is now being processed by our sellers.</p>
      </div>
      
      <div class="order-details">
        <h3>Order Summary</h3>
        ${itemsHtml}
        
        <div style="border-top: 2px solid #007bff; padding-top: 15px; margin-top: 15px;">
          <p><strong>Items Subtotal:</strong> $${subtotal.toFixed(2)}</p>
          ${
            retipTotal > 0
              ? `<p><strong>Retipping Services:</strong> $${retipTotal.toFixed(
                  2
                )}</p>`
              : ""
          }
          <p><strong>Tax:</strong> $${tax.toFixed(2)}</p>
          <p><strong>Platform Fee:</strong> $${parseFloat(platform_fee).toFixed(
            2
          )}</p>
          <p><strong>Shipping:</strong> ${
            parseFloat(shipping_cost) === 0
              ? "FREE"
              : `$${parseFloat(shipping_cost).toFixed(2)}`
          }</p>
          <p class="product-subtotal" style="font-size: 18px; border-top: 1px solid #dee2e6; padding-top: 10px; margin-top: 10px;">
            <strong>Order Total: $${parseFloat(total_amount).toFixed(
              2
            )}</strong>
          </p>
        </div>
      </div>
      
      <div class="info-box">
        <h3>Shipping Information</h3>
        ${shippingInfoHtml}
      </div>
      
      <div class="info-box">
        <h3>Order Status</h3>
        <p><strong>Current Status:</strong> <span class="status-badge status-pending">Pending Seller Approval</span></p>
        <p>Each seller will review your order items individually. You'll receive updates as sellers approve or process your items.</p>
        ${
          requires_retipping
            ? "<p><strong>Note:</strong> This order includes retipping services which may require additional processing time.</p>"
            : ""
        }
      </div>
      
      <div class="info-box">
        <h3>What's Next?</h3>
        <ul>
          <li>Sellers will review and approve your order items</li>
          <li>You'll receive email notifications for status updates</li>
          <li>Approved items will be prepared for shipping</li>
          <li>Track your order progress in your account</li>
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${process.env.CLIENT_URL}/" class="button">Track Your Order</a>
        
      </div>
      
      <p>Thank you for shopping with BEX Marketplace! We'll keep you updated on your order progress.</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending order placement email:", error);
    return {
      success: false,
      message: "Failed to send order placement email",
    };
  }
};

/**
 * Send payment successful confirmation email
 * @param {Object} orderData - Order information
 * @param {Object} userData - User information
 * @param {Object} paymentData - Payment details
 * @param {Array} items - Order items array
 * @returns {Promise<Object>} Email sending result
 */
const sendPaymentSuccessfulEmail = async (
  orderData,
  userData,
  paymentData,
  items
) => {
  try {
    const {
      id: orderId,
      total_amount,
      platform_fee,
      shipping_cost,
      tax,
    } = orderData;

    const { email, first_name, last_name } = userData;
    const { id: paymentIntentId, amount, created } = paymentData;

    const subject = `Payment Confirmed - Order #${orderId.slice(0, 8)}`;

    // Calculate payment breakdown
    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
      0
    );
    const retipTotal = items.reduce((sum, item) => {
      const retipPrice = item.retipAdded ? parseFloat(item.retipPrice || 0) : 0;
      return sum + retipPrice * parseInt(item.quantity);
    }, 0);

    const paymentDate = new Date(created * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const body = `
      <h2>Payment Successful, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your payment has been processed successfully!</strong></p>
        <p>Payment for Order #${orderId.slice(0, 8)} has been completed.</p>
      </div>
      
      <div class="info-box">
        <h3>Payment Details</h3>
        <p><strong>Payment ID:</strong> ${paymentIntentId}</p>
        <p><strong>Order ID:</strong> #${orderId.slice(0, 8)}</p>
        <p><strong>Payment Date:</strong> ${paymentDate}</p>
        <p><strong>Payment Method:</strong> Card Payment (Stripe)</p>
        <p><strong>Payment Status:</strong> <span class="status-badge status-confirmed">Completed</span></p>
      </div>
      
      <div class="order-details">
        <h3>Payment Breakdown</h3>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Items Subtotal:</strong></span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          
          ${
            retipTotal > 0
              ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Retipping Services:</strong></span>
            <span>$${retipTotal.toFixed(2)}</span>
          </div>
          `
              : ""
          }
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Tax :</strong></span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Platform Fee :</strong></span>
            <span>$${parseFloat(platform_fee).toFixed(2)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
            <span><strong>Shipping:</strong></span>
            <span>${
              parseFloat(shipping_cost) === 0
                ? "FREE"
                : `$${parseFloat(shipping_cost).toFixed(2)}`
            }</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding-top: 15px; border-top: 2px solid #007bff; font-size: 18px; font-weight: bold;">
            <span><strong>Total Paid:</strong></span>
            <span style="color: #28a745;">$${parseFloat(total_amount).toFixed(
              2
            )}</span>
          </div>
        </div>
      </div>
      
      <div class="info-box">
        <h3>Order Items (${items.length} item${
      items.length > 1 ? "s" : ""
    })</h3>
        ${items
          .map(
            (item) => `
          <div style="border-bottom: 1px solid #dee2e6; padding: 10px 0; margin-bottom: 10px;">
            <p style="margin: 5px 0;"><strong>${item.title}</strong></p>
            <p style="margin: 5px 0; color: #6c757d;">Quantity: ${
              item.quantity
            } × $${parseFloat(item.price).toFixed(2)}</p>
            ${
              item.retipAdded
                ? `<p style="margin: 5px 0; color: #f47458;">+ Retipping Service: $${parseFloat(
                    item.retipPrice || 0
                  ).toFixed(2)} per item</p>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
      
      <div class="info-box">
        <h3>What Happens Next?</h3>
        <ul>
          <li>Sellers will be notified of your order and payment</li>
          <li>Each seller will review and approve their items</li>
          <li>You'll receive updates as your order progresses</li>
          <li>Items will be prepared and shipped once approved</li>
        </ul>
      </div>
      
      <div class="warning-box">
        <h3>Important Payment Information</h3>
        <p><strong>Receipt:</strong> This email serves as your payment receipt. Please keep it for your records.</p>
        <p><strong>Refunds:</strong> If any items are rejected by sellers, refunds will be processed within 3-5 business days.</p>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-success">View Order Details</a>
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-primary">Continue Shopping</a>
      </div>
      
      <p>Thank you for your payment! Your order is now in the system and being processed.</p>
      
      <p>If you have any questions about your payment or order, please don't hesitate to contact our support team.</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending payment successful email:", error);
    return {
      success: false,
      message: "Failed to send payment successful email",
    };
  }
};
/**
 * Send buyer to seller conversion email
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendBuyerToSellerConversionEmail = async (userData) => {
  try {
    const {
      email,
      first_name,
      last_name,
      company_name,
      company_registration_number,
      country_of_registration,
      business_address,
      website_url,
    } = userData;

    const subject = "🎉 Welcome to Selling - Account Converted Successfully!";

    const body = `
      <h2>Congratulations, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your account has been successfully converted to seller status!</strong></p>
        <p>You now have full access to all seller features and can start selling immediately on BEX Marketplace.</p>
      </div>
      
      <div class="info-box">
        <h3>Account Details</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Previous Role:</strong> Buyer</p>
        <p><strong>New Role:</strong> Seller</p>
        <p><strong>Status:</strong> <span class="status-badge status-confirmed">Active & Ready to Sell</span></p>
        <p><strong>Conversion Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="info-box">
        <h3>Business Information Submitted</h3>
        ${
          company_name
            ? `<p><strong>Company Name:</strong> ${company_name}</p>`
            : ""
        }
        ${
          company_registration_number
            ? `<p><strong>Registration Number:</strong> ${company_registration_number}</p>`
            : ""
        }
        ${
          country_of_registration
            ? `<p><strong>Country of Registration:</strong> ${country_of_registration}</p>`
            : ""
        }
        ${
          business_address
            ? `<p><strong>Business Address:</strong> ${business_address}</p>`
            : ""
        }
        ${
          website_url
            ? `<p><strong>Website:</strong> <a href="${website_url}" style="color: #007bff; text-decoration: none;">${website_url}</a></p>`
            : ""
        }
      </div>
      
      <div class="success-box">
        <h3>Your Seller Features (Now Active)</h3>
        <ul>
          <li><strong>Product Listings:</strong> Add unlimited products to your store</li>
          <li><strong>Order Management:</strong> Process and fulfill customer orders</li>
          <li><strong>Analytics Dashboard:</strong> Track sales, revenue, and performance</li>
          <li><strong>Customer Communication:</strong> Chat directly with buyers</li>
          <li><strong>Dual Access:</strong> Continue buying as a customer while selling your products</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>Get Started Now</h3>
        <ol>
          <li><strong>Add Your First Products:</strong> Create compelling product listings</li>
          <li><strong>Start Selling:</strong> Your products are ready to go live!</li>
        </ol>
      </div>
      
      <div class="info-box">
        <h3>Seller Verification (Optional)</h3>
        <p><strong>Want a "Verified Seller" Badge?</strong> Our team will review your business documents to give you a verified seller badge. This increases buyer trust and can boost your sales.</p>
        <p><strong>Verification Status:</strong> <span class="status-badge status-pending">Pending Review</span></p>
        <p><strong>Timeline:</strong> Verification typically takes 3-5 business days</p>
        <p><strong>Benefits:</strong> Verified seller badge displayed on all your products</p>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-success">Access Seller Dashboard</a>
        
      </div>
      
      <div class="info-box">
        <h3>Commission Structure</h3>
        <p><strong>Platform Fee:</strong> We charge a competitive commission on each sale to maintain the platform and provide support.</p>
        <p><strong>Transaction Fees:</strong> Standard payment processing fees apply for secure transactions.</p>
      </div>
      
      <div class="success-box">
        <h3>Seller Success Tips</h3>
        <ul>
          <li>Use high-quality images for your products</li>
          <li>Write detailed, accurate product descriptions</li>
          <li>Respond quickly to customer inquiries</li>
          <li>Maintain competitive pricing</li>
          <li>Process orders promptly</li>
          <li>Provide excellent customer service</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>Your Account Benefits</h3>
        <ul>
          <li><strong>Buyer Privileges:</strong> Continue purchasing products as a customer</li>
          <li><strong>Seller Access:</strong> Full selling capabilities active immediately</li>
          <li><strong>Dual Dashboard:</strong> Switch between buyer and seller views</li>
        </ul>
      </div>
      
      <p>Welcome to the BEX Marketplace seller community! You're now ready to start your selling journey while continuing to enjoy shopping on our platform.</p>
      
      <p>Our support team is here to help you succeed. Don't hesitate to reach out if you need assistance.</p>
      
      <p>Here's to your success!</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending buyer to seller conversion email:", error);
    return {
      success: false,
      message: "Failed to send buyer to seller conversion email",
    };
  }
};

/**
 * Send seller verification approval email
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Email sending result
 */
const sendSellerVerificationApprovalEmail = async (userData) => {
  try {
    const {
      email,
      first_name,
      last_name,
      company_name,
      business_address,
      website_url,
    } = userData;

    const subject =
      "🏆 Verified Seller Badge Approved - Enhanced Trust & Visibility!";

    const body = `
      <h2>Congratulations, ${first_name}!</h2>
      
      <div class="success-box">
        <p><strong>Your seller verification has been approved!</strong></p>
        <p>You now have a "Verified Seller" badge that will be displayed on all your products, increasing buyer trust and potentially boosting your sales.</p>
      </div>
      
      <div class="info-box">
        <h3>Verification Status</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${
          company_name ? `<p><strong>Company:</strong> ${company_name}</p>` : ""
        }
        <p><strong>Account Type:</strong> Verified Seller</p>
        <p><strong>Badge Status:</strong> <span class="status-badge status-confirmed">✓ Verified Seller</span></p>
        <p><strong>Verification Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="success-box">
        <h3>Your Verified Seller Benefits</h3>
        <ul>
          <li><strong>Verified Badge:</strong> "✓ Verified Seller" displayed on all your products</li>
          <li><strong>Increased Trust:</strong> Buyers see you as a trusted, legitimate business</li>
          <li><strong>Better Visibility:</strong> Verified products may get priority placement</li>
          <li><strong>Higher Conversion:</strong> Verified sellers typically see increased sales</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>What's Changed</h3>
        <p><strong>Product Listings:</strong> All your current and future products will now display the "Verified Seller" badge.</p>
        <p><strong>Profile Badge:</strong> Your seller profile shows verified status to potential customers.</p>
        <p><strong>Search Priority:</strong> Your products may appear higher in search results.</p>
        <p><strong>Customer Trust:</strong> Buyers can shop with confidence knowing you're verified.</p>
      </div>
      
      <div class="button-container">
        <a href="${
          process.env.CLIENT_URL
        }/" class="button button-success">View Your Dashboard</a>
       
      </div>
      
      <div class="info-box">
        <h3>Maximizing Your Verified Status</h3>
        <ul>
          <li><strong>Promote Your Badge:</strong> Highlight your verified status in product descriptions</li>
          <li><strong>Maintain Quality:</strong> Keep high standards to preserve your verified status</li>
          <li><strong>Customer Service:</strong> Provide excellent support to maintain your reputation</li>
        </ul>
      </div>
      
      <div class="success-box">
        <h3>Verified Seller Responsibilities</h3>
        <ul>
          <li>Maintain accurate business information</li>
          <li>Provide authentic product descriptions</li>
          <li>Respond promptly to customer inquiries</li>
          <li>Comply with all marketplace policies</li>
          <li>Maintain professional communication standards</li>
        </ul>
      </div>
      
      
      
      <div class="warning-box">
        <h3>Important Reminders</h3>
        <p><strong>Verified Status:</strong> This badge represents trust and quality - maintain high standards.</p>
        <p><strong>Professional Conduct:</strong> Represent the verified seller community with professionalism.</p>
      </div>
      
      <p>Congratulations on achieving verified seller status! This badge represents our confidence in your business and commitment to quality.</p>
      
      <p>Your verified status will help you stand out in the marketplace and build stronger relationships with customers.</p>
      
      <p>Thank you for being a valued part of the BEX Marketplace community!</p>
      
      <p>Best regards,<br>The BEX Marketplace Team</p>
    `;

    const fullEmailBody = emailHeader + body + emailFooter;
    return await sendEmail(email, fullEmailBody, subject);
  } catch (error) {
    console.error("Error sending seller verification approval email:", error);
    return {
      success: false,
      message: "Failed to send seller verification approval email",
    };
  }
};

module.exports = {
  sendOrderConfirmationEmail,
  sendOrderRejectionEmail,
  sendBuyerRegistrationEmail,
  sendSellerRegistrationEmail,
  sendAccountSuspensionEmail,
  sendAccountUnsuspensionEmail,
  sendOrderPlacementEmail,
  sendPaymentSuccessfulEmail,
  sendBuyerToSellerConversionEmail,
  sendSellerVerificationApprovalEmail,
};
