// controllers/medicineController.js
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const MERCHANT_ID = "your_merchant_id";   // 1mg se milega
const PRIVATE_KEY = "your_private_key";   // 1mg se milega
const BASE_URL = "https://partner.1mg.com/api/v1"; // docs check karo

// ✅ JWT Token generate
function generateToken() {
  const payload = {
    iss: MERCHANT_ID, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 5,
  };
  return jwt.sign(payload, PRIVATE_KEY, { algorithm: "HS256" });
}

// ✅ Search API → skuId fetch
async function getSkuId(query) {
  const token = generateToken();
  const res = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Platform": "web",
      "X-City": "Lucknow"
    }
  });
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].skuId; // first match return kar rahe
  }
  return null;
}

// ✅ Product details (dynamic)
async function getProductDetails(skuId) {
  const token = generateToken();
  const res = await fetch(`${BASE_URL}/drug-dynamic?skuId=${skuId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Platform": "web",
      "X-City": "delhi"
    }
  });
  return res.json();
}

// ✅ Controller: name → skuId → product data
export const getMedicineData = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, message: "Medicine name required" });
    }

    // Step 1: skuId fetch
    const skuId = await getSkuId(name);
    if (!skuId) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    // Step 2: product data fetch
    const productData = await getProductDetails(skuId);

    return res.json({
      success: true,
      skuId,
      product: productData
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
