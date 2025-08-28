import axios from "axios";
import { Order } from "../models/Order.js";
import { sendNotification } from "./sendNotification.js";
import { logger } from "./logger.js";
import { Store } from "../models/Store.js";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export const handleStoreNotification = async (orderId, shippingAddress, quantity, total) => {
  let isConfirmed = false;
  console.log(shippingAddress.coordinates[0], shippingAddress.coordinates[1])
  try {
    // 1. Fetch nearest stores (list)
    // const { data: stores } = await axios.get(
    //   `${process.env.BASE_URL}/api/store/nearby?lat=${shippingAddress.coordinates[1]}&lan=${shippingAddress.coordinates[0]}&limit=10`
    // );
    const stores = await axios.get(`http://localhost:5000/api/store/nearby?lng=${shippingAddress.coordinates[0]}&lat=${shippingAddress.coordinates[1]}&maxDistance=10000`);
    console.log(stores.data);
    if (!stores.data || stores.data.length === 0) {
      logger.warn("No stores available for order", { orderId });
      await Order.findByIdAndUpdate(orderId, { status: "cancelled" });
      return;
    }

    // 2. Try each store one by one
    const storeArray = stores.data.data;
    for (const store of storeArray) {
      if (isConfirmed) break;

      logger.info("Sending notification to store", { orderId, storeId: store.id });

      await sendNotification(shippingAddress, store.id, orderId, total, quantity);

      // Wait for store confirmation (10 seconds)
      await sleep(10000);

      const order = await Order.findById(orderId);
      if (order && order.orderStatus === "confirmed") {
        isConfirmed = true;
        await Notification.create({
          userId: "6890f11939afc893aaa8a7fc",
          storeId: "6890fb1a51bb7bc2e3e8142b",
          productId: "689b1b4f5f7bb60073afd39d",
          message: `order confirmed`
        });
        logger.info("Order confirmed by store", { orderId, storeId: store.id });
        break;
      } else {
        logger.info("Store did not confirm order in 5s, trying next store", {
          orderId,
          storeId: store.id
        });
      }
    }

    // 3. If no store confirmed
    if (!isConfirmed) {
      await Order.findByIdAndUpdate(orderId, { orderStatus: "cancelled" });
      logger.warn("Order cancelled - no store confirmation", { orderId });
    }
  } catch (error) {

    logger.error("Error in store notification process", {
      orderId,
      error: error.message
    });
    await Order.findByIdAndUpdate(orderId, { orderStatus: "failed" });
  }
};
