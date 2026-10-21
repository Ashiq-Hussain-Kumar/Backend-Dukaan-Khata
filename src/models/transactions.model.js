import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },        
    unitPrice: { type: Number, required: true, min: 0 }, 
    quantity: { type: Number, required: true, min: 0.01 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["Cash", "UPI", "Card", "Bank Transfer"], required: true },
    reference: { type: String, default: "By Self" },
    receivedBy: { type: String, required: true },
  },
  { _id: false }
);

const returnInfoSchema = new mongoose.Schema(
  { reason: { type: String, required: true } },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    shopkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "Shopkeeper", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    type: { type: String, enum: ["SALE", "PAYMENT", "RETURN"], required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    items: { type: [itemSchema], default: undefined },
    payment: { type: paymentSchema, default: undefined },
    returnInfo: { type: returnInfoSchema, default: undefined },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);