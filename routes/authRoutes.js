// const express = require("express");
// const router = express.Router();
// const { registerUser, loginUser } = require("../controllers/authController");

import express from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/get",protect, (req,res)=>{
return res.json({
    message:"ghurht   auth "
})
});
router.get("/logout", logoutUser);

export const authRouter = router;
