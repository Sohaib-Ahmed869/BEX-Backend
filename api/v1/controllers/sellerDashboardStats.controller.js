const { Order, OrderItem, Product } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");

/**
 * Get dashboard statistics for a seller
 */
// exports.getDashboardStats = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { startDate, endDate } = req.query;

//     // Set default date range to current month if not provided
//     const now = new Date();
//     const defaultStartDate =
//       startDate || new Date(now.getFullYear(), now.getMonth(), 1);
//     const defaultEndDate =
//       endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

//     // Get seller's products
//     const sellerProducts = await Product.findAll({
//       where: { user_id: userId },
//       attributes: ["id"],
//     });

//     const productIds = sellerProducts.map((p) => p.id);

//     if (productIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           averageOrderValue: 0,
//           totalOrders: 0,
//           totalRevenue: 0,
//           recentOrders: [],
//           topSellingProducts: [],
//           salesData: [],
//           inventoryDetails: [],
//         },
//       });
//     }

//     // Get orders containing seller's products within date range
//     const ordersWithItems = await Order.findAll({
//       include: [
//         {
//           model: OrderItem,
//           as: "items",
//           where: {
//             product_id: { [Op.in]: productIds },
//             order_status: "approved",
//           },
//           include: [
//             {
//               model: Product,
//               as: "product",
//               attributes: ["id", "title", "images", "quantity"],
//             },
//           ],
//         },
//       ],
//       where: {
//         order_date: {
//           [Op.between]: [defaultStartDate, defaultEndDate],
//         },
//       },
//       order: [["order_date", "DESC"]],
//     });
//     const orderItemsForRecentOrders = await Order.findAll({
//       include: [
//         {
//           model: OrderItem,
//           as: "items",
//           where: {
//             product_id: { [Op.in]: productIds },
//           },
//           include: [
//             {
//               model: Product,
//               as: "product",
//               attributes: ["id", "title", "images", "quantity"],
//             },
//           ],
//         },
//       ],
//       where: {
//         order_date: {
//           [Op.between]: [defaultStartDate, defaultEndDate],
//         },
//       },
//       order: [["order_date", "DESC"]],
//     });

//     // Calculate total revenue and order count
//     let totalRevenue = 0;
//     let orderCount = ordersWithItems.length;

//     ordersWithItems.forEach((order) => {
//       order.items.forEach((item) => {
//         totalRevenue += parseFloat(item.price) * item.quantity;
//       });
//     });

//     // Calculate average order value
//     const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

//     // Get recent orders (last 10)
//     const recentOrders = orderItemsForRecentOrders
//       .slice(0, 10)
//       .map((order) => ({
//         id: order.id,
//         orderDate: order.order_date,
//         items: order.items.map((item) => ({
//           title: item.title,
//           quantity: item.quantity,
//           price: item.price,
//           order_status: item.order_status,
//           payment_status: item.payment_status,
//         })),
//         totalAmount: order.items.reduce(
//           (sum, item) => sum + parseFloat(item.price) * item.quantity,
//           0
//         ),
//       }));

//     // Calculate top selling products
//     const productSales = {};
//     ordersWithItems.forEach((order) => {
//       order.items.forEach((item) => {
//         if (!productSales[item.product_id]) {
//           productSales[item.product_id] = {
//             product: item.product,
//             totalSold: 0,
//             revenue: 0,
//           };
//         }
//         productSales[item.product_id].totalSold += item.quantity;
//         productSales[item.product_id].revenue +=
//           parseFloat(item.price) * item.quantity;
//       });
//     });

//     const topSellingProducts = Object.values(productSales)
//       .sort((a, b) => b.totalSold - a.totalSold)
//       .slice(0, 5)
//       .map((item) => ({
//         id: item.product.id,
//         title: item.product.title,
//         image: item.product.images?.[0] || null,
//         totalSold: item.totalSold,
//         stockRemaining: item.product.quantity - item.totalSold,
//         revenue: item.revenue,
//       }));

//     // Generate sales data for chart (weekly data)
//     const salesData = await generateWeeklySalesData(
//       productIds,
//       defaultStartDate,
//       defaultEndDate
//     );

//     res.status(200).json({
//       success: true,
//       data: {
//         averageOrderValue: Math.round(averageOrderValue * 100) / 100,
//         totalOrders: orderCount,
//         totalRevenue: Math.round(totalRevenue * 100) / 100,
//         recentOrders,
//         topSellingProducts,
//         salesData,
//       },
//     });
//   } catch (error) {
//     console.error("Dashboard stats error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching dashboard statistics",
//       error: error.message,
//     });
//   }
// };
/**
 * Get dashboard statistics for a seller
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, dateFilter } = req.query;

    // Handle predefined date filters
    const now = new Date();
    let defaultStartDate, defaultEndDate;

    if (dateFilter) {
      switch (dateFilter) {
        case "last30days":
          defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          defaultEndDate = now;
          break;
        case "last90days":
          defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          defaultEndDate = now;
          break;
        case "alltime":
          // Get the earliest product creation date for this seller
          const earliestProduct = await Product.findOne({
            where: { user_id: userId },
            order: [["created_at", "ASC"]],
            attributes: ["created_at"],
          });
          defaultStartDate = earliestProduct
            ? new Date(earliestProduct.created_at)
            : new Date(2020, 0, 1);
          defaultEndDate = now;
          break;
        default:
          // Default to current month if invalid dateFilter
          defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
          defaultEndDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59
          );
      }
    } else {
      // Use custom dates if provided, otherwise default to current month
      defaultStartDate = startDate
        ? new Date(startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      defaultEndDate = endDate
        ? new Date(endDate)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get seller's products
    const sellerProducts = await Product.findAll({
      where: { user_id: userId },
      attributes: ["id"],
    });

    const productIds = sellerProducts.map((p) => p.id);

    if (productIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          averageOrderValue: 0,
          totalOrders: 0,
          totalRevenue: 0,
          recentOrders: [],
          topSellingProducts: [],
          salesData: [],
          inventoryDetails: [],
          dateRange: {
            startDate: defaultStartDate,
            endDate: defaultEndDate,
            filter: dateFilter || "custom",
          },
        },
      });
    }

    // Get orders containing seller's products within date range
    const ordersWithItems = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          where: {
            product_id: { [Op.in]: productIds },
            order_status: "approved",
          },
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "title", "images", "quantity"],
            },
          ],
        },
      ],
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
      },
      order: [["order_date", "DESC"]],
    });

    const orderItemsForRecentOrders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "items",
          where: {
            product_id: { [Op.in]: productIds },
          },
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "title", "images", "quantity"],
            },
          ],
        },
      ],
      where: {
        order_date: {
          [Op.between]: [defaultStartDate, defaultEndDate],
        },
      },
      order: [["order_date", "DESC"]],
    });

    // Calculate total revenue and order count
    let totalRevenue = 0;
    let orderCount = ordersWithItems.length;

    ordersWithItems.forEach((order) => {
      order.items.forEach((item) => {
        totalRevenue += parseFloat(item.price) * item.quantity;
      });
    });

    // Calculate average order value
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Get recent orders (last 10)
    const recentOrders = orderItemsForRecentOrders
      .slice(0, 10)
      .map((order) => ({
        id: order.id,
        orderDate: order.order_date,
        items: order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          order_status: item.order_status,
          payment_status: item.payment_status,
        })),
        totalAmount: order.items.reduce(
          (sum, item) => sum + parseFloat(item.price) * item.quantity,
          0
        ),
      }));

    // Calculate top selling products
    const productSales = {};
    ordersWithItems.forEach((order) => {
      order.items.forEach((item) => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            product: item.product,
            totalSold: 0,
            revenue: 0,
          };
        }
        productSales[item.product_id].totalSold += item.quantity;
        productSales[item.product_id].revenue +=
          parseFloat(item.price) * item.quantity;
      });
    });

    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5)
      .map((item) => ({
        id: item.product.id,
        title: item.product.title,
        image: item.product.images?.[0] || null,
        totalSold: item.totalSold,
        stockRemaining: item.product.quantity - item.totalSold,
        revenue: item.revenue,
      }));

    // Generate sales data for chart (weekly data)
    const salesData = await generateWeeklySalesData(productIds);

    res.status(200).json({
      success: true,
      data: {
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        totalOrders: orderCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        recentOrders,
        topSellingProducts,
        salesData,
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
          filter: dateFilter || "custom",
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};
/**
 * Get inventory details for a specific product
 */
exports.getInventoryDetails = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify product belongs to seller
    const product = await Product.findOne({
      where: { id: productId, user_id: userId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by seller",
      });
    }

    // Set default date range based on product creation date
    const now = new Date();
    const productCreatedAt = new Date(product.created_at);

    // If no startDate provided, use product creation date
    // If no endDate provided, use current date
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(
          productCreatedAt.getFullYear(),
          productCreatedAt.getMonth(),
          productCreatedAt.getDate()
        );
    const defaultEndDate = endDate ? new Date(endDate) : now;

    // Ensure we don't go before product creation date
    const actualStartDate =
      defaultStartDate < productCreatedAt ? productCreatedAt : defaultStartDate;

    // Get daily sales data for the product
    const dailySales = await OrderItem.findAll({
      include: [
        {
          model: Order,
          as: "order",
          where: {
            order_date: {
              [Op.between]: [actualStartDate, defaultEndDate],
            },
          },
          attributes: [], // Don't select order attributes to avoid GROUP BY issues
        },
      ],
      where: { product_id: productId, order_status: "approved" },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("order.order_date")), "date"],
        [sequelize.fn("SUM", sequelize.col("OrderItem.quantity")), "totalSold"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("order.order_date"))],
      order: [[sequelize.fn("DATE", sequelize.col("order.order_date")), "ASC"]],
      raw: true,
    });

    // Calculate running inventory
    let runningStock = product.quantity;
    const inventoryData = [];

    // Get total sold before the start date (but after product creation)
    const soldBeforeStartDate = await OrderItem.findOne({
      include: [
        {
          model: Order,
          as: "order",
          where: {
            order_date: {
              [Op.and]: [
                { [Op.gte]: productCreatedAt }, // After product creation
                { [Op.lt]: actualStartDate }, // Before our start date
              ],
              order_status: "approved", // Added this filter for approved status
            },
          },
          attributes: [],
        },
      ],
      where: { product_id: productId },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("OrderItem.quantity")), "totalSold"],
      ],
      raw: true,
    });

    const totalSoldBefore = soldBeforeStartDate?.totalSold || 0;
    runningStock -= parseInt(totalSoldBefore);

    // Generate daily inventory data
    const startDateObj = new Date(actualStartDate);
    const endDateObj = new Date(defaultEndDate);

    for (
      let d = new Date(startDateObj);
      d <= endDateObj;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split("T")[0];
      const salesForDay = dailySales.find((sale) => sale.date === dateStr);

      const soldToday = salesForDay ? parseInt(salesForDay.totalSold) : 0;

      inventoryData.push({
        date: dateStr,
        stock: Math.max(0, runningStock),
        sold: soldToday,
      });

      // Update running stock for next day
      if (soldToday > 0) {
        runningStock -= soldToday;
      }
    }

    // Calculate current stock (total sold since product creation)
    const totalSoldSinceCreation = await OrderItem.findOne({
      include: [
        {
          model: Order,
          as: "order",
          where: {
            order_date: { [Op.gte]: productCreatedAt },
          },
          attributes: [],
        },
      ],
      where: { product_id: productId, order_status: "approved" },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("OrderItem.quantity")), "totalSold"],
      ],
      raw: true,
    });

    const totalSold = totalSoldSinceCreation?.totalSold || 0;
    const currentStock = Math.max(0, product.quantity - parseInt(totalSold));

    res.status(200).json({
      success: true,
      data: {
        product: {
          id: product.id,
          title: product.title,
          initialStock: product.quantity,
          currentStock: currentStock,
          createdAt: product.created_at, // Include creation date for reference
        },
        inventoryData,
      },
    });
  } catch (error) {
    console.error("Inventory details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory details",
      error: error.message,
    });
  }
};
/**
 * Helper function to generate weekly sales data
 */
// async function generateWeeklySalesData(productIds, startDate, endDate) {
//   try {
//     // First, get all order items with their order dates
//     const orderItems = await OrderItem.findAll({
//       include: [
//         {
//           model: Order,
//           as: "order",
//           where: {
//             order_date: {
//               [Op.between]: [startDate, endDate],
//             },
//           },
//           attributes: ["order_date"],
//         },
//       ],
//       where: {
//         product_id: { [Op.in]: productIds },
//         order_status: "approved",
//       },
//       attributes: ["price", "quantity"],
//     });

//     // Process the data in JavaScript instead of relying on database-specific SQL
//     const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     const salesByDay = {};

//     // Initialize all days with 0
//     dayNames.forEach((day) => {
//       salesByDay[day] = 0;
//     });

//     // Calculate revenue by day
//     orderItems.forEach((item) => {
//       const orderDate = new Date(item.order.order_date);
//       const dayOfWeek = orderDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
//       const dayName = dayNames[dayOfWeek];
//       const revenue = parseFloat(item.price) * item.quantity;
//       salesByDay[dayName] += revenue;
//     });

//     // Return the formatted data
//     return dayNames.map((day) => ({
//       day,
//       revenue: Math.round(salesByDay[day] * 100) / 100, // Round to 2 decimal places
//     }));
//   } catch (error) {
//     console.error("Error generating weekly sales data:", error);
//     return [];
//   }
// }
async function generateWeeklySalesData(productIds) {
  try {
    const now = new Date();

    // Current month: from 1st of current month to current date
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // Previous month: from 1st of previous month to last day of previous month
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Get current month's order items
    const currentMonthItems = await OrderItem.findAll({
      include: [
        {
          model: Order,
          as: "order",
          where: {
            order_date: {
              [Op.between]: [currentStart, currentEnd],
            },
          },
          attributes: ["order_date"],
        },
      ],
      where: {
        product_id: { [Op.in]: productIds },
        order_status: "approved",
      },
      attributes: ["price", "quantity"],
    });

    // Get previous month's order items
    const prevMonthItems = await OrderItem.findAll({
      include: [
        {
          model: Order,
          as: "order",
          where: {
            order_date: {
              [Op.between]: [prevStart, prevEnd],
            },
          },
          attributes: ["order_date"],
        },
      ],
      where: {
        product_id: { [Op.in]: productIds },
        order_status: "approved",
      },
      attributes: ["price", "quantity"],
    });

    // Helper function to get week number within month (1-based)
    const getWeekOfMonth = (date) => {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const firstWeekday = firstDay.getDay(); // 0 = Sunday
      const dayOfMonth = date.getDate();
      return Math.ceil((dayOfMonth + firstWeekday) / 7);
    };

    // Helper function to get week date range
    const getWeekDateRange = (year, month, weekNumber) => {
      const firstDay = new Date(year, month, 1);
      const firstWeekday = firstDay.getDay();

      // Calculate start date of the week
      const startDate = new Date(
        year,
        month,
        1 + (weekNumber - 1) * 7 - firstWeekday
      );
      const endDate = new Date(
        year,
        month,
        1 + weekNumber * 7 - firstWeekday - 1
      );

      // Ensure we don't go beyond the current month boundaries
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      if (startDate < monthStart) startDate.setTime(monthStart.getTime());
      if (endDate > monthEnd) endDate.setTime(monthEnd.getTime());

      return { startDate, endDate };
    };

    // Process data by weeks with daily breakdown
    const processWeeklyData = (items, year, month) => {
      const weeklyData = {};

      // Initialize weeks 1-6 (maximum possible weeks in a month)
      for (let i = 1; i <= 6; i++) {
        weeklyData[i] = {
          revenue: 0,
          count: 0,
          dailyBreakdown: {
            Sunday: { revenue: 0, orders: 0, date: null },
            Monday: { revenue: 0, orders: 0, date: null },
            Tuesday: { revenue: 0, orders: 0, date: null },
            Wednesday: { revenue: 0, orders: 0, date: null },
            Thursday: { revenue: 0, orders: 0, date: null },
            Friday: { revenue: 0, orders: 0, date: null },
            Saturday: { revenue: 0, orders: 0, date: null },
          },
        };
      }

      items.forEach((item) => {
        const orderDate = new Date(item.order.order_date);
        const weekNumber = getWeekOfMonth(orderDate);
        const revenue = Number.parseFloat(item.price) * item.quantity;
        const dayName = orderDate.toLocaleDateString("en-US", {
          weekday: "long",
        });

        if (weeklyData[weekNumber]) {
          weeklyData[weekNumber].revenue += revenue;
          weeklyData[weekNumber].count += 1;

          // Add to daily breakdown
          weeklyData[weekNumber].dailyBreakdown[dayName].revenue += revenue;
          weeklyData[weekNumber].dailyBreakdown[dayName].orders += 1;
          weeklyData[weekNumber].dailyBreakdown[dayName].date = orderDate
            .toISOString()
            .split("T")[0];
        }
      });

      return weeklyData;
    };

    // Process current and previous month data
    const currentWeeklyData = processWeeklyData(
      currentMonthItems,
      now.getFullYear(),
      now.getMonth()
    );

    const prevWeeklyData = processWeeklyData(
      prevMonthItems,
      now.getFullYear(),
      now.getMonth() - 1
    );

    // Generate week comparison data
    const weeklyComparisonData = [];

    // Determine how many weeks exist in current month
    const lastDayOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );
    const maxWeeksInCurrentMonth = getWeekOfMonth(lastDayOfCurrentMonth);

    for (let week = 1; week <= maxWeeksInCurrentMonth; week++) {
      const currentWeekRange = getWeekDateRange(
        now.getFullYear(),
        now.getMonth(),
        week
      );

      const prevWeekRange = getWeekDateRange(
        now.getFullYear(),
        now.getMonth() - 1,
        week
      );

      const currentWeekData = currentWeeklyData[week] || {
        revenue: 0,
        count: 0,
        orders: [],
      };
      const prevWeekData = prevWeeklyData[week] || {
        revenue: 0,
        count: 0,
        orders: [],
      };

      // Calculate percentage change
      const percentageChange =
        prevWeekData.revenue > 0
          ? Math.round(
              ((currentWeekData.revenue - prevWeekData.revenue) /
                prevWeekData.revenue) *
                100
            )
          : currentWeekData.revenue > 0
          ? 100
          : 0;

      // Only include weeks that have started (not future weeks)
      const weekStarted = currentWeekRange.startDate <= now;

      if (weekStarted) {
        weeklyComparisonData.push({
          week,
          label: `Week ${week}`,
          startDate: currentWeekRange.startDate.toISOString().split("T")[0],
          endDate: currentWeekRange.endDate.toISOString().split("T")[0],
          revenue: Math.round(currentWeekData.revenue * 100) / 100,
          prevRevenue: Math.round(prevWeekData.revenue * 100) / 100,
          orderCount: currentWeekData.count,
          prevOrderCount: prevWeekData.count,
          percentageChange,
          dailyBreakdown: currentWeekData.dailyBreakdown || {},
          prevDailyBreakdown: prevWeekData.dailyBreakdown || {},
        });
      }
    }

    return {
      currentMonth: {
        start: currentStart.toISOString().split("T")[0],
        end: currentEnd.toISOString().split("T")[0],
        name: currentStart.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      },
      previousMonth: {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        name: prevStart.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      },
      weeks: weeklyComparisonData,
      summary: {
        totalCurrentRevenue: weeklyComparisonData.reduce(
          (sum, week) => sum + week.revenue,
          0
        ),
        totalPrevRevenue: weeklyComparisonData.reduce(
          (sum, week) => sum + week.prevRevenue,
          0
        ),
        totalCurrentOrders: weeklyComparisonData.reduce(
          (sum, week) => sum + week.orderCount,
          0
        ),
        totalPrevOrders: weeklyComparisonData.reduce(
          (sum, week) => sum + week.prevOrderCount,
          0
        ),
      },
    };
  } catch (error) {
    console.error("Error generating weekly sales data:", error);
    return {
      currentMonth: null,
      previousMonth: null,
      weeks: [],
      summary: {
        totalCurrentRevenue: 0,
        totalPrevRevenue: 0,
        totalCurrentOrders: 0,
        totalPrevOrders: 0,
      },
    };
  }
}

exports.getUserProductsIds = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      category,
      condition,
      includeArchived = false,
      includeInactive = false,
    } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Build where clause dynamically
    const whereClause = { user_id: userId };

    // Add optional filters
    if (category) {
      whereClause.category = category;
    }

    if (condition) {
      whereClause.condition = condition;
    }

    if (!includeInactive) {
      whereClause.is_active = true;
    }

    if (!includeArchived) {
      whereClause.is_Archived = false;
    }

    const products = await Product.findAll({
      where: whereClause,
      attributes: ["id", "title", "category", "condition", "price"],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      message: `Found ${products.length} products`,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching user products with filters:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user products",
      error: error.message,
    });
  }
};
