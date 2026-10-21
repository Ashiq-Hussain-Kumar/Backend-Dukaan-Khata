import express from "express";
import cors from "cors";
import cookiesparser from "cookie-parser";
import helmet from "helmet"

const app = express();

app.set("trust proxy", 1);   
app.use(helmet()); 
app.use(express.json({ limit: "100kb" })); 
app.use(cors({
  origin: process.env.CLIENT_URL,                // was hardcoded "http://localhost:5173"
  credentials: true,
}));

app.use(cookiesparser());


// routes
import {userRouter} from "./routes/shopkeeper.routes.js"
import { customerRouter } from "./routes/customer.routes.js";
import { transactionRouter } from "./routes/transactions.routes.js";
import { productRouter } from "./routes/product.routes.js";
app.use("/api/v1/shopkeepers",userRouter);
app.use("/api/v1/customers",customerRouter);
app.use("/api/v1/transactions",transactionRouter);
app.use("/api/v1/products",productRouter);

//middleware
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") { statusCode = 400; message = "Invalid id"; }
  if (err.name === "ValidationError") { statusCode = 400; }
  if (err.code === 11000) { statusCode = 409; message = "Duplicate value already exists"; }
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
  message = "Internal Server Error";
}

  res.status(statusCode).json({ success: false, message, errors: err.errors || [] });
});
export default app;