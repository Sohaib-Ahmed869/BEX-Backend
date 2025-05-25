const { Cart, CartItem } = require("../../../models/cart.model");
const { sequelize } = require("../../../config/db");

/**
 * Get a user's cart or create a new one if it doesn't exist
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user's cart or create a new one
    const [cart, created] = await Cart.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        products_count: 0,
        total_price: 0.0,
      },
    });

    // Fetch cart items separately
    const cartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
    });

    // Convert to plain object for response
    const cartData = cart.toJSON();
    cartData.items = cartItems;

    // Log the cart to debug
    console.log("Retrieved cart:", JSON.stringify(cartData, null, 2));

    return res.status(200).json({
      success: true,
      data: cartData,
      isNew: created,
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Add a product to the cart
 * If the product already exists in the cart, increase its quantity
 * Updates the total price
 */
exports.addToCart = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const { productData, quantity = 1 } = req.body;
    console.log("productData:", productData);

    if (!productData || !productData.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product data is required and must include an ID",
      });
    }

    const productId = productData.id;

    // Get user's cart or create a new one
    let [cart, created] = await Cart.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        products_count: 0,
        total_price: 0.0,
      },
      transaction,
    });

    // Find if the product is already in the cart
    const existingItem = await CartItem.findOne({
      where: {
        cart_id: cart.id,
        product_id: productId,
      },
      transaction,
    });

    if (existingItem) {
      // Update existing item quantity
      await existingItem.update(
        {
          quantity: existingItem.quantity + parseInt(quantity, 10),
        },
        { transaction }
      );
      console.log(
        "Updated existing item:",
        JSON.stringify(existingItem, null, 2)
      );
    } else {
      // Add new item to cart using the provided product data
      await CartItem.create(
        {
          cart_id: cart.id,
          product_id: productId,
          title: productData.title,
          category: productData.category,
          image_link:
            productData.images && productData.images.length
              ? productData.images[0]
              : null,
          diameter: productData.diameter,
          price: parseFloat(productData.price),
          quantity: parseInt(quantity, 10),
        },
        { transaction }
      );
    }

    // Get all cart items to calculate total price
    const cartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Calculate total price and count
    let totalPrice = 0;
    for (const item of cartItems) {
      totalPrice += parseFloat(item.price) * item.quantity;
    }

    // Update cart with new data
    await cart.update(
      {
        total_price: parseFloat(totalPrice.toFixed(2)),
        products_count: cartItems.length,
      },
      { transaction }
    );

    // Fetch items for the response
    const updatedCartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Get the updated cart
    const updatedCart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    // Create response object
    const cartResponse = updatedCart.toJSON();
    cartResponse.items = updatedCartItems;

    console.log("Updated cart:", JSON.stringify(cartResponse, null, 2));

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: cartResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding to cart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove a product from the cart
 * If quantity is specified, decrease the quantity by that amount
 * If quantity is 1 or new quantity would be <= 0, remove the item completely
 * Updates the total price
 */
exports.removeFromCart = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // Get the user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the cart item
    const cartItem = await CartItem.findOne({
      where: { id: itemId, cart_id: cart.id },
      transaction,
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    const parsedQuantity = parseInt(quantity);

    // Fix: Only remove if quantity would be reduced to zero
    if (cartItem.quantity <= parsedQuantity) {
      console.log("Removing item completely");
      // Remove item completely if quantity would be reduced to zero or less
      await cartItem.destroy({ transaction });
    } else {
      // Decrease quantity
      console.log("Decreasing quantity");
      await cartItem.update(
        {
          quantity: cartItem.quantity - parsedQuantity,
        },
        { transaction }
      );
    }

    // Get all cart items to calculate total price
    const cartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Calculate total price
    let totalPrice = 0;
    for (const item of cartItems) {
      totalPrice += parseFloat(item.price) * item.quantity;
    }

    // Update cart
    await cart.update(
      {
        total_price: parseFloat(totalPrice.toFixed(2)),
        products_count: cartItems.length,
      },
      { transaction }
    );

    // Get the updated cart items
    const updatedCartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Get the updated cart
    const updatedCart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    // Create response object
    const cartResponse = updatedCart.toJSON();
    cartResponse.items = updatedCartItems;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cartResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error removing from cart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Clear the entire cart
 */
exports.clearCart = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;

    // Get the user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Delete all cart items
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction,
    });

    // Reset cart totals
    await cart.update(
      {
        products_count: 0,
        total_price: 0.0,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        ...cart.toJSON(),
        items: [],
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error clearing cart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Add retipping service to a cart item
 */
exports.addRetipToItem = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.userId;
    const { itemId, retipPrice } = req.body;

    if (!itemId || !retipPrice) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Item ID and retip price are required",
      });
    }

    // Get the user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the cart item
    const cartItem = await CartItem.findOne({
      where: { id: itemId, cart_id: cart.id },
      transaction,
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // Update the cart item with retipping service
    await cartItem.update(
      {
        retip_added: true,
        retip_price: parseFloat(retipPrice),
      },
      { transaction }
    );
    console.log("Retipping service added to cart item:", cartItem.id);

    // Get updated cart items for response
    const updatedCartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Get the updated cart
    const updatedCart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    // Create response object
    const cartResponse = updatedCart.toJSON();
    cartResponse.items = updatedCartItems;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Retipping service added successfully",
      data: cartResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding retip to cart item:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove retipping service from a cart item
 */
exports.removeRetipFromItem = async (req, res) => {
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

    // Get the user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the cart item
    const cartItem = await CartItem.findOne({
      where: { id: itemId, cart_id: cart.id },
      transaction,
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // Remove retipping service from the cart item
    await cartItem.update(
      {
        retip_added: false,
        retip_price: null,
      },
      { transaction }
    );
    console.log("Retipping service removed from cart item:", cartItem.id);

    // Get updated cart items for response
    const updatedCartItems = await CartItem.findAll({
      where: { cart_id: cart.id },
      transaction,
    });

    // Get the updated cart
    const updatedCart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });

    // Create response object
    const cartResponse = updatedCart.toJSON();
    cartResponse.items = updatedCartItems;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Retipping service removed successfully",
      data: cartResponse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error removing retip from cart item:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
