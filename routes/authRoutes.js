
import express from "express";
import { deleteProfilePicture, getProfilePicture, loginUser, logoutUser, registerUser, updateUserProfile, upload, uploadProfilePicture } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/profile/upload", protect, upload.single("profilePicture"), uploadProfilePicture);
router.delete("/profile/delete", protect, deleteProfilePicture);
router.get("/profile", protect, getProfilePicture);
router.put("/profile/update", protect,upload.single("profilePicture"), updateUserProfile);
router.get("/logout", logoutUser);

export const authRouter = router;
