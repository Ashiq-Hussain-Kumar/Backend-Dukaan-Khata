import mongoose from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import "dotenv/config";
const shopkeeperSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
    trim:true,
  },
  email:{
    type:String,
    required:true,
    trim:true,
    unique:true,
    lowercase:true,
  },
  phone:{
    type:String,
    required:true
  },
  password:{
    type:String,
    required:true
  },
  refreshToken:{
    type:String
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  emailVerificationToken: {
    type: String,
    default: undefined,
  },

  emailVerificationTokenExpires: {
    type: Date,
    default: undefined,
  },
},{timestamps:true});


shopkeeperSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return 
  }

  this.password = await bcrypt.hash(this.password, 10);


});

shopkeeperSchema.methods.isPasswordCorrect = async function (password) {
 return await bcrypt.compare(password,this.password)
}


shopkeeperSchema.methods.generateAccessToken = function(){
 return  jwt.sign({
    _id:this._id,
    name:this.name,
    email:this.email
  },
  process.env.ACCESS_TOKEN_SECRET,
  {expiresIn:process.env.ACCESS_TOKEN_EXPIRY}
)
};
shopkeeperSchema.methods.generateRefreshToken = function(){
  return  jwt.sign({
    _id:this._id
  },
  process.env.REFRESH_TOKEN_SECRET,
  {expiresIn:process.env.REFRESH_TOKEN_EXPIRY}
)
};


export const Shopkeeper = mongoose.model("Shopkeeper", shopkeeperSchema);