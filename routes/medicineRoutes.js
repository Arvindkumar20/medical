// routes/medicineRoutes.js
import express from "express";
import { getMedicineData } from "../controllers/medicineController.js";

const router = express.Router();

router.get("/", getMedicineData);

export const medicineRouter= router;
