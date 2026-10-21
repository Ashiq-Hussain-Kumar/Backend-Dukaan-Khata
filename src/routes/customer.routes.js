import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createCustomer, getCustomers, getCustomerById, updateCustomerById, deleteCustomerById} from "../controllers/customer.controller.js";

const customerRouter = Router();

customerRouter.get("/get-customers",verifyJWT, getCustomers);
customerRouter.post("/create-customer",verifyJWT, createCustomer);
customerRouter.get("/:customerId", verifyJWT, getCustomerById);
customerRouter.patch("/:customerId", verifyJWT, updateCustomerById);
customerRouter.delete("/:customerId", verifyJWT, deleteCustomerById);

export {customerRouter};