import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";

const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isValidText = (v) => typeof v === "string" && v.trim() !== "";

// Create product
const createProduct = asyncHandler(async (req, res) => {
  const { name, category, price, stock, unit } = req.body;

  if (!isValidText(name)) throw new ApiError(400, "Product name is required");
  if (!isValidNumber(price)) throw new ApiError(400, "Price must be a number, 0 or more");
  if (stock !== undefined && !isValidNumber(stock)) {
    throw new ApiError(400, "Stock must be a number, 0 or more");
  }
  if (category !== undefined && typeof category !== "string") {
    throw new ApiError(400, "Invalid category");
  }
  if (unit !== undefined && !isValidText(unit)) throw new ApiError(400, "Invalid unit");

  const exists = await Product.findOne({
    shopkeeperId: req.user._id,
    name: name.trim(),
    isActive: true,
  });
  if (exists) throw new ApiError(409, "A product with this name already exists");

  const product = await Product.create({
    shopkeeperId: req.user._id,
    name: name.trim(),
    category: category?.trim(),
    price,
    stock,
    unit: unit?.trim(),
  });

  return res.status(201).json(new ApiResponse(201, "Product created successfully", product));
});

// List active products
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ shopkeeperId: req.user._id, isActive: true })
    .sort({ name: 1 });

  return res.status(200).json(new ApiResponse(200, "Products retrieved successfully", { products }));
});

// Update product
const updateProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product id");

  const { name, category, price, stock, unit } = req.body;
  const updates = {};

  if (name !== undefined) {
    if (!isValidText(name)) throw new ApiError(400, "Product name cannot be empty");
    updates.name = name.trim();
  }
  if (category !== undefined) {
    if (typeof category !== "string") throw new ApiError(400, "Invalid category");
    updates.category = category.trim();
  }
  if (price !== undefined) {
    if (!isValidNumber(price)) throw new ApiError(400, "Price must be a number, 0 or more");
    updates.price = price;
  }
  if (stock !== undefined) {
    if (!isValidNumber(stock)) throw new ApiError(400, "Stock must be a number, 0 or more");
    updates.stock = stock;
  }
  if (unit !== undefined) {
    if (!isValidText(unit)) throw new ApiError(400, "Invalid unit");
    updates.unit = unit.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "At least one field is required");
  }

  const product = await Product.findOneAndUpdate(
    { _id: productId, shopkeeperId: req.user._id, isActive: true },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!product) throw new ApiError(404, "Product not found");

  return res.status(200).json(new ApiResponse(200, "Product updated successfully", product));
});

// Deactivate product 
const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product id");

  const product = await Product.findOneAndUpdate(
    { _id: productId, shopkeeperId: req.user._id, isActive: true },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!product) throw new ApiError(404, "Product not found");

  return res.status(200).json(new ApiResponse(200, "Product removed successfully"));
});

export { createProduct, getProducts, updateProduct, deleteProduct };