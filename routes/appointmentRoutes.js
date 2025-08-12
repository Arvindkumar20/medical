// routes/appointmentRoutes.js
import express from "express";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment
} from "../controllers/appointmentController.js";
import { body, param, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  [
    query("patient").optional().isMongoId(),
    query("doctor").optional().isMongoId(),
    query("status").optional().isIn(["pending", "confirmed", "cancelled", "completed"]),
    query("date").optional().isISO8601(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 })
  ],
  listAppointments
);

router.get(
  "/:id",
  protect,
  [param("id").isMongoId()],
  getAppointment
);

router.post(
  "/",
  protect,
  [
    body("doctor").isMongoId(),
    body("symptoms").isString().isLength({ min: 10, max: 500 }),
    body("date").isISO8601(),
    body("time").matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("duration").optional().isInt({ min: 15, max: 120 }),
    body("status").optional().isIn(["pending", "confirmed", "cancelled", "completed"]),
    body("prescriptionGiven").optional().isBoolean(),
    body("notes").optional().isString().isLength({ max: 1000 })
  ],
  createAppointment
);

router.patch(
  "/:id",
  protect,
  [
    param("id").isMongoId(),
    body("symptoms").optional().isString().isLength({ min: 10, max: 500 }),
    body("date").optional().isISO8601(),
    body("time").optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("duration").optional().isInt({ min: 15, max: 120 }),
    body("status").optional().isIn(["pending", "confirmed", "cancelled", "completed"]),
    body("prescriptionGiven").optional().isBoolean(),
    body("notes").optional().isString().isLength({ max: 1000 })
  ],
  updateAppointment
);

router.delete(
  "/:id",
  protect,
  [param("id").isMongoId()],
  cancelAppointment
);

export const appointmentRouter= router;
