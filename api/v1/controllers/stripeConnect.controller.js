require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const StripeAccount = require("../../../models/stripe.model");
const Payout = require("../../../models/stripePayout.model");
const { User, OrderItem, Order, Product } = require("../../../models");
const { sequelize } = require("../../../config/db");
const Commission = require("../../../models/commission.model");

// Check if user has existing Stripe account
exports.checkAccount = async (req, res) => {
  try {
    const userId = req.user.userId; // Fixed: Use consistent userId property

    const stripeAccount = await StripeAccount.findOne({
      where: { user_id: userId },
    });

    if (!stripeAccount) {
      return res.status(200).json({
        success: true,
        hasAccount: false,
        message: "No Stripe account found",
      });
    }

    res.status(200).json({
      success: true,
      hasAccount: true,
      accountId: stripeAccount.stripe_account_id,
      status: stripeAccount.status,
      onboardingCompleted: stripeAccount.onboarding_completed,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
    });
  } catch (error) {
    console.error("Check account error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Create Express Account
exports.createExpressAccount = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { type = "express", country = "US" } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Check if user already has a connected account
    const existingAccount = await StripeAccount.findOne({
      where: { user_id: userId },
      transaction: t,
    });

    if (existingAccount) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: "User already has a connected account",
        accountId: existingAccount.stripe_account_id,
      });
    }

    // Create Express account in Stripe
    const account = await stripe.accounts.create({
      type: type,
      country: country,
      email: userEmail,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
    });

    // Save account to database
    const stripeAccount = await StripeAccount.create(
      {
        id: uuidv4(),
        user_id: userId,
        stripe_account_id: account.id,
        account_type: type,
        country: country,
        email: userEmail,
        capabilities: account.capabilities,
        requirements: account.requirements,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        status: account.details_submitted ? "complete" : "pending",
      },
      { transaction: t }
    );

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/seller/onboarding?refresh=true`,
      return_url: `${process.env.CLIENT_URL}/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    await t.commit();

    res.status(201).json({
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
      message: "Express account created successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Create Express account error:", error);

    // Better error handling for Connect-specific errors
    if (error.code === "account_invalid") {
      return res.status(400).json({
        success: false,
        error:
          "Connect is not enabled on this account. Please enable Connect in your Stripe dashboard.",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Create onboarding link for existing account
exports.createOnboardingLink = async (req, res) => {
  try {
    const { accountId } = req.body;
    const userId = req.user.userId; // Fixed: Use consistent userId property

    // Verify account belongs to user
    const stripeAccount = await StripeAccount.findOne({
      where: {
        user_id: userId,
        stripe_account_id: accountId,
      },
    });

    if (!stripeAccount) {
      return res.status(404).json({
        success: false,
        error: "Account not found or doesn't belong to user",
      });
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.CLIENT_URL}/seller/onboarding?refresh=true`,
      return_url: `${process.env.CLIENT_URL}/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    res.status(200).json({
      success: true,
      url: accountLink.url,
      message: "Onboarding link created successfully",
    });
  } catch (error) {
    console.error("Create onboarding link error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get account status
exports.getAccountStatus = async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.userId; // Fixed: Use consistent userId property

    // Verify account belongs to user
    const stripeAccount = await StripeAccount.findOne({
      where: {
        user_id: userId,
        stripe_account_id: accountId,
      },
    });

    if (!stripeAccount) {
      return res.status(404).json({
        success: false,
        error: "Account not found or doesn't belong to user",
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);

    // Update local database
    await stripeAccount.update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      capabilities: account.capabilities,
      requirements: account.requirements,
      status:
        account.details_submitted && account.charges_enabled
          ? "complete"
          : "pending",
      last_sync_at: new Date(),
    });

    res.status(200).json({
      success: true,
      status: stripeAccount.status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      capabilities: account.capabilities,
    });
  } catch (error) {
    console.error("Get account status error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Admin: Create payout to seller

exports.createPayout = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { orderItemId } = req.body;
    const adminUserId = req.user.userId;

    // Validate required fields
    if (!orderItemId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: "orderItemId is required",
      });
    }

    // Fetch the order item with product details
    const orderItem = await OrderItem.findByPk(orderItemId, {
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["user_id", "category"],
          required: true,
        },
      ],
      transaction: t,
    });

    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: "Order item not found",
      });
    }

    // Check if already paid
    if (orderItem.seller_paid === true) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: "This order item has already been paid out",
      });
    }

    const sellerId = orderItem.product.user_id;
    const productCategory = orderItem.product.category;

    // Get commission rate for this product category
    const commission = await Commission.findOne({
      where: { category: productCategory },
      transaction: t,
    });

    if (!commission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: `Commission rate not found for category: ${productCategory}`,
      });
    }

    // Get seller's Stripe account
    const stripeAccount = await StripeAccount.findOne({
      where: { user_id: sellerId },
      transaction: t,
    });

    if (!stripeAccount) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: "Seller doesn't have a connected Stripe account",
      });
    }

    if (!stripeAccount.payouts_enabled) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: "Seller's account is not enabled for payouts",
      });
    }

    // Calculate amounts
    const itemTotal =
      parseFloat(orderItem.price) * parseInt(orderItem.quantity);
    const commissionRate = parseFloat(commission.commission_rate);
    const platformCommission = (itemTotal * commissionRate) / 100;

    // Calculate gross payout (after platform commission but before Stripe fees)
    const grossPayout = itemTotal - platformCommission;

    // Stripe transfer fees for Express accounts:
    // - 0.25% of payout volume + $0.25 per payout
    const stripePercentageFee = grossPayout * 0.0025; // 0.25%
    const stripeFixedFee = 0.25; // $0.25 per payout
    const totalStripeFee = stripePercentageFee + stripeFixedFee;

    // Calculate final payout amount (what seller actually receives)
    const sellerPayout = grossPayout - totalStripeFee;

    // Generate description for payout
    const payoutDescription = `Payout by Bex Marketplace for order item: ${
      orderItem.title
    }, quantity: ${orderItem.quantity}, total: ${itemTotal.toFixed(
      2
    )}, commission: ${platformCommission.toFixed(
      2
    )}, Stripe fees: ${totalStripeFee.toFixed(2)}`;

    if (sellerPayout <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: "Calculated payout amount is zero or negative",
        calculation: {
          itemTotal,
          commissionRate: `${commissionRate}%`,
          platformCommission,
          grossPayout,
          stripePercentageFee,
          stripeFixedFee,
          totalStripeFee,
          sellerPayout,
        },
      });
    }

    // Create transfer in Stripe (amount in cents)
    const transfer = await stripe.transfers.create({
      amount: Math.round(sellerPayout * 100),
      currency: "usd",
      destination: stripeAccount.stripe_account_id,
      description: payoutDescription,
      metadata: {
        seller_id: sellerId,
        admin_id: adminUserId,
        order_item_id: orderItemId,
        product_title: orderItem.title,
        product_category: productCategory,
        commission_rate: `${commissionRate}%`,
      },
    });

    // Create payout record
    const payout = await Payout.create(
      {
        id: uuidv4(),
        seller_id: sellerId,
        stripe_account_id: stripeAccount.stripe_account_id,
        stripe_transfer_id: transfer.id,
        amount: sellerPayout, // What seller actually receives
        status: "paid",
        description: payoutDescription,
        metadata: {
          order_item_id: orderItemId,
          product_title: orderItem.title,
          transfer_details: transfer,
          calculation: {
            itemTotal,
            commissionRate: `${commissionRate}%`,
            platformCommission,
            grossPayout,
            stripePercentageFee,
            stripeFixedFee,
            totalStripeFee,
            sellerPayout,
          },
        },
        initiated_by: adminUserId,
        order_items: [orderItemId],
        fee_amount: totalStripeFee, // Total Stripe fees (0.25% + $0.25)
        net_amount: sellerPayout, // Amount seller receives (after all deductions)
        processed_at: new Date(),
      },
      { transaction: t }
    );

    // Mark order item as paid
    await OrderItem.update(
      {
        seller_paid: true,
      },
      {
        where: { id: orderItemId },
        transaction: t,
      }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      payout: {
        id: payout.id,
        stripeTransferId: transfer.id,
        orderItemId: orderItemId,
        productTitle: orderItem.title,
        productCategory: productCategory,
        commissionRate: `${commissionRate}%`,
      },
      calculation: {
        itemTotal,
        platformCommission,
        grossPayout,
        stripePercentageFee: `${stripePercentageFee.toFixed(2)} (0.25%)`,
        stripeFixedFee: `${stripeFixedFee.toFixed(2)}`,
        totalStripeFee,
        sellerPayout, // Final amount seller receives
        commissionRate: `${commissionRate}%`,
      },
      message: "Payout created successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Create payout error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Get seller's payouts
exports.getSellerPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.userId; // Fixed: Use consistent userId property
    const offset = (page - 1) * limit;

    const { count, rows: payouts } = await Payout.findAndCountAll({
      where: { seller_id: userId },
      include: [
        {
          model: User,
          as: "initiatedBy", // You'll need to set up this association
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        payouts: payouts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get seller payouts error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Create a login link for the seller
exports.createSellerDashboardLink = async (req, res) => {
  try {
    const userId = req.user.userId; // Fixed: Use consistent userId property

    // Get seller's Stripe account
    const stripeAccount = await StripeAccount.findOne({
      where: { user_id: userId },
    });

    if (!stripeAccount) {
      return res.status(404).json({
        success: false,
        error: "Seller doesn't have a connected Stripe account",
      });
    }

    // Create login link
    const loginLink = await stripe.accounts.createLoginLink(
      stripeAccount.stripe_account_id
    );

    res.json({
      success: true,
      loginUrl: loginLink.url,
    });
  } catch (error) {
    console.error("Create login link error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Admin: Get all payouts
exports.getAllPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, sellerId, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (sellerId) whereClause.seller_id = sellerId;
    if (status) whereClause.status = status;

    const { count, rows: payouts } = await Payout.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "seller", // ✅ This matches the association
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: User,
          as: "initiator", // ✅ Changed from "initiatedBy" to "initiator"
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        payouts: payouts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all payouts error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Test endpoint to verify Connect is enabled
exports.testConnect = async (req, res) => {
  try {
    // Try to create a test account to see if Connect is enabled
    const testAccount = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: "test@example.com",
    });

    // If successful, delete the test account
    await stripe.accounts.del(testAccount.id);

    res.status(200).json({
      success: true,
      message: "Stripe Connect is properly configured and enabled",
    });
  } catch (error) {
    console.error("Connect test error:", error);
    res.status(500).json({
      success: false,
      error: "Stripe Connect is not enabled on this account",
      details: error.message,
    });
  }
};
