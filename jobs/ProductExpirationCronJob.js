const cron = require("node-cron");
const { Product } = require("../models/product.modal"); // Adjust path as needed
const { Op } = require("sequelize");

/**
 * Cron job to check and deactivate expired products
 * Runs every 2 minutes for testing purposes
 */
const startProductExpirationCronJob = () => {
  // Schedule cron job to run every 2 minutes
  const cronJob = cron.schedule(
    "*/30 * * * *",
    async () => {
      try {
        console.log(
          `[${new Date().toISOString()}] Starting product expiration check...`
        );

        // Find all products that are expired
        const currentDate = new Date();
        const expiredProducts = await Product.findAll({
          where: {
            expiration_date: {
              [Op.lte]: currentDate, // expiration_date <= current_date
            },
            is_active: true, // Only check active products
            list_for_selling: true, // Only check products that are currently listed
          },
          attributes: [
            "id",
            "title",
            "expiration_date",
            "user_id",
            "listing_id",
          ],
        });

        if (expiredProducts.length === 0) {
          console.log(
            `[${new Date().toISOString()}] No expired products found.`
          );
          return;
        }

        console.log(
          `[${new Date().toISOString()}] Found ${
            expiredProducts.length
          } expired products to deactivate.`
        );

        // Update expired products in bulk
        const updateResult = await Product.update(
          {
            is_active: false,
            list_for_selling: false,
            updated_at: new Date(),
          },
          {
            where: {
              id: {
                [Op.in]: expiredProducts.map((product) => product.id),
              },
            },
          }
        );

        console.log(
          `[${new Date().toISOString()}] Successfully deactivated ${
            updateResult[0]
          } expired products.`
        );

        // Log details of deactivated products for debugging
        expiredProducts.forEach((product) => {
          console.log(
            `  - Deactivated: ${product.title} (ID: ${product.id}) - Expired on: ${product.expiration_date}`
          );
        });
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] Error in product expiration cron job:`,
          error
        );
      }
    },
    {
      scheduled: true,
      timezone: "UTC", // Adjust timezone as needed
    }
  );

  console.log("Product expiration cron job started - running every 2 minutes");
  return cronJob;
};

/**
 * Stop the cron job (useful for testing or graceful shutdown)
 */
const stopProductExpirationCronJob = (cronJob) => {
  if (cronJob) {
    cronJob.stop();
    console.log("Product expiration cron job stopped");
  }
};

/**
 * Manual function to check expired products (useful for testing)
 */
const checkExpiredProductsManually = async () => {
  try {
    console.log("Manual check for expired products...");

    const currentDate = new Date();
    const expiredProducts = await Product.findAll({
      where: {
        expiration_date: {
          [Op.lte]: currentDate,
        },
        is_active: true,
        list_for_selling: true,
      },
    });

    console.log(`Found ${expiredProducts.length} expired products`);

    if (expiredProducts.length > 0) {
      const updateResult = await Product.update(
        {
          is_active: false,
          list_for_selling: false,
          updated_at: new Date(),
        },
        {
          where: {
            id: {
              [Op.in]: expiredProducts.map((product) => product.id),
            },
          },
        }
      );

      console.log(`Manually deactivated ${updateResult[0]} expired products`);
      return expiredProducts;
    }

    return [];
  } catch (error) {
    console.error("Error in manual expired products check:", error);
    throw error;
  }
};

module.exports = {
  startProductExpirationCronJob,
  stopProductExpirationCronJob,
  checkExpiredProductsManually,
};
