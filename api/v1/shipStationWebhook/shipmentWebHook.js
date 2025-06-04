const { Order, OrderItem } = require("../../../models");
const { sequelize } = require("../../../config/db");

// Webhook handler for ShipStation events
exports.handleShipStationWebhook = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const webhookData = req.body;
    console.log(
      "ShipStation webhook received:",
      JSON.stringify(webhookData, null, 2)
    );

    // Verify webhook (you should implement proper verification)
    // For now, we'll process the webhook data directly

    const { resource_type, resource_url, data } = webhookData;

    if (
      resource_type === "shipment_shipped" ||
      resource_type === "shipment_delivered"
    ) {
      const shipmentData = data;
      const shipstationId = shipmentData.shipment_id;
      const trackingNumber = shipmentData.tracking_number;

      // Find order by shipstation_id
      const order = await Order.findOne({
        where: { shipstation_id: shipstationId },
        transaction,
      });

      if (!order) {
        console.log(`Order not found for shipstation_id: ${shipstationId}`);
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Update tracking number if not set
      if (!order.tracking_number && trackingNumber) {
        await Order.update(
          { tracking_number: trackingNumber },
          {
            where: { id: order.id },
            transaction,
          }
        );
      }

      // Determine new status based on webhook type
      let newStatus;
      switch (resource_type) {
        case "shipment_shipped":
          newStatus = "shipped";
          break;
        case "shipment_delivered":
          newStatus = "delivered";
          break;
        default:
          newStatus = "processing";
      }

      // Update order items status
      await OrderItem.update(
        { order_status: newStatus },
        {
          where: { order_id: order.id },
          transaction,
        }
      );

      await transaction.commit();

      console.log(`Order ${order.id} status updated to ${newStatus}`);

      res.status(200).json({
        success: true,
        message: `Order status updated to ${newStatus}`,
        orderId: order.id,
      });
    } else {
      // Handle other webhook types if needed
      console.log(`Unhandled webhook type: ${resource_type}`);
      res.status(200).json({
        success: true,
        message: "Webhook received but not processed",
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error("Webhook processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing webhook",
      error: error.message,
    });
  }
};

// Helper function to verify webhook signature (implement based on ShipStation docs)
const verifyWebhookSignature = (payload, signature, secret) => {
  // Implement signature verification logic here
  // This is important for security in production
  return true; // Placeholder
};
