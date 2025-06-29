const axios = require("axios");

class UPSService {
  constructor() {
    // UPS API Configuration
    this.baseURL = process.env.UPS_API_BASE_URL || "https://wwwcie.ups.com"; // Use https://onlinetools.ups.com for production
    this.clientId = process.env.UPS_CLIENT_ID;
    this.clientSecret = process.env.UPS_CLIENT_SECRET;
    this.username = process.env.UPS_USERNAME;
    this.password = process.env.UPS_PASSWORD;
    this.accessKey = process.env.UPS_ACCESS_KEY;

    // Your UPS Account Numbers
    this.accountNumbers = {
      primary: "V5325C",
      secondary: "V533H8",
    };

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get OAuth token for UPS API
  async getAccessToken() {
    try {
      if (
        this.accessToken &&
        this.tokenExpiry &&
        new Date() < this.tokenExpiry
      ) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.baseURL}/security/v1/oauth/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`
            ).toString("base64")}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

      return this.accessToken;
    } catch (error) {
      console.error("UPS OAuth Error:", error.response?.data || error.message);
      throw new Error("Failed to authenticate with UPS API");
    }
  }

  // Create UPS shipment
  async createShipment(shipmentData) {
    try {
      const token = await this.getAccessToken();

      const upsPayload = {
        ShipmentRequest: {
          Request: {
            RequestOption: "nonvalidate",
            TransactionReference: {
              CustomerContext: `Order-${shipmentData.orderId}`,
            },
          },
          Shipment: {
            Description: "Package",
            Shipper: {
              Name: shipmentData.shipper.name,
              AttentionName: shipmentData.shipper.attentionName,
              TaxIdentificationNumber: shipmentData.shipper.taxId || "",
              Phone: {
                Number: shipmentData.shipper.phone,
              },
              ShipperNumber: shipmentData.upsAccountNumber,
              Address: {
                AddressLine: [shipmentData.shipper.address.line1],
                City: shipmentData.shipper.address.city,
                StateProvinceCode: shipmentData.shipper.address.state,
                PostalCode: shipmentData.shipper.address.postalCode,
                CountryCode: shipmentData.shipper.address.countryCode,
              },
            },
            ShipTo: {
              Name: shipmentData.shipTo.name,
              AttentionName: shipmentData.shipTo.attentionName,
              Phone: {
                Number: shipmentData.shipTo.phone,
              },
              Address: {
                AddressLine: [shipmentData.shipTo.address.line1],
                City: shipmentData.shipTo.address.city,
                StateProvinceCode: shipmentData.shipTo.address.state,
                PostalCode: shipmentData.shipTo.address.postalCode,
                CountryCode: shipmentData.shipTo.address.countryCode,
                ResidentialAddressIndicator: shipmentData.shipTo.residential
                  ? ""
                  : undefined,
              },
            },
            ShipFrom: {
              Name: shipmentData.shipFrom.name,
              AttentionName: shipmentData.shipFrom.attentionName,
              Phone: {
                Number: shipmentData.shipFrom.phone,
              },
              Address: {
                AddressLine: [shipmentData.shipFrom.address.line1],
                City: shipmentData.shipFrom.address.city,
                StateProvinceCode: shipmentData.shipFrom.address.state,
                PostalCode: shipmentData.shipFrom.address.postalCode,
                CountryCode: shipmentData.shipFrom.address.countryCode,
              },
            },
            PaymentInformation: {
              ShipmentCharge: {
                Type: "01", // Transportation charges
                BillShipper: {
                  AccountNumber: shipmentData.upsAccountNumber,
                },
              },
            },
            Service: {
              Code: shipmentData.serviceCode || "03", // 03 = UPS Ground
              Description: shipmentData.serviceDescription || "Ground",
            },
            Package: shipmentData.packages.map((pkg, index) => ({
              Description: pkg.description || "Package",
              Packaging: {
                Code: "02", // Customer Supplied Package
              },
              Dimensions: {
                UnitOfMeasurement: {
                  Code: "IN",
                },
                Length: pkg.dimensions.length.toString(),
                Width: pkg.dimensions.width.toString(),
                Height: pkg.dimensions.height.toString(),
              },
              PackageWeight: {
                UnitOfMeasurement: {
                  Code: "LBS",
                },
                Weight: pkg.weight.toString(),
              },
              ReferenceNumber: {
                Code: "02",
                Value: `Order-${shipmentData.orderId}-${index + 1}`,
              },
            })),
          },
          LabelSpecification: {
            LabelImageFormat: {
              Code: "GIF",
            },
            HTTPUserAgent: "Mozilla/4.5",
          },
        },
      };

      const response = await axios.post(
        `${this.baseURL}/api/shipments/v1/ship`,
        upsPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            transId: `order-${shipmentData.orderId}-${Date.now()}`,
            transactionSrc: "testing",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "UPS Create Shipment Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Track shipment
  async trackShipment(trackingNumber) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}/api/track/v1/details/${trackingNumber}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            transId: `track-${trackingNumber}-${Date.now()}`,
            transactionSrc: "testing",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "UPS Track Shipment Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Get shipping rates
  async getRates(rateData) {
    try {
      const token = await this.getAccessToken();

      const ratePayload = {
        RateRequest: {
          Request: {
            RequestOption: "Rate",
            TransactionReference: {
              CustomerContext: `Rate-${rateData.orderId}`,
            },
          },
          Shipment: {
            Shipper: {
              Name: rateData.shipper.name,
              ShipperNumber: rateData.upsAccountNumber,
              Address: {
                AddressLine: [rateData.shipper.address.line1],
                City: rateData.shipper.address.city,
                StateProvinceCode: rateData.shipper.address.state,
                PostalCode: rateData.shipper.address.postalCode,
                CountryCode: rateData.shipper.address.countryCode,
              },
            },
            ShipTo: {
              Name: rateData.shipTo.name,
              Address: {
                AddressLine: [rateData.shipTo.address.line1],
                City: rateData.shipTo.address.city,
                StateProvinceCode: rateData.shipTo.address.state,
                PostalCode: rateData.shipTo.address.postalCode,
                CountryCode: rateData.shipTo.address.countryCode,
                ResidentialAddressIndicator: rateData.shipTo.residential
                  ? ""
                  : undefined,
              },
            },
            ShipFrom: {
              Name: rateData.shipFrom.name,
              Address: {
                AddressLine: [rateData.shipFrom.address.line1],
                City: rateData.shipFrom.address.city,
                StateProvinceCode: rateData.shipFrom.address.state,
                PostalCode: rateData.shipFrom.address.postalCode,
                CountryCode: rateData.shipFrom.address.countryCode,
              },
            },
            Service: {
              Code: "03", // Get rates for all services
            },
            Package: rateData.packages.map((pkg) => ({
              PackagingType: {
                Code: "02",
              },
              Dimensions: {
                UnitOfMeasurement: {
                  Code: "IN",
                },
                Length: pkg.dimensions.length.toString(),
                Width: pkg.dimensions.width.toString(),
                Height: pkg.dimensions.height.toString(),
              },
              PackageWeight: {
                UnitOfMeasurement: {
                  Code: "LBS",
                },
                Weight: pkg.weight.toString(),
              },
            })),
          },
        },
      };

      const response = await axios.post(
        `${this.baseURL}/api/rating/v1/rate`,
        ratePayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            transId: `rate-${rateData.orderId}-${Date.now()}`,
            transactionSrc: "testing",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "UPS Get Rates Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

module.exports = new UPSService();
