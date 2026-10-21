import mongoose from "mongoose";


const productSchema = new mongoose.Schema({
  shopkeeperId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Shopkeeper",
  required: true,
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
  unit: {
  type: String,
  default: "piece",
  trim: true,
},
  isActive:{
    type:Boolean,
    default: true,
  }
},{timestamps:true});

export const Product = mongoose.model("Product",productSchema);