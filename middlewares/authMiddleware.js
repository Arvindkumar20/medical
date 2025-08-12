// const jwt = require("jsonwebtoken");
import jwt from "jsonwebtoken"
import "dotenv/config"


export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    // const secret = process.env.JWT_SECRET;
    if (!process.env.JWT_SECRET) {
      // This is a server config issue; you might want to fail closed.
      return res.status(500).json({ success: false, message: "Server misconfigured" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      audience: "your-client-domain.com",
      issuer: "your-api-domain.com",
    });

    req.user = decoded; // e.g., { id, role, iat, exp, iss, aud }
    next();
  } catch (err) {
    console.log("Token verification failed:", err.message); // log for debugging
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};


// Optional: role-based access
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied" });
    next();
  };
};
