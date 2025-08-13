const ShipmentService = require("../Services/shipmentService");
const Shipment = require("../../../models/shipment.model");
const ShipmentItem = require("../../../models/shipmentItems.model");
const OrderItem = require("../../../models/orderItem");
const Order = require("../../../models/order.model");
const { Product } = require("../../../models/product.modal");
const User = require("../../../models/user.model");

// Create shipments for an order (called after items are approved)
const createShipmentsForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await ShipmentService.createShipmentsForOrder(orderId);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        shipments: result.shipments,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Create Shipments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create shipments",
      error: error.message,
    });
  }
};

// Process UPS shipment creation
const processUPSShipment = async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const result = await ShipmentService.processUPSShipment(shipmentId);

    res.status(200).json({
      success: true,
      message: "UPS shipment created successfully",
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
      shipment: result.shipment,
    });
  } catch (error) {
    console.error("Process UPS Shipment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process UPS shipment",
      error: error.message,
    });
  }
};

// Schedule pickup for shipment
const schedulePickup = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { pickupDate, readyTime, closeTime } = req.body;

    // Validate pickup date format (YYYYMMDD)
    const dateRegex = /^\d{8}$/;
    if (!pickupDate || !dateRegex.test(pickupDate)) {
      return res.status(400).json({
        success: false,
        message: "Pickup date must be in YYYYMMDD format",
      });
    }

    // Validate pickup date is not in the past
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    if (pickupDate < today) {
      return res.status(400).json({
        success: false,
        message: "Pickup date cannot be in the past",
      });
    }

    const pickupData = {
      pickupDate,
      readyTime: readyTime || "0900",
      closeTime: closeTime || "1700",
    };

    const result = await ShipmentService.schedulePickup(shipmentId, pickupData);

    res.status(200).json({
      success: true,
      message: "Pickup scheduled successfully",
      pickupNumber: result.pickupNumber,
      shipment: result.shipment,
    });
  } catch (error) {
    console.error("Schedule Pickup Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule pickup",
      error: error.message,
    });
  }
};

// Cancel pickup for shipment
const cancelPickup = async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const result = await ShipmentService.cancelPickup(shipmentId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Cancel Pickup Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel pickup",
      error: error.message,
    });
  }
};

// Void shipment
const voidShipment = async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const result = await ShipmentService.voidShipment(shipmentId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Void Shipment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to void shipment",
      error: error.message,
    });
  }
};

// Handle return shipment
const handleReturnShipment = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { returnReason } = req.body;

    if (!returnReason) {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    const result = await ShipmentService.handleReturnShipment(
      shipmentId,
      returnReason
    );

    res.status(200).json({
      success: true,
      message: "Return shipment created successfully",
      returnShipment: result.returnShipment,
      returnTrackingNumber: result.returnTrackingNumber,
    });
  } catch (error) {
    console.error("Handle Return Shipment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create return shipment",
      error: error.message,
    });
  }
};

// Get all shipments for a seller
const getSellerShipments = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const whereClause = { seller_id: sellerId };
    if (status) {
      whereClause.status = status;
    }

    const shipments = await Shipment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Order,
          as: "order",
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["first_name", "last_name", "email"],
            },
          ],
        },
        {
          model: ShipmentItem,
          as: "items",
          include: [
            {
              model: OrderItem,
              as: "order_item",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["title", "price"],
                },
              ],
            },
          ],
        },
      ],
      limit: Number.parseInt(limit),
      offset: (Number.parseInt(page) - 1) * Number.parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      shipments: shipments.rows,
      pagination: {
        total: shipments.count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(shipments.count / Number.parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get Seller Shipments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get seller shipments",
      error: error.message,
    });
  }
};

// Get shipment details
const getShipmentDetails = async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const shipment = await Shipment.findByPk(shipmentId, {
      include: [
        {
          model: Order,
          as: "order",
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["first_name", "last_name", "email", "phone"],
            },
          ],
        },
        {
          model: User,
          as: "seller",
          attributes: [
            "first_name",
            "last_name",
            "company_name",
            "email",
            "phone",
          ],
        },
        {
          model: ShipmentItem,
          as: "items",
          include: [
            {
              model: OrderItem,
              as: "order_item",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["title", "price", "images"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      shipment,
    });
  } catch (error) {
    console.error("Get Shipment Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shipment details",
      error: error.message,
    });
  }
};

// ENHANCED Track shipment with simulation support
const trackShipment = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { simulateStatus } = req.body; // Optional parameter for development

    // In development mode, allow status simulation
    let result;
    if (process.env.NODE_ENV !== "production" && simulateStatus) {
      console.log(`🔧 Development mode: Simulating status - ${simulateStatus}`);
      result = await ShipmentService.trackAndUpdateShipment(
        shipmentId,
        simulateStatus
      );
    } else {
      result = await ShipmentService.trackAndUpdateShipment(shipmentId);
    }

    res.status(200).json({
      success: true,
      message: "Shipment tracking updated",
      trackingData: result.trackingData,
      status: result.status,
      currentActivity: result.currentActivity,
      isDevelopmentMode: process.env.NODE_ENV !== "production",
    });
  } catch (error) {
    console.error("Track Shipment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track shipment",
      error: error.message,
    });
  }
};

// Get available simulation statuses for development
const getSimulationStatuses = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Simulation statuses are only available in development mode",
      });
    }

    const statuses = ShipmentService.getAvailableSimulationStatuses();

    res.status(200).json({
      success: true,
      statuses,
      message: "Available simulation statuses for development/testing",
    });
  } catch (error) {
    console.error("Get Simulation Statuses Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get simulation statuses",
      error: error.message,
    });
  }
};

// Get delivery fee for checkout
const getDeliveryFee = async (req, res) => {
  try {
    const { orderItems, shippingAddress } = req.body;

    if (!orderItems || !shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Order items and shipping address are required",
      });
    }

    // Get products for the order items
    const orderItemsWithProducts = await OrderItem.findAll({
      where: { id: orderItems.map((item) => item.id) },
      include: [{ model: Product, as: "product" }],
    });

    const result = await ShipmentService.getDeliveryFee(
      orderItemsWithProducts,
      shippingAddress
    );

    res.status(200).json({
      success: true,
      deliveryFee: result.totalDeliveryFee,
      deliveryDetails: result.deliveryDetails,
    });
  } catch (error) {
    console.error("Get Delivery Fee Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate delivery fee",
      error: error.message,
    });
  }
};

// Get buyer's shipments
const getBuyerShipments = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const shipments = await Shipment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Order,
          as: "order",
          where: { buyer_id: buyerId },
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["first_name", "last_name"],
            },
          ],
        },
        {
          model: User,
          as: "seller",
          attributes: ["first_name", "last_name", "company_name"],
        },
        {
          model: ShipmentItem,
          as: "items",
          include: [
            {
              model: OrderItem,
              as: "order_item",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["title", "price", "images"],
                },
              ],
            },
          ],
        },
      ],
      limit: Number.parseInt(limit),
      offset: (Number.parseInt(page) - 1) * Number.parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      shipments: shipments.rows,
      pagination: {
        total: shipments.count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(shipments.count / Number.parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get Buyer Shipments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get buyer shipments",
      error: error.message,
    });
  }
};

// Test UPS authentication
const testUPSAuth = async (req, res) => {
  try {
    const UPSService = require("../Services/upsServices");
    const result = await UPSService.testAuthentication();

    res.status(200).json({
      success: result.success,
      message: result.success
        ? "UPS authentication successful"
        : "UPS authentication failed",
      token: result.token,
      error: result.error,
    });
  } catch (error) {
    console.error("Test UPS Auth Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test UPS authentication",
      error: error.message,
    });
  }
};

module.exports = {
  createShipmentsForOrder,
  processUPSShipment,
  schedulePickup,
  cancelPickup,
  voidShipment,
  handleReturnShipment,
  getSellerShipments,
  getShipmentDetails,
  trackShipment,
  getSimulationStatuses,
  getDeliveryFee,
  getBuyerShipments,
  testUPSAuth,
};
