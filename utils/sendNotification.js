// utils/sendNotification.js
import admin from "./firebase.js"; // यह firebase-admin config वाली फाइल है
import { Store } from "../models/Store.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import { Address } from "../models/Address.js";
import { getFcmTokenByUserId } from "./getFcmToken.js"; // 👉 यह function तुझे बनाना होगा (DB से token निकालने के लिए)

// 🚀 Send Notification Function
export const sendNotification = async ({ shippingAddress, storeId, productId, price, quantity }) => {
  try {
    // 1️⃣ Find Store
    const store = await Store.findById(storeId);
    if (!store) throw new Error("Store not found");

    // 2️⃣ Find Product
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    // 3️⃣ Get Store Owner  FCM Token
    const fcmToken = await getFcmTokenByUserId(store.owner);
    if (!fcmToken) throw new Error("No FCM token found for store owner");

    // 4️⃣ Google Maps URL बनाना (lat, lng से)
    let mapUrl = "";
    if (shippingAddress?.coordinates?.length === 2) {
      const coords = shippingAddress.coordinates;
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
    }

    // 5️⃣ Notification Payload
    const payload = {
      notification: {
        title: `New Order Request`,
        body: `${product.name} × ${quantity} for ₹${price}`,
      },
      data: {
        productId: product._id.toString(),
        productName: product.name,
        price: product.price.toString(),
        quantity: quantity.toString(),

        mapUrl: mapUrl || "",
        orderType: "medical", // Optional tag
      },
    };
console.log(fcmToken)
    // 6️⃣ Send Notification via FCM
    const response = await admin.messaging().sendToDevice(fcmToken, payload);

    return { success: true, response };
  } catch (err) {
    console.error("Notification error:", err.message);
    return { success: false, error: err.message };
  }
};
