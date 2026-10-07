import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId:{
  type:mongoose.Types.ObjectId,
  ref:"Product",
  required:true
},
 name: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    unitPrice: {
      type: Number,
      required: true,
    },

    total: {
      type: Number,
      required: true,
    },
},{_id:false})


const paymentSchema = new mongoose.Schema({
  method: {
      type: String,
      required: true,
    },

    reference: {
      type: String,
      required: true,
    },

    receivedBy: {
      type: String,
      required: true,
    },
},{_id:false})

const returnInfoSchema = new mongoose.Schema({
  reason: {
      type: String,
      required: true,
    },
},{_id:false})



const transactionSchema = new mongoose.Schema({
  customerId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Customer",
    required:true,
  },
  type:{
    type:String,
    enum: ["SALE","PAYMENT","RETURN"],
    required:true
  },
  items:{
    type:[itemSchema],
    required:function () {
      return this.type ==="SALE" ||this.type === "RETURN";
    }
  },
  payment:{
    type:paymentSchema,
    required:function () {
      return this.type === "PAYMENT";
    }
  },
  returnInfo:{
    type:returnInfoSchema,
    required:function () {
      return this.type === "RETURN";
    }
  }

},{timestamps:true});

export const Transaction = mongoose.model("Transaction",transactionSchema);