// utils/addressHelper.js

import { Address } from "../models/Address.js";

/**
 * Create a new address for a user
 * @param {Object} addressData - Address fields
 * @returns {Promise<Object>} Created Address Document
 */
export const createAddress = async (addressData) => {
  try {
    // required fields check
    if (!addressData.user) throw new Error("User reference is required");
    // if (!addressData.contactNumber) throw new Error("Contact number is required");
    if (!addressData.coordinates) throw new Error("Coordinates [lng, lat] are required");

    // create address
    const address = new Address(addressData);
    await address.save();

    return {
      success: true,
      message: "Address created successfully",
      data: address
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      error
    };
  }
};
