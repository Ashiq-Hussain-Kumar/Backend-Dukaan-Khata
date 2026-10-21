import { Customer } from "../models/customers.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { Transaction } from "../models/transactions.model.js";


//Get Customers for shopkeeper
const getCustomers = asyncHandler(async (req,res) => {
  const customers = await Customer.find({shopkeeper:req.user._id}).select("-shopkeeper");

  res.status(200)
  .json(
    new ApiResponse(
      200,
      "Customers Retrieved Successfully",
      {customers}
    ));

});

//create customer
const createCustomer = asyncHandler(async (req,res) => {
  
  const {name, address, phone} = req.body;

  //validate
 if ([name, phone, address].some((f) => typeof f !== "string" || !f.trim())) {
  throw new ApiError(400, "All fields are required");
}

  //check if user exists with same name or phone
  const existingCustomer = await Customer.findOne({
  shopkeeper: req.user._id,
  phone: phone.trim()
});

  if(existingCustomer){
    throw new ApiError(409,"Customer with same phone number already exists");  
  }

  //register customer 
    const customer = await Customer.create({ name: name.trim(), address: address.trim(), phone: phone.trim(), shopkeeper: req.user._id });

  const { shopkeeper, ...safeCustomer } = customer.toObject();

return res
  .status(201)
  .json(new ApiResponse(201, "Customer created successfully", safeCustomer));

});

// get customer by id 
const getCustomerById = asyncHandler(async (req,res) => {
  const customerId = req.params.customerId;

 if(!mongoose.isValidObjectId(customerId)) {
  throw new ApiError(400,"Invalid Customer Id");
  
 }
  const customer = await Customer.findOne({
     _id:customerId,
    shopkeeper:req.user._id    
  }).select("-shopkeeper");

  if(!customer){
throw new ApiError(404,"Customer Not Found");
  }

 return res.status(200).json(new ApiResponse(200,"Customer Found",customer))
});

// update customer by id 
const updateCustomerById = asyncHandler(async (req,res) => {
  const customerId = req.params.customerId;
  
 if(!mongoose.isValidObjectId(customerId)) {
  throw new ApiError(400,"Invalid Customer Id");
  
 }
 const {name, address, phone} =req.body;

  //validate
 if ([name, phone, address].some((f) => f !== undefined && (typeof f !== "string" || !f.trim()))) {
  throw new ApiError(400, "Fields cannot be empty");
}

 const updates = {};

if (name !== undefined) updates.name = name.trim();
if (address !== undefined) updates.address = address.trim();
if (phone !== undefined) {
  updates.phone = phone.trim();

  const phoneTaken = await Customer.findOne({
    shopkeeper: req.user._id,
    phone: updates.phone,
    _id: { $ne: customerId },   // ignore this customer itself
  });
  if (phoneTaken) {
    throw new ApiError(409, "Customer with same phone number already exists");
  }
}

if (Object.keys(updates).length === 0) {
  throw new ApiError(400, "At least one field is required");
}

const customer = await Customer.findOneAndUpdate(
  {shopkeeper:req.user._id, _id:customerId},
  {$set : updates},
  { new: true, runValidators: true }
).select("-shopkeeper -balance");

  if(!customer){
throw new ApiError(404,"Customer Not Found");
  }

 return res.status(200).json(new ApiResponse(200,"Customer Updated Successfully",customer))
});

// delete customer by id 
const deleteCustomerById = asyncHandler(async (req,res) => {
  const customerId = req.params.customerId;
  
 if(!mongoose.isValidObjectId(customerId)) {
  throw new ApiError(400,"Invalid Customer Id");
  
 }
const customer = await Customer.findOne({
  _id: customerId,
  shopkeeper: req.user._id
});

if (!customer) {
  throw new ApiError(404, "Customer not found");
}

if (customer.balance !== 0) {
  throw new ApiError(400, "Cannot delete a customer with a pending balance");
}

const hasTransactions = await Transaction.exists({ customerId: customer._id });
if (hasTransactions) {
  throw new ApiError(409, "Cannot delete a customer who has transactions. Delete their transactions first.");
}

await customer.deleteOne();

return res.status(200).json(new ApiResponse(200, "Customer deleted successfully"));
});


export {getCustomers,createCustomer,getCustomerById,updateCustomerById,deleteCustomerById};