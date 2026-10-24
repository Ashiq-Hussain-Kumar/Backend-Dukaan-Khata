import { ApiError } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { Shopkeeper } from "../models/shopkeeper.models.js";
export const verifyJWT = asyncHandler(async(req,res,next)=>{
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","") //may be user may send through custom header  often comes through like Authorization header

  if(!token){
    throw new ApiError(401, "Unauthorized Request");
  }
let decodedToken;
try {
  decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
} catch (error) {
  const expired = error.name === "TokenExpiredError";
  return res.status(401).json({
    success: false,
    message: expired ? "Access token expired" : "Invalid access token",
    code: expired ? "ACCESS_TOKEN_EXPIRED" : "ACCESS_TOKEN_INVALID",
  });
}
  const authUser = await Shopkeeper.findById(decodedToken?._id).select("-password -refreshToken");

  if(!authUser){
    throw new ApiError(401, "Invalid Access Token")
  }
   

  req.user = authUser;

 return next();
    
});