const Shipment = require("../../../models/shipment.model");
const ShipmentItem = require("../../../models/shipmentItems.model");
const OrderItem = require("../../../models/orderItem");
const Order = require("../../../models/order.model");
const { Product } = require("../../../models/product.modal");
const User = require("../../../models/user.model");
const UPSService = require("./upsServices");
const { Op } = require("sequelize");

class ShipmentService {
  // Validate addresses before sending to UPS
  validateAddress(address, type = "shipping") {
    const errors = [];

    if (!address.line1 || address.line1.trim().length < 3) {
      errors.push(
        `${type} address line1 is required and must be at least 3 characters`
      );
    }

    if (!address.city || address.city.trim().length < 2) {
      errors.push(`${type} city is required and must be at least 2 characters`);
    }

    // Validate US state codes
    const validStates = [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
    ];

    if (!address.state || !validStates.includes(address.state.toUpperCase())) {
      errors.push(
        `${type} state must be a valid US state code (e.g., UT, CA, NY)`
      );
    }

    // Validate postal code format (US ZIP codes)
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!address.postalCode || !zipRegex.test(address.postalCode)) {
      errors.push(
        `${type} postal code must be a valid US ZIP code (e.g., 84101 or 84101-1234)`
      );
    }

    if (errors.length > 0) {
      throw new Error(`Address validation failed:\n${errors.join("\n")}`);
    }
  }

  // Create shipments for approved order items
  async createShipmentsForOrder(orderId) {
    try {
      // Get all approved order items for this order
      const approvedItems = await OrderItem.findAll({
        where: {
          order_id: orderId,
          order_status: "approved",
        },
        include: [
          {
            model: Product,
            as: "product",
            include: [{ model: User, as: "seller" }],
          },
        ],
      });

      if (approvedItems.length === 0) {
        return {
          success: false,
          message: "No approved items found for shipment",
        };
      }

      // Get order details
      const order = await Order.findByPk(orderId, {
        include: [{ model: User, as: "buyer" }],
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Group items by seller
      const itemsBySeller = approvedItems.reduce((acc, item) => {
        const sellerId = item.product.user_id;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
      }, {});

      const createdShipments = [];

      // Create shipment for each seller
      for (const [sellerId, items] of Object.entries(itemsBySeller)) {
        const seller = items[0].product.seller;

        // Calculate total weight and dimensions
        let totalWeight = 0;
        let maxLength = 0,
          maxWidth = 0,
          maxHeight = 0;

        items.forEach((item) => {
          const product = item.product;
          totalWeight += (product.weight || 1) * item.quantity;
          maxLength = Math.max(maxLength, product.length || 10);
          maxWidth = Math.max(maxWidth, product.width || 8);
          maxHeight = Math.max(maxHeight, product.height || 6);
        });

        // Create shipment record
        const shipment = await Shipment.create({
          order_id: orderId,
          seller_id: sellerId,
          weight: totalWeight,
          dimensions: {
            length: maxLength,
            width: maxWidth,
            height: maxHeight,
          },
          shipping_address: order.shipping_address,
          shipper_address: {
            name:
              seller.company_name || `${seller.first_name} ${seller.last_name}`,
            line1: seller.business_address || "123 Seller St",
            city: seller.city || "Salt Lake City",
            state: "UT",
            postalCode: seller.postal_code || "84101",
            countryCode: "US",
          },
          status: "pending",
        });

        // Add items to shipment
        for (const item of items) {
          await ShipmentItem.create({
            shipment_id: shipment.id,
            order_item_id: item.id,
            quantity: item.quantity,
          });
        }

        createdShipments.push(shipment);
      }

      return {
        success: true,
        message: `Created ${createdShipments.length} shipment(s)`,
        shipments: createdShipments,
      };
    } catch (error) {
      console.error("Create Shipments Error:", error);
      throw error;
    }
  }

  // Process UPS shipment creation
  async processUPSShipment(shipmentId) {
    try {
      const shipment = await Shipment.findByPk(shipmentId, {
        include: [
          {
            model: ShipmentItem,
            as: "items",
            include: [
              {
                model: OrderItem,
                as: "order_item",
                include: [{ model: Product, as: "product" }],
              },
            ],
          },
          {
            model: Order,
            as: "order",
            include: [{ model: User, as: "buyer" }],
          },
          { model: User, as: "seller" },
        ],
      });

      if (!shipment) {
        throw new Error("Shipment not found");
      }

      const order = shipment.order;
      const seller = shipment.seller;
      const shippingAddr = order.shipping_address;

      console.log("Shipping Address:", JSON.stringify(shippingAddr, null, 2));

      // Parse the shipping address properly
      let shipToName = "Customer";
      let shipToPhone = "1234567890";
      let addressDetails = {};

      if (typeof shippingAddr === "string") {
        try {
          const parsedAddr = JSON.parse(shippingAddr);
          shipToName =
            parsedAddr.name ||
            `${parsedAddr.firstName || ""} ${
              parsedAddr.lastName || ""
            }`.trim() ||
            "Customer";
          shipToPhone = parsedAddr.phone || "1234567890";
          addressDetails = parsedAddr.address || parsedAddr;
        } catch (e) {
          console.error("Error parsing shipping address:", e);
          throw new Error("Invalid shipping address format");
        }
      } else if (typeof shippingAddr === "object") {
        shipToName =
          shippingAddr.name ||
          `${shippingAddr.firstName || ""} ${
            shippingAddr.lastName || ""
          }`.trim() ||
          "Customer";
        shipToPhone = shippingAddr.phone || "1234567890";
        addressDetails = shippingAddr.address || shippingAddr;
      }

      // Validate required address fields
      if (!addressDetails.line1) {
        throw new Error("Shipping address line1 is required");
      }
      if (!addressDetails.city) {
        throw new Error("Shipping address city is required");
      }
      if (!addressDetails.state) {
        throw new Error("Shipping address state is required");
      }
      if (!addressDetails.postalCode && !addressDetails.postal_code) {
        throw new Error("Shipping address postal code is required");
      }

      // Handle both postalCode and postal_code fields and clean the value
      const cleanPostalCode = (
        addressDetails.postalCode ||
        addressDetails.postal_code ||
        ""
      )
        .toString()
        .trim();

      if (!cleanPostalCode) {
        throw new Error("Shipping address postal code cannot be empty");
      }

      // Validate postal code format for US addresses
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(cleanPostalCode)) {
        throw new Error(
          `Invalid postal code format: ${cleanPostalCode}. Must be in format 12345 or 12345-6789`
        );
      }

      console.log("Cleaned postal code:", cleanPostalCode);

      // Prepare UPS shipment data
      const shipmentData = {
        orderId: order.id,
        shipper: {
          name:
            seller.company_name || `${seller.first_name} ${seller.last_name}`,
          attentionName: `${seller.first_name} ${seller.last_name}`,
          phone: seller.phone || "1234567890",
        },
        shipFrom: {
          name:
            seller.company_name || `${seller.first_name} ${seller.last_name}`,
          attentionName: `${seller.first_name} ${seller.last_name}`,
          phone: seller.phone || "1234567890",
          address: {
            line1: seller.business_address || "456 Business Park Dr",
            city: seller.city || "Salt Lake City",
            state: "UT",
            postalCode: seller.postal_code || "84101",
            countryCode: "US",
          },
        },
        shipTo: {
          name: shipToName,
          attentionName: shipToName,
          phone: shipToPhone,
          address: {
            line1: addressDetails.line1,
            city: addressDetails.city,
            state: addressDetails.state,
            postalCode: cleanPostalCode,
            countryCode: addressDetails.countryCode || "US",
          },
          residential: addressDetails.residential || true,
        },
        packages: [
          {
            weight: Math.max(shipment.weight, 1),
            dimensions: shipment.dimensions,
            description: `Order ${order.id} items`,
          },
        ],
        serviceCode: shipment.service_code || "03",
        serviceDescription: shipment.service_description || "Ground",
      };

      console.log("UPS Shipment Data:", JSON.stringify(shipmentData, null, 2));

      // Create UPS shipment
      const upsResponse = await UPSService.createShipment(shipmentData);

      console.log(
        "UPS Response received:",
        JSON.stringify(upsResponse, null, 2)
      );

      // Check for successful response
      if (
        upsResponse.ShipmentResponse &&
        upsResponse.ShipmentResponse.ShipmentResults
      ) {
        const shipmentResults = upsResponse.ShipmentResponse.ShipmentResults;
        const packageResults = shipmentResults.PackageResults;

        // Extract tracking number and label
        const trackingNumber = packageResults.TrackingNumber;
        const labelUrl = packageResults.ShippingLabel
          ? packageResults.ShippingLabel.GraphicImage
          : null;
        const shipmentId = shipmentResults.ShipmentIdentificationNumber;

        console.log("Extracted data:", {
          trackingNumber,
          shipmentId,
          hasLabel: !!labelUrl,
        });

        // Update shipment with UPS data
        await shipment.update({
          tracking_number: trackingNumber,
          ups_shipment_id: shipmentId,
          status: "created",
          label_url: labelUrl,
          ups_response: upsResponse,
        });

        // Update order items status to shipped
        await OrderItem.update(
          { order_status: "shipped" },
          {
            where: {
              id: {
                [Op.in]: shipment.items.map((si) => si.order_item_id),
              },
            },
          }
        );

        return {
          success: true,
          trackingNumber,
          labelUrl,
          shipment,
        };
      } else {
        console.error(
          "Unexpected UPS response structure:",
          JSON.stringify(upsResponse, null, 2)
        );
        throw new Error("Invalid UPS response structure");
      }
    } catch (error) {
      console.error("Process UPS Shipment Error:", error);

      // Update shipment status to failed
      await Shipment.update(
        { status: "exception" },
        { where: { id: shipmentId } }
      );

      throw error;
    }
  }

  // Schedule pickup for shipment
  async schedulePickup(shipmentId, pickupData) {
    try {
      const shipment = await Shipment.findByPk(shipmentId, {
        include: [
          { model: User, as: "seller" },
          { model: Order, as: "order" },
        ],
      });

      if (!shipment) {
        throw new Error("Shipment not found");
      }

      if (shipment.status !== "created") {
        throw new Error("Shipment must be created before scheduling pickup");
      }

      const seller = shipment.seller;

      const pickupPayload = {
        companyName:
          seller.company_name || `${seller.first_name} ${seller.last_name}`,
        contactName: `${seller.first_name} ${seller.last_name}`,
        phone: seller.phone || "1234567890",
        address: {
          line1: seller.business_address || "456 Business Park Dr",
          city: seller.city || "Salt Lake City",
          state: "UT",
          postalCode: seller.postal_code || "84101",
          countryCode: "US",
        },
        pickupDate: pickupData.pickupDate, // YYYYMMDD format
        readyTime: pickupData.readyTime || "0900",
        closeTime: pickupData.closeTime || "1700",
        serviceCode: shipment.service_code || "03",
        quantity: "1",
        weight: shipment.weight,
      };

      const pickupResponse = await UPSService.schedulePickup(pickupPayload);

      if (pickupResponse.PickupCreationResponse) {
        const pickupNumber = pickupResponse.PickupCreationResponse.PRN;

        // Update shipment with pickup information
        await shipment.update({
          pickup_request_number: pickupNumber,
          pickup_date: pickupData.pickupDate,
          pickup_ready_time: pickupData.readyTime,
          pickup_close_time: pickupData.closeTime,
          status: "pickup_scheduled",
          ups_pickup_response: pickupResponse,
        });

        return {
          success: true,
          pickupNumber,
          shipment,
        };
      } else {
        throw new Error("Invalid pickup response from UPS");
      }
    } catch (error) {
      console.error("Schedule Pickup Error:", error);
      throw error;
    }
  }

  // Cancel pickup
  async cancelPickup(shipmentId) {
    try {
      const shipment = await Shipment.findByPk(shipmentId);

      if (!shipment || !shipment.pickup_request_number) {
        throw new Error("Shipment or pickup request number not found");
      }

      const cancelResponse = await UPSService.cancelPickup(
        shipment.pickup_request_number
      );

      // UPS cancel pickup may return empty response on success
      if (cancelResponse || cancelResponse === "") {
        await shipment.update({
          pickup_request_number: null,
          pickup_date: null,
          pickup_ready_time: null,
          pickup_close_time: null,
          status: "created",
          ups_pickup_response: null,
        });

        return {
          success: true,
          message: "Pickup cancelled successfully",
        };
      } else {
        throw new Error("Failed to cancel pickup");
      }
    } catch (error) {
      console.error("Cancel Pickup Error:", error);
      throw error;
    }
  }

  // ENHANCED Track shipment and update status with simulation support
  async trackAndUpdateShipment(shipmentId, simulateStatus = null) {
    try {
      const shipment = await Shipment.findByPk(shipmentId);

      if (!shipment || !shipment.tracking_number) {
        throw new Error("Shipment or tracking number not found");
      }

      // In development mode, allow status simulation
      let trackingData;
      if (process.env.NODE_ENV !== "production" && simulateStatus) {
        console.log(`🔧 Simulating tracking status: ${simulateStatus}`);
        trackingData = await UPSService.trackShipment(
          shipment.tracking_number,
          simulateStatus
        );
      } else {
        trackingData = await UPSService.trackShipment(shipment.tracking_number);
      }

      if (trackingData.trackResponse) {
        const trackInfo = trackingData.trackResponse.shipment[0];
        const activities = trackInfo.package[0].activity || [];

        // Update tracking events
        await shipment.update({
          tracking_events: activities,
        });

        // Update status based on latest activity
        if (activities.length > 0) {
          const latestActivity = activities[0];
          const statusCode = latestActivity.status.code;

          let newStatus = shipment.status;

          if (statusCode === "D") {
            newStatus = "delivered";
            await shipment.update({
              actual_delivery_date: new Date(
                latestActivity.date + " " + (latestActivity.time || "120000")
              ),
            });

            // Update order items to delivered
            await OrderItem.update(
              { order_status: "delivered" },
              {
                where: {
                  id: {
                    [Op.in]: await ShipmentItem.findAll({
                      where: { shipment_id: shipmentId },
                      attributes: ["order_item_id"],
                    }).then((items) => items.map((item) => item.order_item_id)),
                  },
                },
              }
            );
          } else if (
            statusCode === "I" ||
            statusCode === "AR" ||
            statusCode === "DP"
          ) {
            newStatus = "in_transit";
          } else if (statusCode === "OFD") {
            newStatus = "out_for_delivery";
          } else if (statusCode === "X") {
            newStatus = "exception";
          } else if (statusCode === "MP") {
            // Maintain current status for manifest pickup
            if (simulateStatus === "shipped") {
              newStatus = "shipped";
            }
          }

          await shipment.update({ status: newStatus });
        }

        return {
          success: true,
          trackingData: activities,
          status: shipment.status,
          currentActivity: activities[0] || null,
        };
      }
    } catch (error) {
      console.error("Track Shipment Error:", error);
      throw error;
    }
  }

  // Get available tracking simulation statuses for development
  getAvailableSimulationStatuses() {
    return [
      { key: "created", label: "Shipment Created" },
      { key: "pickup_scheduled", label: "Pickup Scheduled" },
      { key: "shipped", label: "Picked Up / Shipped" },
      { key: "in_transit", label: "In Transit" },
      { key: "out_for_delivery", label: "Out for Delivery" },
      { key: "delivered", label: "Delivered" },
      { key: "exception", label: "Delivery Exception" },
    ];
  }

  // Handle return shipment
  async handleReturnShipment(shipmentId, returnReason) {
    try {
      const shipment = await Shipment.findByPk(shipmentId, {
        include: [
          { model: User, as: "seller" },
          {
            model: Order,
            as: "order",
            include: [{ model: User, as: "buyer" }],
          },
        ],
      });

      if (!shipment) {
        throw new Error("Shipment not found");
      }

      // Create return shipment with buyer as shipper and seller as recipient
      const returnShipmentData = {
        orderId: `return-${shipment.order_id}`,
        shipper: {
          name: `${shipment.order.buyer.first_name} ${shipment.order.buyer.last_name}`,
          attentionName: `${shipment.order.buyer.first_name} ${shipment.order.buyer.last_name}`,
          phone: shipment.order.buyer.phone || "1234567890",
        },
        shipFrom: {
          name: `${shipment.order.buyer.first_name} ${shipment.order.buyer.last_name}`,
          attentionName: `${shipment.order.buyer.first_name} ${shipment.order.buyer.last_name}`,
          phone: shipment.order.buyer.phone || "1234567890",
          address: shipment.shipping_address,
        },
        shipTo: {
          name:
            shipment.seller.company_name ||
            `${shipment.seller.first_name} ${shipment.seller.last_name}`,
          attentionName: `${shipment.seller.first_name} ${shipment.seller.last_name}`,
          phone: shipment.seller.phone || "1234567890",
          address: shipment.shipper_address,
          residential: false,
        },
        packages: [
          {
            weight: shipment.weight,
            dimensions: shipment.dimensions,
            description: `Return for Order ${shipment.order_id}`,
          },
        ],
        serviceCode: "03", // UPS Ground for returns
        serviceDescription: "Ground",
      };

      const returnResponse = await UPSService.createShipment(
        returnShipmentData
      );

      if (
        returnResponse.ShipmentResponse &&
        returnResponse.ShipmentResponse.ShipmentResults
      ) {
        const returnResults = returnResponse.ShipmentResponse.ShipmentResults;
        const returnPackageResults = returnResults.PackageResults;

        // Create return shipment record
        const returnShipment = await Shipment.create({
          order_id: shipment.order_id,
          seller_id: shipment.seller_id,
          tracking_number: returnPackageResults.TrackingNumber,
          ups_shipment_id: returnResults.ShipmentIdentificationNumber,
          carrier: "UPS",
          service_code: "03",
          service_description: "Ground Return",
          weight: shipment.weight,
          dimensions: shipment.dimensions,
          shipping_address: shipment.shipper_address,
          shipper_address: shipment.shipping_address,
          status: "created",
          label_url: returnPackageResults.ShippingLabel
            ? returnPackageResults.ShippingLabel.GraphicImage
            : null,
          ups_response: returnResponse,
          return_reason: returnReason,
          original_shipment_id: shipmentId,
        });

        // Update original shipment status
        await shipment.update({
          status: "returned",
          return_shipment_id: returnShipment.id,
        });

        // Update order items to returned
        await OrderItem.update(
          { order_status: "returned" },
          {
            where: {
              id: {
                [Op.in]: await ShipmentItem.findAll({
                  where: { shipment_id: shipmentId },
                  attributes: ["order_item_id"],
                }).then((items) => items.map((item) => item.order_item_id)),
              },
            },
          }
        );

        return {
          success: true,
          returnShipment,
          returnTrackingNumber: returnPackageResults.TrackingNumber,
        };
      } else {
        throw new Error("Failed to create return shipment");
      }
    } catch (error) {
      console.error("Handle Return Shipment Error:", error);
      throw error;
    }
  }

  // Void shipment (if not yet picked up)
  async voidShipment(shipmentId) {
    try {
      const shipment = await Shipment.findByPk(shipmentId);

      if (!shipment || !shipment.ups_shipment_id) {
        throw new Error("Shipment or UPS shipment ID not found");
      }

      if (shipment.status === "in_transit" || shipment.status === "delivered") {
        throw new Error(
          "Cannot void shipment that is already in transit or delivered"
        );
      }

      // Pass both shipment ID and tracking number to void method
      const voidResponse = await UPSService.voidShipment(
        shipment.ups_shipment_id,
        shipment.tracking_number
      );

      // Check for successful void response (can be empty object/string in UPS API)
      if (voidResponse !== undefined) {
        await shipment.update({
          status: "cancelled",
          tracking_number: null,
          ups_shipment_id: null,
          label_url: null,
        });

        // Update order items back to approved status
        await OrderItem.update(
          { order_status: "approved" },
          {
            where: {
              id: {
                [Op.in]: await ShipmentItem.findAll({
                  where: { shipment_id: shipmentId },
                  attributes: ["order_item_id"],
                }).then((items) => items.map((item) => item.order_item_id)),
              },
            },
          }
        );

        return {
          success: true,
          message: "Shipment voided successfully",
        };
      } else {
        throw new Error("Failed to void shipment - Invalid response from UPS");
      }
    } catch (error) {
      console.error("Void Shipment Error:", error);
      throw error;
    }
  }

  // Get delivery fee for checkout
  async getDeliveryFee(orderItems, shippingAddress) {
    try {
      // Get seller addresses
      const sellerIds = [
        ...new Set(orderItems.map((item) => item.product.user_id)),
      ];
      const sellers = await User.findAll({
        where: { id: { [Op.in]: sellerIds } },
      });

      const sellerAddresses = {};
      sellers.forEach((seller) => {
        sellerAddresses[seller.id] = {
          name:
            seller.company_name || `${seller.first_name} ${seller.last_name}`,
          line1: seller.business_address || "123 Seller St",
          city: seller.city || "Salt Lake City",
          state: "UT",
          postalCode: seller.postal_code || "84101",
          countryCode: "US",
        };
      });

      return await UPSService.calculateDeliveryFee(
        orderItems,
        shippingAddress,
        sellerAddresses
      );
    } catch (error) {
      console.error("Get Delivery Fee Error:", error);
      throw error;
    }
  }
}

module.exports = new ShipmentService();
