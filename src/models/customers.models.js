import mongoose from "mongoose";


const customerSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
    trim:true
  },
  phone:{
    type:String,
    required:true,
    trim:true
  },
  address:{
    type:String,
    required:true
  },
  balance:{
    type:Number,
    required:true,
    default:0
  },
  shopkeeper:{
    type:mongoose.Types.ObjectId,
    ref:"Shopkeeper",
    required:true
  }
  
},{timestamps:true});

export const Customer = mongoose.model("Customer",customerSchema);