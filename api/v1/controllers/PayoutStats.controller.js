// controllers/payoutStatsController.js
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");
const Payout = require("../../../models/stripePayout.model");
const User = require("../../../models/user.model");

// Get payout statistics and analytics
exports.getPayoutStats = async (req, res) => {
  try {
    const { sellerId, dateRange = "30", startDate, endDate } = req.query;

    // Calculate date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      };
    } else {
      const daysAgo = parseInt(dateRange);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);
      dateFilter = {
        created_at: {
          [Op.gte]: fromDate,
        },
      };
    }

    // Base where clause
    const whereClause = { ...dateFilter };
    if (sellerId) whereClause.seller_id = sellerId;

    // 1. Overall Statistics
    const totalStats = await Payout.findOne({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total_payouts"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "total_net_amount"],
        [sequelize.fn("SUM", sequelize.col("fee_amount")), "total_fees"],
        [sequelize.fn("AVG", sequelize.col("amount")), "average_payout"],
      ],
      raw: true,
    });

    // 2. Status Distribution
    const statusStats = await Payout.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
      ],
      group: ["status"],
      raw: true,
    });

    // 3. Daily/Weekly Trends (for line chart)
    const timeSeriesData = await Payout.findAll({
      where: whereClause,
      attributes: [
        [
          sequelize.fn("DATE_TRUNC", "day", sequelize.col("created_at")),
          "date",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "total_net_amount"],
      ],
      group: [sequelize.fn("DATE_TRUNC", "day", sequelize.col("created_at"))],
      order: [
        [sequelize.fn("DATE_TRUNC", "day", sequelize.col("created_at")), "ASC"],
      ],
      raw: true,
    });

    // 4. Top Sellers (for bar chart)
    const topSellers = await Payout.findAll({
      where: dateFilter, // Don't include sellerId filter for top sellers
      attributes: [
        "seller_id",
        [sequelize.fn("COUNT", sequelize.col("Payout.id")), "payout_count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "total_net_amount"],
      ],
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["first_name", "last_name", "company_name", "email"],
        },
      ],
      group: ["seller_id", "seller.id"],
      order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
      limit: 10,
      raw: false,
    });

    // 5. Monthly Comparison
    const monthlyStats = await Payout.findAll({
      where: whereClause,
      attributes: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("created_at")),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "total_net_amount"],
      ],
      group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("created_at"))],
      order: [
        [
          sequelize.fn("DATE_TRUNC", "month", sequelize.col("created_at")),
          "ASC",
        ],
      ],
      raw: true,
    });

    // Format the response
    const response = {
      success: true,
      data: {
        overview: {
          total_payouts: parseInt(totalStats.total_payouts) || 0,
          total_amount: parseFloat(totalStats.total_amount) || 0,
          total_net_amount: parseFloat(totalStats.total_net_amount) || 0,
          total_fees: parseFloat(totalStats.total_fees) || 0,
          average_payout: parseFloat(totalStats.average_payout) || 0,
        },
        status_distribution: statusStats.map((stat) => ({
          status: stat.status,
          count: parseInt(stat.count),
          amount: parseFloat(stat.total_amount) || 0,
        })),
        time_series: timeSeriesData.map((item) => ({
          date: item.date,
          count: parseInt(item.count),
          amount: parseFloat(item.total_amount) || 0,
          net_amount: parseFloat(item.total_net_amount) || 0,
        })),
        top_sellers: topSellers.map((seller) => ({
          seller_id: seller.seller_id,
          seller_name: `${seller.seller.first_name} ${seller.seller.last_name}`,
          company_name: seller.seller.company_name,
          email: seller.seller.email,
          payout_count: parseInt(seller.getDataValue("payout_count")),
          total_amount: parseFloat(seller.getDataValue("total_amount")) || 0,
          total_net_amount:
            parseFloat(seller.getDataValue("total_net_amount")) || 0,
        })),
        monthly_comparison: monthlyStats.map((month) => ({
          month: month.month,
          count: parseInt(month.count),
          amount: parseFloat(month.total_amount) || 0,
          net_amount: parseFloat(month.total_net_amount) || 0,
        })),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get payout stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get quick stats for dashboard
exports.getQuickStats = async (req, res) => {
  try {
    const { sellerId } = req.query;

    const whereClause = {};
    if (sellerId) whereClause.seller_id = sellerId;

    // Get stats for different time periods
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // This month stats
    const thisMonthStats = await Payout.findOne({
      where: {
        ...whereClause,
        created_at: { [Op.gte]: thisMonth },
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "net_amount"],
      ],
      raw: true,
    });

    // Last month stats for comparison
    const lastMonthStats = await Payout.findOne({
      where: {
        ...whereClause,
        created_at: {
          [Op.between]: [lastMonth, endOfLastMonth],
        },
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "amount"],
        [sequelize.fn("SUM", sequelize.col("net_amount")), "net_amount"],
      ],
      raw: true,
    });

    // Pending payouts
    const pendingStats = await Payout.findOne({
      where: {
        ...whereClause,
        status: "pending",
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "amount"],
      ],
      raw: true,
    });

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const currentAmount = parseFloat(thisMonthStats.amount) || 0;
    const previousAmount = parseFloat(lastMonthStats.amount) || 0;
    const currentCount = parseInt(thisMonthStats.count) || 0;
    const previousCount = parseInt(lastMonthStats.count) || 0;

    res.status(200).json({
      success: true,
      data: {
        this_month: {
          count: currentCount,
          amount: currentAmount,
          net_amount: parseFloat(thisMonthStats.net_amount) || 0,
        },
        last_month: {
          count: previousCount,
          amount: previousAmount,
          net_amount: parseFloat(lastMonthStats.net_amount) || 0,
        },
        pending: {
          count: parseInt(pendingStats.count) || 0,
          amount: parseFloat(pendingStats.amount) || 0,
        },
        percentage_changes: {
          amount_change: calculatePercentageChange(
            currentAmount,
            previousAmount
          ),
          count_change: calculatePercentageChange(currentCount, previousCount),
        },
      },
    });
  } catch (error) {
    console.error("Get quick stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
