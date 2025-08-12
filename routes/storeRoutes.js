import express from "express";
import {
  listStores,
  getStoreById,
  createStore,
  updateStore,
  setApproval,
  updateRating,
  findNearby,
  deleteStore
} from "../controllers/storeController.js";
import { body, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", listStores);
router.get("/nearby", findNearby);
router.get("/:id", getStoreById);

// Protected routes
router.post(
  "/",
  protect,
  [
    body("name").isString().isLength({ min: 3 }),
    body("address").isString().notEmpty(),
    body("phone").isString(),
    body("email").isEmail(),
   
    body("location.coordinates").isArray({ min: 2, max: 2 })
  ],
  createStore
);

router.put(
  "/:id",
  protect,
  [
    // optional validators depending on what can be updated
    body("email").optional().isEmail(),
    body("status").optional().isIn(["active", "inactive", "pending", "suspended"])
  ],
  updateStore
);

router.patch("/:id/approve", protect, setApproval);
router.patch("/:id/rating", protect, updateRating);
router.delete("/:id", protect, deleteStore);

export const storeRouter= router;
