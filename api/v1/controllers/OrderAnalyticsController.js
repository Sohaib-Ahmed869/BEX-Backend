const { Order, OrderItem, Product, User } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");

/**
 * Get order analytics for admin with all orders and average order value for specified period
 */
exports.getAdminOrderAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = "weekly" } = req.query;

    // Set default date range based on period
    const now = new Date();
    let defaultStartDate, defaultEndDate;

    switch (period) {
      case "weekly":
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        defaultStartDate = startDate
          ? new Date(startDate)
          : new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - daysFromMonday
            );
        defaultEndDate = endDate
          ? new Date(endDate)
          : new Date(defaultStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
        break;

      case "monthly":
        defaultStartDate = startDate
          ? new Date(startDate)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        defaultEndDate = endDate
          ? new Date(endDate)
          : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;

      case "annually":
        defaultStartDate = startDate
          ? new Date(startDate)
          : new Date(now.getFullYear(), 0, 1);
        defaultEndDate = endDate
          ? new Date(endDate)
          : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;

      default:
        defaultStartDate = startDate
          ? new Date(startDate)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        defaultEndDate = endDate
          ? new Date(endDate)
          : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get all orders within date range with their approved items only
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          required: true, // Only include orders that have items
          where: {
            order_status: "approved", // Only approved order items
          },
          include: [
            {
              model: Product,
              as: "product",
              required: true, // Only include items that have products
              attributes: ["id", "title", "price", "category", "user_id"],
              include: [
                {
                  model: User,
                  as: "seller", // Assuming you have this association
                  attributes: ["id", "first_name", "last_name", "company_name"],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
        payment_completed: true, // Only include paid orders
      },
      order: [["order_date", "ASC"]],
    });

    // Calculate totals from approved items only
    const ordersWithApprovedItems = orders
      .map((order) => {
        // Filter items to only include approved items
        const approvedItems = order.items.filter(
          (item) => item.order_status === "approved" && item.product
        );

        // Calculate total amount for approved items only
        const approvedTotalAmount = approvedItems.reduce((sum, item) => {
          // Calculate line total as price * quantity + retip_price
          const lineTotal =
            parseFloat(item.price) * item.quantity +
            parseFloat(item.retip_price || 0);
          return sum + lineTotal;
        }, 0);

        return {
          ...order.toJSON(),
          items: approvedItems,
          approved_total_amount: approvedTotalAmount,
          original_total_amount: order.total_amount,
        };
      })
      .filter((order) => order.items.length > 0); // Only keep orders with approved items

    // Generate analytics data based on period
    const analyticsData = generateOrderAnalytics(
      ordersWithApprovedItems,
      defaultStartDate,
      defaultEndDate,
      period
    );

    // Calculate overall statistics
    const totalOrders = ordersWithApprovedItems.length;
    const totalRevenue = ordersWithApprovedItems.reduce(
      (sum, order) => sum + parseFloat(order.approved_total_amount),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate additional metrics
    const totalItemsSold = ordersWithApprovedItems.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    const uniqueProducts = new Set(
      ordersWithApprovedItems.flatMap((order) =>
        order.items.map((item) => item.product.id)
      )
    ).size;

    const uniqueBuyers = new Set(
      ordersWithApprovedItems.map((order) => order.buyer.id)
    ).size;

    const uniqueSellers = new Set(
      ordersWithApprovedItems.flatMap((order) =>
        order.items.map((item) => item.product.user_id)
      )
    ).size;

    // Calculate period-specific metrics
    const periodMetrics = calculatePeriodMetrics(
      ordersWithApprovedItems,
      period
    );

    // Get top selling products
    const topProducts = getTopSellingProducts(ordersWithApprovedItems);

    // Get top sellers
    const topSellers = getTopSellers(ordersWithApprovedItems);

    // Get category breakdown
    const categoryBreakdown = getCategoryBreakdown(ordersWithApprovedItems);

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        overview: {
          totalOrders,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          totalItemsSold,
          uniqueProducts,
          uniqueBuyers,
          uniqueSellers,
        },
        analyticsData: {
          orderData: analyticsData.orderData,
          revenueData: analyticsData.revenueData,
          avgOrderValueData: analyticsData.avgOrderValueData,
        },
        periodMetrics,
        topProducts,
        topSellers,
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error("Admin order analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin order analytics",
      error: error.message,
    });
  }
};

/**
 * Generate analytics data based on period for all orders
 */
function generateOrderAnalytics(orders, startDate, endDate, period) {
  const orderData = [];
  const revenueData = [];
  const avgOrderValueData = [];

  // Generate time periods based on selection
  const periods = generateTimePeriods(startDate, endDate, period);

  periods.forEach((periodInfo) => {
    // Filter orders for this specific period
    const periodOrders = orders.filter((order) => {
      const orderDate = new Date(order.order_date);
      return orderDate >= periodInfo.start && orderDate <= periodInfo.end;
    });

    const orderCount = periodOrders.length;
    const revenue = periodOrders.reduce(
      (sum, order) => sum + parseFloat(order.approved_total_amount),
      0
    );
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

    orderData.push({
      period: periodInfo.label,
      value: orderCount,
      date: periodInfo.start,
    });

    revenueData.push({
      period: periodInfo.label,
      value: Math.round(revenue * 100) / 100,
      date: periodInfo.start,
    });

    avgOrderValueData.push({
      period: periodInfo.label,
      value: Math.round(avgOrderValue * 100) / 100,
      date: periodInfo.start,
    });
  });

  return {
    orderData,
    revenueData,
    avgOrderValueData,
  };
}

/**
 * Get top selling products across all sellers
 */
function getTopSellingProducts(orders) {
  const productStats = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const productId = item.product.id;
      if (!productStats[productId]) {
        productStats[productId] = {
          id: productId,
          title: item.product.title,
          category: item.product.category,
          seller: item.product.seller
            ? {
                id: item.product.seller.id,
                name: `${item.product.seller.first_name} ${item.product.seller.last_name}`,
                company_name: item.product.seller.company_name,
              }
            : null,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0,
        };
      }

      productStats[productId].totalQuantity += item.quantity;
      // Calculate line total properly
      const lineTotal =
        parseFloat(item.price) * item.quantity +
        parseFloat(item.retip_price || 0);
      productStats[productId].totalRevenue += lineTotal;
      productStats[productId].orderCount += 1;
    });
  });

  // Convert to array and sort by total revenue
  return Object.values(productStats)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10) // Top 10 products
    .map((product) => ({
      ...product,
      totalRevenue: Math.round(product.totalRevenue * 100) / 100,
    }));
}

/**
 * Get top sellers by revenue
 */
function getTopSellers(orders) {
  const sellerStats = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const sellerId = item.product.user_id;
      if (!sellerStats[sellerId]) {
        sellerStats[sellerId] = {
          id: sellerId,
          name: item.product.seller
            ? `${item.product.seller.first_name} ${item.product.seller.last_name}`
            : "Unknown Seller",
          company_name: item.product.seller?.company_name || null,
          totalRevenue: 0,
          totalOrders: 0,
          totalItemsSold: 0,
        };
      }

      // Calculate line total properly
      const lineTotal =
        parseFloat(item.price) * item.quantity +
        parseFloat(item.retip_price || 0);

      sellerStats[sellerId].totalRevenue += lineTotal;
      sellerStats[sellerId].totalItemsSold += item.quantity;
    });
  });

  // Count unique orders per seller
  orders.forEach((order) => {
    const sellersInOrder = new Set();
    order.items.forEach((item) => {
      sellersInOrder.add(item.product.user_id);
    });

    sellersInOrder.forEach((sellerId) => {
      if (sellerStats[sellerId]) {
        sellerStats[sellerId].totalOrders += 1;
      }
    });
  });

  // Convert to array and sort by total revenue
  return Object.values(sellerStats)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10) // Top 10 sellers
    .map((seller) => ({
      ...seller,
      totalRevenue: Math.round(seller.totalRevenue * 100) / 100,
      averageOrderValue:
        seller.totalOrders > 0
          ? Math.round((seller.totalRevenue / seller.totalOrders) * 100) / 100
          : 0,
    }));
}

/**
 * Get category breakdown
 */
function getCategoryBreakdown(orders) {
  const categoryStats = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const category = item.product.category || "Uncategorized";
      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          totalRevenue: 0,
          totalQuantity: 0,
          orderCount: 0,
        };
      }

      // Calculate line total properly
      const lineTotal =
        parseFloat(item.price) * item.quantity +
        parseFloat(item.retip_price || 0);

      categoryStats[category].totalRevenue += lineTotal;
      categoryStats[category].totalQuantity += item.quantity;
      categoryStats[category].orderCount += 1;
    });
  });

  // Convert to array and sort by total revenue
  return Object.values(categoryStats)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((category) => ({
      ...category,
      totalRevenue: Math.round(category.totalRevenue * 100) / 100,
    }));
}

/**
 * Calculate period-specific metrics for comparison
 */
function calculatePeriodMetrics(orders, period) {
  const metrics = {
    currentPeriod: {
      orders: 0,
      revenue: 0,
      avgOrderValue: 0,
    },
    previousPeriod: {
      orders: 0,
      revenue: 0,
      avgOrderValue: 0,
    },
    growth: {
      orders: 0,
      revenue: 0,
      avgOrderValue: 0,
    },
  };

  if (orders.length === 0) return metrics;

  // Sort orders by date
  const sortedOrders = orders.sort(
    (a, b) => new Date(a.order_date) - new Date(b.order_date)
  );

  // Split orders into two halves for comparison
  const midPoint = Math.floor(sortedOrders.length / 2);
  const firstHalf = sortedOrders.slice(0, midPoint);
  const secondHalf = sortedOrders.slice(midPoint);

  // Calculate metrics for each half
  const calculateHalfMetrics = (orderHalf) => {
    const orders = orderHalf.length;
    const revenue = orderHalf.reduce(
      (sum, order) => sum + parseFloat(order.approved_total_amount),
      0
    );
    const avgOrderValue = orders > 0 ? revenue / orders : 0;
    return { orders, revenue, avgOrderValue };
  };

  metrics.previousPeriod = calculateHalfMetrics(firstHalf);
  metrics.currentPeriod = calculateHalfMetrics(secondHalf);

  // Calculate growth percentages
  const calculateGrowth = (current, previous) => {
    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  };

  metrics.growth = {
    orders: calculateGrowth(
      metrics.currentPeriod.orders,
      metrics.previousPeriod.orders
    ),
    revenue: calculateGrowth(
      metrics.currentPeriod.revenue,
      metrics.previousPeriod.revenue
    ),
    avgOrderValue: calculateGrowth(
      metrics.currentPeriod.avgOrderValue,
      metrics.previousPeriod.avgOrderValue
    ),
  };

  // Round all values
  Object.keys(metrics).forEach((key) => {
    if (typeof metrics[key] === "object") {
      Object.keys(metrics[key]).forEach((subKey) => {
        metrics[key][subKey] = Math.round(metrics[key][subKey] * 100) / 100;
      });
    }
  });

  return metrics;
}

/**
 * Generate time periods based on the selected period type
 */
function generateTimePeriods(startDate, endDate, period) {
  const periods = [];
  const current = new Date(startDate);

  switch (period) {
    case "weekly":
      // Generate daily data for 7 days
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(dayStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        // Stop if we exceed the end date
        if (dayStart > endDate) break;

        const label = dayStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        periods.push({
          start: dayStart,
          end: dayEnd > endDate ? endDate : dayEnd,
          label,
        });
      }
      break;

    case "monthly":
      // Generate daily data for the entire month
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(year, month, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999);

        // Only include days within our date range
        if (dayStart >= startDate && dayStart <= endDate) {
          const label = dayStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          periods.push({
            start: dayStart,
            end: dayEnd > endDate ? endDate : dayEnd,
            label,
          });
        }
      }
      break;

    case "annually":
      // Generate monthly data for 12 months
      const baseYear = startDate.getFullYear();

      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(baseYear, month, 1, 0, 0, 0, 0);
        const monthEnd = new Date(baseYear, month + 1, 0, 23, 59, 59, 999);

        // Only include months within our date range
        if (monthEnd >= startDate && monthStart <= endDate) {
          const actualStart = monthStart < startDate ? startDate : monthStart;
          const actualEnd = monthEnd > endDate ? endDate : monthEnd;

          const label = monthStart.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          periods.push({
            start: actualStart,
            end: actualEnd,
            label,
          });
        }
      }
      break;

    default:
      // Daily data for custom period
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const label = dayStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        periods.push({
          start: dayStart,
          end: dayEnd > endDate ? endDate : dayEnd,
          label,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
  }

  return periods;
}
