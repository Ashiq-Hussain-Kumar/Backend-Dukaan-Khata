import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createTransaction, deleteTransaction, getCustomerBalance, getCustomerTransactions, getTransactionById, updateTransaction,getAllTransactions,getDashboardSummary } from "../controllers/transaction.controller.js";

const transactionRouter = Router();

transactionRouter.use(verifyJWT);

transactionRouter.post("/", createTransaction);
transactionRouter.get("/", getAllTransactions);
transactionRouter.get("/summary", getDashboardSummary);
transactionRouter.get("/customer/:customerId", getCustomerTransactions);
transactionRouter.get("/customer/:customerId/balance", getCustomerBalance);
transactionRouter.get("/:transactionId", getTransactionById);
transactionRouter.patch("/:transactionId", updateTransaction);
transactionRouter.delete("/:transactionId", deleteTransaction);

export {transactionRouter};