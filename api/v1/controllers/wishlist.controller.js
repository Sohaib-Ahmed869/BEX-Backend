const { Wishlist, WishlistItem } = require("../../../models/wishlist.model");
const { sequelize } = require("../../../config/db");

/**
 * Get a user's wishlist or create a new one if it doesn't exist
 */
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user's wishlist or create a new one
    const [wishlist, created] = await Wishlist.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        items_count: 0,
      },
    });

    // Fetch wishlist items separately
    const wishlistItems = await WishlistItem.findAll({
      where: { wishlist_id: wishlist.id },
    });

    // Convert to plain object for response
    const wishlistData = wishlist.toJSON();
    wishlistData.items = wishlistItems;

    console.log("Retrieved wishlist:", JSON.stringify(wishlistData, null, 2));

    return res.status(200).json({
      success: true,
      data: wishlistData,
      isNew: created,
    });
  } catch (error) {
    console.error("Error getting wishlist:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Add a product to the wishlist
 */
exports.addToWishlist = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const { productData } = req.body;
    console.log("productData:", productData);

    if (!productData || !productData.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product data is required and must include an ID",
      });
    }

    const productId = productData.id;

    // Get user's wishlist or create a new one
    let [wishlist, created] = await Wishlist.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        items_count: 0,
      },
      transaction,
    });

    // Check if the product is already in the wishlist
    const existingItem = await WishlistItem.findOne({
      where: {
        wishlist_id: wishlist.id,
        product_id: productId,
      },
      transaction,
    });

    if (existingItem) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product already in wishlist",
      });
    } else {
      // Add new item to wishlist using the provided product data
      await WishlistItem.create(
        {
          wishlist_id: wishlist.id,
          product_id: productId,
          title: productData.title,
          category: productData.category,
          diameter: productData.diameter,
          brand: productData.brand || null,
          image_link:
            productData.images && productData.images.length
              ? productData.images[0]
              : null,
          price: parseFloat(productData.price),
        },
        { transaction }
      );
    }

    // Get all wishlist items
    const wishlistItems = await WishlistItem.findAll({
      where: { wishlist_id: wishlist.id },
      transaction,
    });

    // Update wishlist with new count
    await wishlist.update(
      {
        items_count: wishlistItems.length,
      },
      { transaction }
    );

    // Get the updated wishlist
    const updatedWishlist = await Wishlist.findOne({
      where: { user_id: userId },
      transaction,
    });

    // Create response object
    const wishlistResponse = updatedWishlist.toJSON();
    wishlistResponse.items = wishlistItems;

    console.log("Updated wishlist:", JSON.stringify(wishlistResponse, null, 2));

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
      data: wishlistResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove a product from the wishlist
 */
exports.removeFromWishlist = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const { itemId } = req.body;

    if (!itemId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // Get the user's wishlist
    const wishlist = await Wishlist.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!wishlist) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Find the wishlist item
    const wishlistItem = await WishlistItem.findOne({
      where: { id: itemId, wishlist_id: wishlist.id },
      transaction,
    });

    if (!wishlistItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Item not found in wishlist",
      });
    }

    // Remove item completely
    await wishlistItem.destroy({ transaction });

    // Get all wishlist items to update count
    const wishlistItems = await WishlistItem.findAll({
      where: { wishlist_id: wishlist.id },
      transaction,
    });

    // Update wishlist
    await wishlist.update(
      {
        items_count: wishlistItems.length,
      },
      { transaction }
    );

    // Create response object
    const wishlistResponse = wishlist.toJSON();
    wishlistResponse.items = wishlistItems;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Item removed from wishlist successfully",
      data: wishlistResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Clear the entire wishlist
 */
exports.clearWishlist = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;

    // Get the user's wishlist
    const wishlist = await Wishlist.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!wishlist) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Delete all wishlist items
    await WishlistItem.destroy({
      where: { wishlist_id: wishlist.id },
      transaction,
    });

    // Reset wishlist count
    await wishlist.update(
      {
        items_count: 0,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      data: {
        ...wishlist.toJSON(),
        items: [],
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error clearing wishlist:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Check if a product is in the wishlist
 */
exports.checkWishlistItem = async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = req.params.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Get the user's wishlist
    const wishlist = await Wishlist.findOne({
      where: { user_id: userId },
    });

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        exists: false,
      });
    }

    // Check if product exists in wishlist
    const wishlistItem = await WishlistItem.findOne({
      where: {
        wishlist_id: wishlist.id,
        product_id: productId,
      },
    });

    return res.status(200).json({
      success: true,
      exists: !!wishlistItem,
      item: wishlistItem,
    });
  } catch (error) {
    console.error("Error checking wishlist item:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
