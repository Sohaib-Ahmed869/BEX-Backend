const { Order, OrderItem, Product, User } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");

/**
 * Get comprehensive admin dashboard statistics
 */
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate, period = "monthly" } = req.query;

    // Set default date range to current month
    const now = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all users to calculate total buyers and sellers (irrespective of orders)
    const allUsers = await User.findAll({
      attributes: [
        "id",
        "role",
        "first_name",
        "last_name",
        "company_name",
        "email",
      ],
    });

    // Separate buyers and sellers from all users
    const allBuyers = allUsers.filter((user) => user.role === "buyer");
    const allSellers = allUsers.filter((user) => user.role === "seller");

    // Get unique companies from all sellers
    const allCompanies = new Set();
    allSellers.forEach((seller) => {
      const companyName =
        seller.company_name ||
        `${seller.first_name} ${seller.last_name}`.trim();
      if (companyName) {
        allCompanies.add(companyName);
      }
    });

    // Get all orders within date range with complete associations
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              include: [
                {
                  model: User,
                  as: "seller",
                  attributes: [
                    "id",
                    "first_name",
                    "last_name",
                    "company_name",
                    "email",
                    "role",
                  ],
                },
              ],
              attributes: ["id", "title", "user_id", "price", "category"],
            },
          ],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email", "role"],
        },
      ],
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
      },
      order: [["order_date", "DESC"]],
    });

    // Calculate main statistics (only for APPROVED orders for volume/revenue calculations)
    const totalOrders = orders.length; // This is for ordersPerMonth - all orders count
    let totalVolume = 0;
    let totalCommissionEarned = 0;
    let totalRefunds = 0;
    let completedPayments = 0;
    let cancelledPayments = 0;
    let processingPayments = 0;
    let approvedOrdersCount = 0; // Only for average order value calculation

    // Track company performance and active users from orders
    const companyStats = {};
    const sellerStats = {};
    const activeBuyers = new Set(); // Buyers who made orders in date range
    const activeSellers = new Set(); // Sellers who had sales in date range

    // Process all orders
    orders.forEach((order) => {
      // Track active buyers from orders
      if (order.buyer && order.buyer.role === "buyer") {
        activeBuyers.add(order.buyer.id);
      }

      // Count payment statuses
      if (order.payment_completed) {
        completedPayments++;
      } else {
        processingPayments++;
      }

      // Process order items - only include APPROVED items for calculations
      const approvedItems = order.items.filter(
        (item) => item.order_status === "approved"
      );

      if (approvedItems.length > 0) {
        approvedOrdersCount++;

        const orderTotal = parseFloat(order.total_amount);
        const platformFee = parseFloat(order.platform_fee || 0);

        // Only add to totals if order has approved items
        totalVolume += orderTotal;
        totalCommissionEarned += platformFee;
      }

      order.items.forEach((item) => {
        // Handle refunds/cancellations for all items
        if (
          item.order_status === "refunded" ||
          item.order_status === "cancelled" ||
          item.order_status === "rejected"
        ) {
          const refundAmount =
            parseFloat(item.price) * item.quantity +
            parseFloat(item.retip_price || 0);
          totalRefunds += refundAmount;
          if (item.order_status === "cancelled") {
            cancelledPayments++;
          }
        }

        // Only process APPROVED items for company stats
        if (
          item.order_status === "approved" &&
          item.product &&
          item.product.seller
        ) {
          const seller = item.product.seller;

          // Verify seller role
          if (seller.role === "seller") {
            const sellerId = seller.id;
            const companyName =
              seller.company_name ||
              `${seller.first_name} ${seller.last_name}`.trim();

            // Create unique company key that includes seller ID to handle multiple sellers per company
            const companyKey = `${companyName}_${sellerId}`;

            // Calculate item total (price * quantity + retip_price if applicable)
            const itemTotal =
              parseFloat(item.price) * item.quantity +
              parseFloat(item.retip_price || 0);

            // Track active sellers
            activeSellers.add(sellerId);

            // Initialize company stats
            if (!companyStats[companyKey]) {
              companyStats[companyKey] = {
                companyName,
                sellerId,
                sellerName: `${seller.first_name} ${seller.last_name}`.trim(),
                sellerEmail: seller.email,
                totalOrders: new Set(),
                totalRevenue: 0,
                totalItems: 0,
                orderIds: new Set(),
              };
            }

            // Update company stats
            companyStats[companyKey].orderIds.add(order.id);
            companyStats[companyKey].totalRevenue += itemTotal;
            companyStats[companyKey].totalItems += item.quantity;

            // Track seller stats
            if (!sellerStats[sellerId]) {
              sellerStats[sellerId] = {
                sellerId,
                companyName,
                totalRevenue: 0,
                orderCount: new Set(),
              };
            }
            sellerStats[sellerId].totalRevenue += itemTotal;
            sellerStats[sellerId].orderCount.add(order.id);
          }
        }
      });
    });

    // Convert company stats to array and calculate final metrics
    const topPerformingCompanies = Object.values(companyStats)
      .map((company) => ({
        companyName: company.companyName,
        sellerId: company.sellerId,
        sellerName: company.sellerName,
        sellerEmail: company.sellerEmail,
        totalOrders: company.orderIds.size,
        totalRevenue: Math.round(company.totalRevenue * 100) / 100,
        totalItems: company.totalItems,
        averageOrderValue:
          company.orderIds.size > 0
            ? Math.round((company.totalRevenue / company.orderIds.size) * 100) /
              100
            : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Calculate average order value (based on approved orders only)
    const averageOrderValue =
      approvedOrdersCount > 0 ? totalVolume / approvedOrdersCount : 0;

    // Get recent orders for display
    const recentOrders = orders.slice(0, 10).map((order) => ({
      id: order.id,
      orderDate: order.order_date,
      buyerName: order.buyer
        ? `${order.buyer.first_name} ${order.buyer.last_name}`.trim()
        : "Unknown",
      buyerEmail: order.buyer ? order.buyer.email : "",
      totalAmount: parseFloat(order.total_amount),
      platformFee: parseFloat(order.platform_fee || 0),
      paymentStatus: order.payment_completed ? "Completed" : "Processing",
      itemCount: order.items.length,
      approvedItemCount: order.items.filter(
        (item) => item.order_status === "approved"
      ).length,
      items: order.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        status: item.order_status,
        price: parseFloat(item.price),
        company:
          item.product?.seller?.company_name ||
          `${item.product?.seller?.first_name || ""} ${
            item.product?.seller?.last_name || ""
          }`.trim() ||
          "Unknown",
      })),
    }));

    // Generate analytics data for charts (only approved orders)
    const analyticsData = await generateAnalyticsData(
      orders,
      defaultStartDate,
      defaultEndDate,
      period
    );

    // Calculate commission percentage
    const commissionPercentage =
      totalVolume > 0 ? (totalCommissionEarned / totalVolume) * 100 : 0;

    // Calculate growth metrics (comparing with previous period) - using all orders for growth
    const previousPeriodStart = new Date(defaultStartDate);
    const previousPeriodEnd = new Date(defaultEndDate);
    const periodDiff = defaultEndDate.getTime() - defaultStartDate.getTime();
    previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDiff);
    previousPeriodEnd.setTime(previousPeriodEnd.getTime() - periodDiff);

    const previousOrders = await Order.count({
      where: {
        order_date: {
          [Op.between]: [previousPeriodStart, previousPeriodEnd],
        },
      },
    });

    const orderGrowth =
      previousOrders > 0
        ? ((totalOrders - previousOrders) / previousOrders) * 100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        // Main overview stats
        overview: {
          totalVolume: Math.round(totalVolume * 100) / 100,
          ordersPerMonth: totalOrders, // Now counts ALL orders regardless of item status
          commissionEarned: Math.round(totalCommissionEarned * 100) / 100,
          totalRevenue: Math.round(totalVolume * 100) / 100,
          revenueGrowth: Math.round(orderGrowth * 100) / 100,
          totalCompanies: allCompanies.size, // All companies from users table
          totalBuyers: allBuyers.length, // All buyers from users table
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          commissionPercentage: Math.round(commissionPercentage * 100) / 100,
        },

        // Payment statistics
        paymentSummary: {
          completed: completedPayments,
          processing: processingPayments,
          cancelled: cancelledPayments,
          totalAmount: Math.round(totalVolume * 100) / 100,
        },

        // Top performing companies (based on approved sales only)
        topPerformingCompanies,

        // Recent orders
        recentOrders,

        // Analytics data for charts
        analyticsData,

        // User statistics - separated into total and active users
        userStats: {
          totalUsers: allUsers.length, // All users from users table
          totalSellers: allSellers.length, // All sellers from users table
          totalBuyers: allBuyers.length, // All buyers from users table
          totalCompanies: allCompanies.size, // All unique companies
          activeBuyers: activeBuyers.size, // Buyers with orders in date range
          activeSellers: activeSellers.size, // Sellers with sales in date range
        },

        // Date range used
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
      },
    });
  } catch (error) {
    console.error("Admin dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin dashboard statistics",
      error: error.message,
    });
  }
};

/**
 * Get detailed payment analytics
 */
exports.getPaymentAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const now = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get detailed payment information for ALL orders regardless of status
    const payments = await Order.findAll({
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
      },
      attributes: [
        "id",
        "total_amount",
        "platform_fee",
        "shipping_cost",
        "payment_completed",
        "order_date",
        [sequelize.fn("DATE", sequelize.col("order_date")), "date"],
      ],
      order: [["order_date", "DESC"]],
    });

    // Group by date for daily analytics
    const dailyPayments = {};
    let totalCompleted = 0;
    let totalProcessing = 0;
    let totalAmount = 0;
    let totalFees = 0;

    payments.forEach((payment) => {
      const date = payment.dataValues.date;
      const amount = parseFloat(payment.total_amount);
      const fee = parseFloat(payment.platform_fee || 0);

      if (!dailyPayments[date]) {
        dailyPayments[date] = {
          date,
          completed: 0,
          processing: 0,
          amount: 0,
          fees: 0,
        };
      }

      dailyPayments[date].amount += amount;
      dailyPayments[date].fees += fee;

      if (payment.payment_completed) {
        dailyPayments[date].completed += 1;
        totalCompleted += 1;
      } else {
        dailyPayments[date].processing += 1;
        totalProcessing += 1;
      }

      totalAmount += amount;
      totalFees += fee;
    });

    const paymentAnalytics = Object.values(dailyPayments)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((day) => ({
        ...day,
        amount: Math.round(day.amount * 100) / 100,
        fees: Math.round(day.fees * 100) / 100,
      }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalPayments: payments.length,
          totalCompleted,
          totalProcessing,
          totalAmount: Math.round(totalAmount * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
        },
        dailyAnalytics: paymentAnalytics,
        payments: payments.slice(0, 20).map((p) => ({
          id: p.id,
          amount: parseFloat(p.total_amount),
          date: p.order_date,
          status: p.payment_completed ? "Completed" : "Processing",
          description: "Credit card",
        })),
      },
    });
  } catch (error) {
    console.error("Payment analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment analytics",
      error: error.message,
    });
  }
};

/**
 * Get detailed company performance analytics
 */
exports.getCompanyPerformance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const now = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all orders with seller information - only approved items for performance calculation
    const ordersWithSellers = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              include: [
                {
                  model: User,
                  as: "seller",
                  where: {
                    role: "seller", // Ensure user is a seller
                  },
                  attributes: [
                    "id",
                    "first_name",
                    "last_name",
                    "company_name",
                    "email",
                    "role",
                  ],
                },
              ],
            },
          ],
        },
      ],
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
      },
    });

    const companyPerformance = {};

    ordersWithSellers.forEach((order) => {
      order.items.forEach((item) => {
        // Only include approved items for performance calculation
        if (
          item.order_status === "approved" &&
          item.product &&
          item.product.seller &&
          item.product.seller.role === "seller"
        ) {
          const seller = item.product.seller;
          const companyName =
            seller.company_name ||
            `${seller.first_name} ${seller.last_name}`.trim();

          // Create unique key for each seller-company combination
          const companyKey = `${companyName}_${seller.id}`;

          const itemTotal =
            parseFloat(item.price) * item.quantity +
            parseFloat(item.retip_price || 0);

          if (!companyPerformance[companyKey]) {
            companyPerformance[companyKey] = {
              sellerId: seller.id,
              companyName: companyName,
              sellerEmail: seller.email,
              sellerName: `${seller.first_name} ${seller.last_name}`.trim(),
              totalOrders: new Set(),
              totalRevenue: 0,
              totalItems: 0,
              averageOrderValue: 0,
            };
          }

          companyPerformance[companyKey].totalOrders.add(order.id);
          companyPerformance[companyKey].totalRevenue += itemTotal;
          companyPerformance[companyKey].totalItems += item.quantity;
        }
      });
    });

    // Convert to array and calculate final metrics
    const performanceArray = Object.values(companyPerformance)
      .map((company) => ({
        sellerId: company.sellerId,
        companyName: company.companyName,
        sellerName: company.sellerName,
        sellerEmail: company.sellerEmail,
        totalOrders: company.totalOrders.size,
        totalRevenue: Math.round(company.totalRevenue * 100) / 100,
        totalItems: company.totalItems,
        averageOrderValue:
          company.totalOrders.size > 0
            ? Math.round(
                (company.totalRevenue / company.totalOrders.size) * 100
              ) / 100
            : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        companies: performanceArray,
        totalCompanies: Object.keys(companyPerformance).length,
      },
    });
  } catch (error) {
    console.error("Company performance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching company performance",
      error: error.message,
    });
  }
};

/**
 * Helper function to generate analytics data based on period (only approved orders)
 */
async function generateAnalyticsData(orders, startDate, endDate, period) {
  try {
    // Group data by period (daily, weekly, monthly) - only for orders with approved items
    const groupedData = {};

    orders.forEach((order) => {
      // Check if order has any approved items
      const hasApprovedItems = order.items.some(
        (item) => item.order_status === "approved"
      );
      if (!hasApprovedItems) return;

      let key;
      const orderDate = new Date(order.order_date);

      switch (period) {
        case "daily":
          key = orderDate.toISOString().split("T")[0];
          break;
        case "weekly":
          const weekStart = new Date(orderDate);
          weekStart.setDate(orderDate.getDate() - orderDate.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "monthly":
          key = `${orderDate.getFullYear()}-${String(
            orderDate.getMonth() + 1
          ).padStart(2, "0")}`;
          break;
        default:
          key = orderDate.toISOString().split("T")[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          period: key,
          revenue: 0,
          orders: 0,
          commission: 0,
        };
      }

      groupedData[key].revenue += parseFloat(order.total_amount);
      groupedData[key].commission += parseFloat(order.platform_fee || 0);
      groupedData[key].orders += 1;
    });

    // Convert to arrays and sort by period
    const sortedData = Object.values(groupedData)
      .sort((a, b) => new Date(a.period) - new Date(b.period))
      .map((item) => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
        commission: Math.round(item.commission * 100) / 100,
      }));

    return {
      revenueData: sortedData.map((d) => ({
        period: d.period,
        value: d.revenue,
      })),
      orderData: sortedData.map((d) => ({ period: d.period, value: d.orders })),
      commissionData: sortedData.map((d) => ({
        period: d.period,
        value: d.commission,
      })),
      weeklyData: generateWeeklyData(orders),
    };
  } catch (error) {
    console.error("Error generating analytics data:", error);
    return {
      revenueData: [],
      orderData: [],
      commissionData: [],
      weeklyData: [],
    };
  }
}

/**
 * Generate weekly data for sales summary chart (only approved orders)
 */
function generateWeeklyData(orders) {
  const weeklyData = {};
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  // Initialize weekly data
  days.forEach((day, index) => {
    weeklyData[index] = { day, revenue: 0, commission: 0 };
  });

  orders.forEach((order) => {
    // Only include orders with approved items
    const hasApprovedItems = order.items.some(
      (item) => item.order_status === "approved"
    );
    if (!hasApprovedItems) return;

    const dayOfWeek = new Date(order.order_date).getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6

    weeklyData[adjustedDay].revenue += parseFloat(order.total_amount);
    weeklyData[adjustedDay].commission += parseFloat(order.platform_fee || 0);
  });

  return Object.values(weeklyData).map((item) => ({
    ...item,
    revenue: Math.round(item.revenue * 100) / 100,
    commission: Math.round(item.commission * 100) / 100,
  }));
}
