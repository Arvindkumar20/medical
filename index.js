import "dotenv/config";
import express from "express";
import { connectDB } from "./config/db.js";
import { authRouter } from "./routes/authRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { productRouter } from "./routes/productRoutes.js";
import { storeRouter } from "./routes/storeRoutes.js";
// import { protect } from "./middlewares/authMiddleware.js";
import { categoryRoute } from "./routes/categoryRoutes.js";
import { parentCategory } from "./routes/parentCategoryRoutes.js";
import { orderRouter } from "./routes/orderRoutes.js";
import { medicalUploadRouter } from "./routes/medicalUploadRoutes.js";
// import { paymentRouter } from "./routes/paymentRoutes.js";
import docProductRoute from './routes/docProductRoute.js';
import { createUploadsDir } from "./utils/fileUtils.js";
import { cartRouter } from "./routes/cartRoute.js";
import { notificationRouter } from "./routes/notificationRoutes.js";
import { fcmTokenRouter } from "./routes/notificationToken.js";
import cors from "cors";

const app = express();

// connect to database
connectDB();

// body parsers
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/auth", authRouter);
app.use("/api/product", productRouter);
app.use("/api/store", storeRouter);
app.use("/api/category", categoryRoute);
app.use("/api/parent-category", parentCategory);
app.use("/api/order", orderRouter);
app.use("/api/upload-medical-report", medicalUploadRouter);
app.use("/api/cart", cartRouter)

app.use('/api/products', docProductRoute);
app.use('/api/notifications', notificationRouter);
app.use("/api/fcm-token",fcmTokenRouter);

// Create uploads directory;
createUploadsDir();
// health check (optional);
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// error handler (must be after routes);
app.use(errorHandler);

// start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
