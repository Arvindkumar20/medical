// utils/getFcmToken.js
import { NotificationToken } from "../models/NotificationToken.js";

export const getFcmTokenByUserId = async (userId) => {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const tokenDoc = await NotificationToken.findOne({ userId });

    if (!tokenDoc) {
      return null; 
    }

    return tokenDoc.fcmToken; 
  } catch (error) {
    console.error("Error fetching FCM token:", error.message);
    throw error;
  }
};
