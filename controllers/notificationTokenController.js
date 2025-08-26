import { NotificationToken } from '../models/NotificationToken.js';
import { User } from '../models/User.js'; // Assuming you have a User model

// Create or update a notification token
export const createOrUpdateToken = async (req, res) => {
  try {
    const { fcmToken, deviceType, ...optionalFields } = req.body;
    const userId = req.user.id; // Assuming user is authenticated

    // Required validation
    if (!fcmToken || !deviceType) {
      return res.status(400).json({
        success: false,
        message: "FCM token, device type are required"
      });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check existing active token for this device
    let token = await NotificationToken.findOne({
      userId,

      isActive: true
    });

    if (token) {
      // Update existing token
      token.fcmToken = fcmToken;
      token.deviceType = deviceType;
      token.lastUsed = new Date();

      // Merge optional fields if provided
      Object.keys(optionalFields).forEach(key => {
        if (optionalFields[key]) {
          token[key] = optionalFields[key];
        }
      });
    } else {
      // Create new token
      token = new NotificationToken({
        userId,
        fcmToken,
        deviceType,

        ...optionalFields
      });
    }

    await token.save();

    res.status(200).json({
      success: true,
      message: token.isNew ? "Token created successfully" : "Token updated successfully",
      data: token
    });
  } catch (error) {
    console.error("Error in createOrUpdateToken:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


// Deactivate a specific token
export const deactivateToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user.id;

    const token = await NotificationToken.findOne({ _id: tokenId, userId });

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Token not found"
      });
    }

    await token.deactivate();

    res.status(200).json({
      success: true,
      message: "Token deactivated successfully"
    });
  } catch (error) {
    console.error("Error in deactivateToken:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Deactivate all tokens for a user
export const deactivateAllUserTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await NotificationToken.deactivateAllUserTokens(userId);

    res.status(200).json({
      success: true,
      message: `Deactivated ${result.modifiedCount} tokens`,
      data: result
    });
  } catch (error) {
    console.error("Error in deactivateAllUserTokens:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get all active tokens for a user
export const getUserTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const tokens = await NotificationToken.findActiveByUserId(userId);

    res.status(200).json({
      success: true,
      data: tokens,
      count: tokens.length
    });
  } catch (error) {
    console.error("Error in getUserTokens:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export const getUserToken = async (req, res) => {
  const userId = req.user.id;
  try {
    const token = await NotificationToken.findOne({
      userId: userId
    });
    return res.json(token);
  } catch (error) {
    return res.json({
      message: "server error",
      error: error.message
    });
  }
}
// Get token by ID
export const getTokenById = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user.id;

    const token = await NotificationToken.findOne({ _id: tokenId, userId });

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Token not found"
      });
    }

    res.status(200).json({
      success: true,
      data: token
    });
  } catch (error) {
    console.error("Error in getTokenById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Clean up expired tokens (admin function)
export const cleanupExpiredTokens = async (req, res) => {
  try {
    // Get all active tokens
    const activeTokens = await NotificationToken.find({ isActive: true });

    let deactivatedCount = 0;

    // Check each token for expiration
    for (const token of activeTokens) {
      if (token.isExpired()) {
        await token.deactivate();
        deactivatedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Cleaned up ${deactivatedCount} expired tokens`
    });
  } catch (error) {
    console.error("Error in cleanupExpiredTokens:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};