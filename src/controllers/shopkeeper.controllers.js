import { Shopkeeper } from "../models/shopkeeper.models.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { generateVerificationToken } from "../utils/VerificationToken.js";
import {sendEmail} from "../config/sendMail.js";
import crypto from "node:crypto";


const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

//Generating Tokens
const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await Shopkeeper.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating accesstoken and refresh token")
  }
}


//registerShopkeeper
const registerShopkeeper = asyncHandler(async (req, res) => {
  const { name, phone, password } = req.body;
  const rawEmail = req.body.email;

  if ([name, rawEmail, phone, password].some((f) => typeof f !== "string" || !f.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  const email = rawEmail.trim().toLowerCase();

  const userExists = await Shopkeeper.findOne({ email });
  if (userExists) {
    throw new ApiError(409, "Shopkeeper with this email already exists");
  }

  // Verification is on unless the environment says "off"
  const verificationRequired = process.env.EMAIL_VERIFICATION !== "off";

  const user = await Shopkeeper.create({
    name,
    email,
    phone,
    password,
    isEmailVerified: !verificationRequired,
  });

  if (verificationRequired) {
    try {
      await sendVerificationLink(user);
    } catch (error) {
      console.error("Verification email failed:", error);
      await Shopkeeper.findByIdAndDelete(user._id); // lets them register again
      throw new ApiError(502, "Could not send verification email. Please try again later.");
    }
  }

  const createdUser = await Shopkeeper.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpires"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      verificationRequired
        ? "Registered. Please verify your email."
        : "Account created. You can log in now.",
      { user: createdUser, emailVerificationRequired: verificationRequired }
    )
  );
});

//Send Verification Mail
const sendVerificationEmail = async (email, link) => {
  await sendEmail({
    to: email,
    subject: "Verify your Shopkeeper account",
    text: "Please verify your email address.",
    html: `<h2>Welcome!</h2><p>Please verify your email address.</p>
    <a href="${link}">Click Here To Verify</a>`,
  });
};
const sendVerificationLink = async (user) => {
  const { token, hashedToken } = generateVerificationToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const link = `${process.env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail(user.email, link);
};

// Resend verification email
const resendVerification = asyncHandler(async (req, res) => {
  const rawEmail = req.body.email;

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    throw new ApiError(400, "Email is required");
  }

  const user = await Shopkeeper.findOne({ email: rawEmail.trim().toLowerCase() });

  if (user && !user.isEmailVerified) {
    try {
      await sendVerificationLink(user);
    } catch (error) {
      console.error("Resend verification failed:", error);
      throw new ApiError(502, "Could not send verification email. Please try again later.");
    }
  }

  // Same reply whether or not the account exists, so emails can't be probed
  return res
    .status(200)
    .json(new ApiResponse(200, "If the account exists and is not verified, a new link has been sent."));
});

// verify Email
const verifyEmail = asyncHandler(async (req,res) => {
 const token = req.body.token;
 if(!token || typeof token !== "string"){
  throw new ApiError(400,"Verification Token is required");
 }
 const hashedToken = crypto
 .createHash("sha256")
 .update(token)
 .digest("hex");

 const user = await Shopkeeper.findOne({
  emailVerificationToken:hashedToken,
  emailVerificationTokenExpires: {$gt:new Date()},
 });

 if(!user){
  throw new ApiError(400,"Invalid or Expired verification link");
 }

 user.isEmailVerified = true;

 user.emailVerificationToken = undefined;
 user.emailVerificationTokenExpires = undefined;

 await user.save();

 res.status(200).json(new ApiResponse(200,
  "Email verified successfully. You can now log in."
 ));
});

// login Shopkeeper

const loginShopkeeper = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate the request
 if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
  throw new ApiError(400, "Email and password are required.");
}

  // 2. Find the shopkeeper
  const user = await Shopkeeper.findOne({
    email: email.trim().toLowerCase(),
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  // 3. Check email verification
  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email first.");
  }

  // 4. Check password
  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid email or password.");
  }

  // 5. Generate tokens
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  

  // 6. Send successful response
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        "User logged in successfully.",
        { userId: user._id }        
      )
    );
});



//logout shopkeeper
const logoutShopkeeper = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;

  if (incomingRefreshToken) {
    try {
      const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET, {
        ignoreExpiration: true,
      });
      await Shopkeeper.updateOne(
        { _id: decoded._id, refreshToken: incomingRefreshToken },
        { $unset: { refreshToken: 1 } }
      );
    } catch {
      // Invalid token: nothing to revoke, still clear the cookies
    }
  }

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, "User logged out successfully"));
});


// Refresh Access Token Endpoint 
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  let decodedToken;

  try {
    decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await Shopkeeper.findById(decodedToken?._id);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token expired or already used");
  }

  const {
    accessToken,
    refreshToken: newRefreshToken
  } = await generateAccessTokenAndRefreshToken(user._id);


  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", newRefreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        "Access token refreshed successfully",
        { accessToken },
      )
    );
});

// Check Which User Is logged In
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      "Current user fetched successfully",
      {
        userId: req.user._id,
      },
    )
  );
});



export { registerShopkeeper, loginShopkeeper, logoutShopkeeper, refreshAccessToken, getCurrentUser, verifyEmail, resendVerification };


