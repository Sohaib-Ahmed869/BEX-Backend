const { Order, OrderItem, User, Product } = require("../../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../../config/db");
const axios = require("axios");

// ShipEngine API Configuration
const SHIPENGINE_CONFIG = {
  baseURL: "https://api.shipengine.com",
  apiKey: "TEST_lm66DSYIdRKwyHzQZs8sATyMbptixvZ/iQdcVYJ+5Mc",
  carriers: {
    STAMPS_COM: "se-2592790",
    UPS: "se-2592791",
    FEDEX: "se-2592831",
    DHL_EXPRESS: "se-2592830",
  },
};

// Create axios instance with auth
const shipengineAPI = axios.create({
  baseURL: SHIPENGINE_CONFIG.baseURL,
  headers: {
    "Content-Type": "application/json",
    "API-Key": SHIPENGINE_CONFIG.apiKey,
  },
});

// Helper function to normalize country codes
const normalizeCountryCode = (country) => {
  if (!country) return "US";

  const countryMap = {
    "United States": "US",
    USA: "US",
    US: "US",
    Canada: "CA",
    CAN: "CA",
    Australia: "AU",
    AUS: "AU",
    "United Kingdom": "GB",
    UK: "GB",
    GB: "GB",
  };

  const normalized = countryMap[country.toUpperCase()] || country.toUpperCase();

  // Validate it's a proper 2-letter code
  if (normalized.length === 2 && /^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  return "US"; // Default fallback
};

// Helper function to normalize state codes - HARDCODED TO UTAH
const normalizeStateCode = (state) => {
  // Always return UT for Utah since you mentioned it will always be Utah in US
  return "UT";
};

// Helper function to clean phone numbers
const cleanPhoneNumber = (phone) => {
  if (!phone) return null; // Return null instead of undefined for better API compatibility

  // Convert to string and remove all non-digit characters
  const cleaned = String(phone).replace(/\D/g, "");

  // Ensure it's a valid length (10-15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }

  return null; // Return null for invalid phone numbers
};

// FIXED: Helper function to format address for ShipEngine
const formatAddress = (addressData) => {
  console.log("Input address data:", JSON.stringify(addressData, null, 2));

  let formattedAddress = {};

  if (addressData && typeof addressData === "object") {
    // Handle the nested structure from your order response
    if (addressData.address && typeof addressData.address === "object") {
      formattedAddress = {
        name: addressData.name || "Name Required",
        company: addressData.company || undefined,
        address_line1:
          addressData.address.line1 ||
          addressData.address.street1 ||
          "Address Required",
        address_line2:
          addressData.address.line2 || addressData.address.street2 || undefined,
        address_line3: undefined,
        city_locality: addressData.address.city || "City Required",
        state_province: normalizeStateCode(addressData.address.state), // Will always be "UT"
        postal_code: addressData.address.postal_code || "00000",
        country_code: normalizeCountryCode(addressData.address.country) || "US",
        phone: cleanPhoneNumber(addressData.phone),
        residential: addressData.residential !== false,
      };
    } else {
      // Handle direct structure - this is likely your problematic case
      formattedAddress = {
        name:
          addressData.name ||
          `${addressData.firstName || ""} ${
            addressData.lastName || ""
          }`.trim() ||
          "Name Required",
        company: addressData.company || undefined,
        address_line1:
          addressData.street1 ||
          addressData.line1 ||
          addressData.address ||
          "Address Required",
        address_line2: addressData.street2 || addressData.line2 || undefined,
        address_line3: undefined,
        city_locality: addressData.city || "City Required",
        state_province: normalizeStateCode(addressData.state), // Will always be "UT"
        postal_code:
          addressData.postal_code ||
          addressData.postalCode ||
          addressData.zipCode ||
          "00000",
        country_code: normalizeCountryCode(addressData.country) || "US",
        phone: cleanPhoneNumber(addressData.phone),
        residential: addressData.residential !== false,
      };
    }
  }

  // Final validation and cleanup
  const cleanedAddress = {
    name: formattedAddress.name || "Name Required",
    company: formattedAddress.company,
    address_line1: formattedAddress.address_line1 || "Address Required",
    address_line2: formattedAddress.address_line2,
    address_line3: formattedAddress.address_line3,
    city_locality: formattedAddress.city_locality || "City Required",
    state_province: formattedAddress.state_province, // Will always be "UT"
    postal_code: formattedAddress.postal_code || "00000",
    country_code: formattedAddress.country_code || "US",
    phone: formattedAddress.phone,
    residential: formattedAddress.residential !== false,
  };

  console.log("Formatted address:", JSON.stringify(cleanedAddress, null, 2));
  return cleanedAddress;
};

// FIXED: Helper function to calculate package dimensions and weight
const calculatePackageDimensions = (orderItems) => {
  const defaultDimensions = {
    length: 12,
    width: 9,
    height: 3,
    weight: 1.0,
  };

  const totalWeight = orderItems.reduce((total, item) => {
    return total + item.quantity * 10; // Using 10 as default weight per item
  }, 0);

  return {
    package_code: "package",
    dimensions: {
      unit: "inch",
      length: defaultDimensions.length,
      width: defaultDimensions.width,
      height: defaultDimensions.height,
    },
    // FIXED: Weight must be an object with value and unit
    weight: {
      value: Math.max(totalWeight, 0.1),
      unit: "pound",
    },
  };
};

// FIXED: Update calculatePackageDimensions for rates function too
const calculatePackageDimensionsForRates = (orderItems) => {
  const defaultDimensions = {
    length: 12,
    width: 9,
    height: 3,
    weight: 1.0,
  };

  const totalWeight = orderItems.reduce((total, item) => {
    return total + item.quantity * 10; // Using 10 as default weight per item
  }, 0);

  return {
    package_code: "package",
    dimensions: {
      unit: "inch",
      length: defaultDimensions.length,
      width: defaultDimensions.width,
      height: defaultDimensions.height,
    },
    weight: {
      value: Math.max(totalWeight, 0.1),
      unit: "pound",
    },
  };
};

exports.createShipment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      orderId,
      sellerId,
      carrierCode = "UPS",
      serviceCode = "ups_ground",
    } = req.body;

    if (!orderId || !sellerId) {
      return res.status(400).json({
        success: false,
        message: "Order ID and Seller ID are required",
      });
    }
    const carrier_id = "se-2592791";

    // Get order with buyer details
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "email", "phone"],
        },
      ],
      transaction,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get seller details
    const seller = await User.findByPk(sellerId, {
      attributes: [
        "id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "company_name",
        "business_address",
      ],
      transaction,
    });

    if (!seller) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Get order items for this seller
    const orderItems = await OrderItem.findAll({
      where: {
        order_id: orderId,
        product_id: {
          [Op.in]: sequelize.literal(`(
            SELECT id FROM products WHERE user_id = '${sellerId}'
          )`),
        },
      },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "price", "user_id"],
        },
      ],
      transaction,
    });

    if (orderItems.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No order items found for this seller",
      });
    }

    // Parse and validate shipping address
    let shippingAddress;
    try {
      shippingAddress =
        typeof order.shipping_address === "string"
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;

      console.log(
        "Raw shipping address:",
        JSON.stringify(shippingAddress, null, 2)
      );

      // Add buyer info if missing
      if (!shippingAddress.name && order.buyer) {
        shippingAddress.name = `${order.buyer.first_name} ${order.buyer.last_name}`;
      }

      if (!shippingAddress.phone && order.buyer?.phone) {
        shippingAddress.phone = order.buyer.phone;
      }
    } catch (parseError) {
      console.error("Error parsing shipping address:", parseError);
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid shipping address format",
        error: parseError.message,
      });
    }

    // Parse and validate business address
    let businessAddress;
    try {
      businessAddress =
        typeof seller.business_address === "string"
          ? JSON.parse(seller.business_address)
          : seller.business_address;
    } catch (parseError) {
      console.warn("Could not parse business address, using defaults");
      businessAddress = {
        name: seller.company_name || `${seller.first_name} ${seller.last_name}`,
        company: seller.company_name,
        address_line1: "123 Business St",
        city_locality: "Business City",
        state_province: "UT", // Hardcoded to Utah
        postal_code: "84101", // Utah ZIP code
        country_code: "US",
        phone: seller.phone,
      };
    }

    // Format addresses using the fixed formatter
    const formattedShipTo = formatAddress(shippingAddress);
    const formattedShipFrom = formatAddress({
      name: `${seller.first_name} ${seller.last_name}`,
      company: seller.company_name,
      phone: seller.phone,
      address_line1: seller.business_address,
      ...businessAddress,
    });

    // Create shipment data with proper structure
    const shipmentData = {
      shipments: [
        {
          //   validate_address: "validate_and_clean",
          carrier_id: carrier_id,
          ship_to: formattedShipTo,
          ship_from: formattedShipFrom,
          packages: [calculatePackageDimensions(orderItems)],
          items: orderItems.map((item) => ({
            name: item.product?.title || item.title,
            quantity: item.quantity,
            value: {
              amount: item.price,
              currency: "USD",
            },
            origin_country: "US",
          })),
          customs: {
            contents: "merchandise",
            non_delivery: "return_to_sender",
          },
          advanced_options: {
            bill_to_party: null,
            bill_to_account: null,
            bill_to_postal_code: null,
            bill_to_country_code: null,
          },
          insurance_provider: "none",
        },
      ],
    };

    console.log(
      "Creating shipment with validated data:",
      JSON.stringify(shipmentData, null, 2)
    );
    // Make API call to ShipEngine
    const shipengineResponse = await shipengineAPI.post("/v1/shipments", {
      ...shipmentData,
      carrier_id: carrier_id,
    });

    if (!shipengineResponse.data?.shipments?.[0]) {
      throw new Error("Invalid response from ShipEngine API");
    }

    const shipment = shipengineResponse.data.shipments[0];
    console.log("shipment response", shipment);
    const shipmentId = shipment.shipment_id;
    const trackingNumber = shipment.tracking_number;
    const responseCarrierId = shipment.carrier_id;
    // Update order with shipment details
    await Order.update(
      {
        shipstation_id: shipmentId,
        tracking_number: trackingNumber,
        carrier_id: responseCarrierId,
      },
      {
        where: { id: orderId },
        transaction,
      }
    );

    // Update order items status
    await OrderItem.update(
      { order_status: "processing" },
      {
        where: {
          id: { [Op.in]: orderItems.map((item) => item.id) },
        },
        transaction,
      }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      data: {
        shipmentId: shipmentId,
        trackingNumber: trackingNumber,
        orderId: orderId,
        sellerId: sellerId,
        carrierCode: carrierCode,
        serviceCode: serviceCode,
        itemsCount: orderItems.length,
        shipmentDetails: shipment,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Create shipment error:", error);

    // Enhanced error handling
    if (error.response?.data) {
      const apiError = error.response.data;
      console.error("ShipEngine API Error Details:", apiError);

      let errorMessage = "ShipEngine API Error";
      let errorDetails = [];

      if (apiError.errors && Array.isArray(apiError.errors)) {
        errorDetails = apiError.errors.map((err) => ({
          field: err.field_name,
          message: err.message,
          code: err.error_code,
          value: err.field_value,
        }));
        errorMessage = apiError.errors.map((err) => err.message).join(", ");
      } else if (apiError.message) {
        errorMessage = apiError.message;
      }

      return res.status(error.response.status || 500).json({
        success: false,
        message: errorMessage,
        errors: errorDetails,
        requestId: apiError.request_id,
        ...(process.env.NODE_ENV === "development" && {
          debugInfo: {
            requestData: JSON.parse(error.config?.data || "{}"),
            responseStatus: error.response?.status,
          },
        }),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating shipment",
      error: error.message,
    });
  }
};

// Fixed other functions with proper API structure// Updated tracking functions for your ShipEngine integration

// Helper function to get carrier code from carrier ID
const getCarrierCodeFromId = (carrierId) => {
  const carrierMap = {
    "se-2592790": "stamps_com",
    "se-2592791": "ups",
    "se-2592831": "fedex",
    "se-2592830": "dhl_express",
  };
  return carrierMap[carrierId] || "ups"; // Default to ups
};

// Main tracking function - handles multiple tracking methods
exports.trackShipment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      attributes: ["id", "shipstation_id", "tracking_number", "carrier_id"],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.shipstation_id) {
      return res.status(400).json({
        success: false,
        message: "No shipment found for this order",
      });
    }

    let trackingData = null;
    let trackingMethod = "";

    try {
      // Method 1: Try to get updated shipment information first
      const shipmentResponse = await shipengineAPI.get(
        `/v1/shipments/${order.shipstation_id}`
      );
      const shipmentData = shipmentResponse.data;

      console.log(
        "Updated shipment data:",
        JSON.stringify(shipmentData, null, 2)
      );

      // Check if we now have a tracking number
      if (shipmentData.tracking_number && !order.tracking_number) {
        // Update the order with the new tracking number
        await Order.update(
          {
            tracking_number: shipmentData.tracking_number,
            // Update carrier_id if it changed
            carrier_id: shipmentData.carrier_id || order.carrier_id,
          },
          { where: { id: orderId } }
        );

        console.log(
          `Updated order ${orderId} with tracking number: ${shipmentData.tracking_number}`
        );
      }

      const currentTrackingNumber =
        shipmentData.tracking_number || order.tracking_number;
      const currentCarrierId = shipmentData.carrier_id || order.carrier_id;

      // Method 2: If we have a tracking number, use the tracking endpoint
      if (currentTrackingNumber && currentCarrierId) {
        try {
          const carrierCode = getCarrierCodeFromId(currentCarrierId);
          const trackingResponse = await shipengineAPI.get(
            `/v1/tracking?carrier_code=${carrierCode}&tracking_number=${currentTrackingNumber}`
          );

          trackingData = trackingResponse.data;
          trackingMethod = "tracking_endpoint";

          console.log(
            "Tracking data from tracking endpoint:",
            JSON.stringify(trackingData, null, 2)
          );
        } catch (trackingError) {
          console.warn("Tracking endpoint failed:", trackingError.message);

          // Fallback: Return shipment data with status information
          trackingData = {
            tracking_number: currentTrackingNumber,
            status_code: shipmentData.shipment_status,
            status_description: shipmentData.shipment_status,
            carrier_code: getCarrierCodeFromId(currentCarrierId),
            shipment_details: shipmentData,
            events: [],
          };
          trackingMethod = "shipment_status";
        }
      } else {
        // Method 3: No tracking number yet, return shipment status
        trackingData = {
          tracking_number: null,
          status_code: shipmentData.shipment_status,
          status_description: shipmentData.shipment_status,
          carrier_code: getCarrierCodeFromId(currentCarrierId),
          shipment_details: shipmentData,
          events: [],
          message:
            "Shipment created but tracking number not yet assigned by carrier",
        };
        trackingMethod = "shipment_status_only";
      }
    } catch (shipmentError) {
      console.error("Error fetching shipment data:", shipmentError);

      // Last resort: Try with existing tracking number if available
      if (order.tracking_number && order.carrier_id) {
        try {
          const carrierCode = getCarrierCodeFromId(order.carrier_id);
          const trackingResponse = await shipengineAPI.get(
            `/v1/tracking?carrier_code=${carrierCode}&tracking_number=${order.tracking_number}`
          );

          trackingData = trackingResponse.data;
          trackingMethod = "existing_tracking_number";
        } catch (finalError) {
          throw new Error(
            `Unable to fetch tracking information: ${finalError.message}`
          );
        }
      } else {
        throw shipmentError;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: orderId,
        shipmentId: order.shipstation_id,
        trackingNumber: trackingData?.tracking_number || order.tracking_number,
        carrierId: order.carrier_id,
        trackingMethod: trackingMethod,
        trackingInfo: trackingData,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Track shipment error:", error);

    if (error.response?.data) {
      const apiError = error.response.data;
      console.error("ShipEngine API Error Details:", apiError);

      return res.status(error.response.status || 500).json({
        success: false,
        message: "ShipEngine API Error",
        error: apiError.message || "Unable to fetch tracking information",
        details: apiError.errors || [],
        requestId: apiError.request_id,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error tracking shipment",
      error: error.message,
    });
  }
};

// Alternative function to refresh shipment data and get tracking number
exports.refreshShipmentData = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      attributes: ["id", "shipstation_id", "tracking_number", "carrier_id"],
    });

    if (!order || !order.shipstation_id) {
      return res.status(404).json({
        success: false,
        message: "Order or shipment not found",
      });
    }

    // Get updated shipment information
    const shipmentResponse = await shipengineAPI.get(
      `/v1/shipments/${order.shipstation_id}`
    );
    const shipmentData = shipmentResponse.data;

    // Update order if we have new information
    const updates = {};
    if (
      shipmentData.tracking_number &&
      shipmentData.tracking_number !== order.tracking_number
    ) {
      updates.tracking_number = shipmentData.tracking_number;
    }
    if (
      shipmentData.carrier_id &&
      shipmentData.carrier_id !== order.carrier_id
    ) {
      updates.carrier_id = shipmentData.carrier_id;
    }

    if (Object.keys(updates).length > 0) {
      await Order.update(updates, { where: { id: orderId } });
    }

    res.status(200).json({
      success: true,
      message: "Shipment data refreshed successfully",
      data: {
        orderId: orderId,
        shipmentId: order.shipstation_id,
        previousTrackingNumber: order.tracking_number,
        currentTrackingNumber: shipmentData.tracking_number,
        shipmentStatus: shipmentData.shipment_status,
        carrierId: shipmentData.carrier_id,
        shipDate: shipmentData.ship_date,
        updates: updates,
        fullShipmentData: shipmentData,
      },
    });
  } catch (error) {
    console.error("Refresh shipment data error:", error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: "ShipEngine API Error",
        error: error.response.data.message || "Unable to refresh shipment data",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error refreshing shipment data",
      error: error.message,
    });
  }
};

// Helper function to start tracking updates (webhook subscription)
exports.startTrackingUpdates = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      attributes: ["id", "tracking_number", "carrier_id"],
    });

    if (!order || !order.tracking_number || !order.carrier_id) {
      return res.status(400).json({
        success: false,
        message: "Order not found or tracking number not available yet",
      });
    }

    const carrierCode = getCarrierCodeFromId(order.carrier_id);

    // Start tracking updates
    const trackingResponse = await shipengineAPI.post("/v1/tracking/start", {
      carrier_code: carrierCode,
      tracking_number: order.tracking_number,
    });

    res.status(200).json({
      success: true,
      message: "Tracking updates started successfully",
      data: {
        orderId: orderId,
        trackingNumber: order.tracking_number,
        carrierCode: carrierCode,
        trackingResponse: trackingResponse.data,
      },
    });
  } catch (error) {
    console.error("Start tracking updates error:", error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: "ShipEngine API Error",
        error:
          error.response.data.message || "Unable to start tracking updates",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error starting tracking updates",
      error: error.message,
    });
  }
};

exports.getShipmentRates = async (req, res) => {
  try {
    const { orderId, sellerId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "first_name", "last_name", "phone"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const seller = await User.findByPk(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const orderItems = await OrderItem.findAll({
      where: {
        order_id: orderId,
        product_id: {
          [Op.in]: sequelize.literal(`(
            SELECT id FROM products WHERE user_id = '${sellerId}'
          )`),
        },
      },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "title", "price"],
        },
      ],
    });

    if (orderItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No order items found for this seller",
      });
    }

    const shippingAddress =
      typeof order.shipping_address === "string"
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;

    let businessAddress;
    try {
      businessAddress =
        typeof seller.business_address === "string"
          ? JSON.parse(seller.business_address)
          : seller.business_address;
    } catch (parseError) {
      businessAddress = {
        name: seller.company_name || `${seller.first_name} ${seller.last_name}`,
        company: seller.company_name,
        street1: "123 Business St",
        city: "Business City",
        state: "UT", // Hardcoded to Utah
        postal_code: "84101", // Utah ZIP code
        country: "US",
        phone: seller.phone,
      };
    }

    // Add buyer details to shipping address
    if (!shippingAddress.name && order.buyer) {
      shippingAddress.name = `${order.buyer.first_name} ${order.buyer.last_name}`;
    }

    const rateRequest = {
      rate_options: {
        carrier_ids: Object.values(SHIPENGINE_CONFIG.carriers),
        package_types: ["package"],
      },
      shipment: {
        ship_to: formatAddress(shippingAddress),
        ship_from: formatAddress({
          name:
            seller.company_name || `${seller.first_name} ${seller.last_name}`,
          company: seller.company_name,
          phone: seller.phone,
          ...businessAddress,
        }),
        packages: [calculatePackageDimensionsForRates(orderItems)],
      },
    };

    const ratesResponse = await shipengineAPI.post("/v1/rates", rateRequest);

    res.status(200).json({
      success: true,
      data: {
        orderId: orderId,
        sellerId: sellerId,
        rates: ratesResponse.data.rate_response?.rates || [],
        rateDetails: ratesResponse.data,
      },
    });
  } catch (error) {
    console.error("Get shipment rates error:", error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: "ShipEngine API Error",
        error: error.response.data.message || "Unable to fetch rates",
        details: error.response.data,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching shipment rates",
      error: error.message,
    });
  }
};

exports.updateShipmentStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const order = await Order.findByPk(orderId, { transaction });
    if (!order || !order.shipstation_id) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Order or shipment not found",
      });
    }

    await OrderItem.update(
      { order_status: status },
      {
        where: { order_id: orderId },
        transaction,
      }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: {
        orderId: orderId,
        newStatus: status,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update shipment status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating shipment status",
      error: error.message,
    });
  }
};
