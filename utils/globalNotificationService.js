// utils/notificationService.js

import { Notification } from "../models/Notification.js";
import admin from "./firebase.js";
import { getFcmTokenByUserId } from "./getFcmToken.js";

export const sendNotification = async ({ userId, title, body, data = {}, type = "general" }) => {
    let fcmToken;
try {
      fcmToken = await getFcmTokenByUserId(store.owner);
    
} catch (error) {
    return res.json({
        message:"fcmToken problem",
        error:error.message
    })
}        if (!fcmToken) throw new Error("No FCM token found for store owner");
  try {
    // 1. Firebase message object
    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        type,
      },
    };

    // 2. Send to Firebase
    const notify=await admin.messaging().send(message);
    // 3. Save only after successful send
    const savedNotification = await Notification.create({
      user: userId,
      title,
      body,
      data,
      type,
    });

    return {
      success: true,
      message: "Notification sent & saved successfully",
      notification: savedNotification,
      notify:notify
    };
  } catch (error) {
    console.error("Notification Error:", error.message);
    return {
      success: false,
      message: "Failed to send notification",
      error: error.message,
    };
  }
};
