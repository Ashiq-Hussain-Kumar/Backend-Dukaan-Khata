import mongoose from "mongoose";


const productSchema = new mongoose.Schema({
  shopkeeperId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Shopkeeper"
  },
  name:{
    type:String,
    required:true,
    trim:true
  },
  category:{
    type:String,
    trim:true,
  },
  price:{
    type:Number,
    required:true,
    min:0,
  },
  stock:{
    type:Number,
    default:0,
    min:0,
  },
  unit:{
    type:String,
    default: "piece"
  },
  isActive:{
    type:Boolean,
    default: true,
  }
},{timestamps:true});

export const Product = mongoose.model("product",productSchema);