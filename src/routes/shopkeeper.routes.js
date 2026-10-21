import { Router } from "express";
import { registerShopkeeper, loginShopkeeper, logoutShopkeeper, refreshAccessToken,getCurrentUser,verifyEmail, resendVerification } from "../controllers/shopkeeper.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { loginLimiter ,resendLimiter } from "../middlewares/rateLimiter.middleware.js";
import { originCheck } from "../middlewares/originCheck.middleware.js";


const userRouter = Router();

userRouter.route("/register").post(registerShopkeeper);
userRouter.route("/login").post(loginLimiter,loginShopkeeper);
//secured Routes
userRouter.route("/logout").post(originCheck,logoutShopkeeper);
userRouter.route("/refresh-token").post(refreshAccessToken);
userRouter.get("/me", verifyJWT, getCurrentUser);
userRouter.post("/verify",verifyEmail);
userRouter.post("/resend-verification", resendLimiter, resendVerification);


export  {userRouter};