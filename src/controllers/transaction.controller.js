import { Customer } from "../models/customers.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Transaction } from "../models/transactions.model.js";
import { Product } from "../models/products.models.js";
import mongoose, { isValidObjectId } from "mongoose";


const round = (n) => Math.round(n * 100) / 100;

//create Transaction
const createTransaction = asyncHandler(async (req, res) => {
  const { customerId, type, items, payment, returnInfo, amount, note, date } = req.body;

  if (!mongoose.isValidObjectId(customerId)) {
    throw new ApiError(400, "Invalid Customer Id");
  }

  const customerExist = await Customer.findOne({
    _id: customerId,
    shopkeeper: req.user._id,
  });

  if (!customerExist) {
    throw new ApiError(404, "Customer Not Found");
  }

  if (type !== "SALE" && type !== "RETURN" && type !== "PAYMENT") {
    throw new ApiError(400, "Invalid transaction type");
  }

  if (note !== undefined && typeof note !== "string") {
    throw new ApiError(400, "Invalid note");
  }

  let txDate = new Date();
  if (date !== undefined) {
    txDate = new Date(date);
    if (Number.isNaN(txDate.getTime())) {
      throw new ApiError(400, "Invalid date");
    }
  }

  if ((type === "SALE" || type === "RETURN") && (!Array.isArray(items) || items.length === 0)) {
    throw new ApiError(400, "Items cannot be empty");
  }

  if (
    type === "PAYMENT" &&
    (
      !payment ||
      !payment.method?.trim() ||
      !payment.receivedBy?.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
  ) {
    throw new ApiError(400, "Invalid amount or payment details");
  }

  if (type === "RETURN" && !returnInfo?.reason?.trim()) {
    throw new ApiError(400, "Return reason is required");
  }

  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.withTransaction(async () => {
      let itemsWithTotal = [];
      let transactionAmount = 0;

      if (type === "SALE" || type === "RETURN") {
        for (const item of items) {
          if (!mongoose.isValidObjectId(item?.productId)) {
            throw new ApiError(400, "Invalid Product ID");
          }
        }

        for (const item of items) {
          const product = await Product.findOne({
            _id: item.productId,
            shopkeeperId: req.user._id,
            isActive: true,
          }).session(session);

          if (!product) {
            throw new ApiError(404, "Product Not Found");
          }

          if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            throw new ApiError(400, "Invalid quantity");
          }

          if (type === "SALE" && item.quantity > product.stock) {
            throw new ApiError(400, "Not Enough Stock Available");
          }

          if (type === "SALE") {
            product.stock -= item.quantity;
          }

          if (type === "RETURN") {
            product.stock += item.quantity;
          }

          await product.save({ session });

          itemsWithTotal.push({
            productId: product._id,
            name: product.name,
            unitPrice: product.price,
            quantity: item.quantity,
            total: round(product.price * item.quantity),
          });
        }

        transactionAmount = round(
          itemsWithTotal.reduce((sum, item) => sum + item.total, 0)
        );
      } else if (type === "PAYMENT") {
        transactionAmount = round(amount);
      }

      const [created] = await Transaction.create(
        [
          {shopkeeper:req.user._id,
            customerId,
            type,
            amount: transactionAmount,
            date: txDate,
            note: note?.trim(),
            items: itemsWithTotal,
            payment,
            returnInfo,
          },
        ],
        { session }
      );
      transaction = created;

      // SALE adds to what the customer owes. PAYMENT and RETURN subtract.
      const delta = type === "SALE" ? transactionAmount : -transactionAmount;
      await Customer.updateOne(
        { _id: customerId, shopkeeper: req.user._id },
        { $inc: { balance: delta } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "Transaction Created Successfully", transaction));
});


// Get customer transactions by customerId
const getCustomerTransactions = asyncHandler(async (req, res) => {
  const { customerId } = req.params;

if (!mongoose.isValidObjectId(customerId)) {
    throw new ApiError(400, "Invalid Customer Id");
  }

  const customerExist = await Customer.findOne({
    _id: customerId,
    shopkeeper: req.user._id
  });

  if (!customerExist) {
    throw new ApiError(404, "Customer Not Found")
  }
  // 3. Fetch customer's transactions
const transactions = await Transaction.find({
  customerId: customerId,
}).sort({ date: -1, createdAt: -1 });


  // 4. Return response
return res
  .status(200)
  .json(new ApiResponse(200, "Transactions Found Successfully", transactions));
});

//get customer balance
const getCustomerBalance = asyncHandler(async (req,res) => {
   const { customerId } = req.params;

if (!mongoose.isValidObjectId(customerId)) {
    throw new ApiError(400, "Invalid Customer Id");
  }

  const customerExist = await Customer.findOne({
    _id: customerId,
    shopkeeper: req.user._id
  });
  if (!customerExist) {
  throw new ApiError(404, "Customer Not Found");
}

  
    return res
  .status(200)
  .json(new ApiResponse(200, "Customer Balance Retrieved Successfully", { balance: customerExist.balance }));
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// All transactions of this shopkeeper, for the Sales page.
// Query: ?type=SALE&search=ram&from=2026-10-01&to=2026-11-01
const getAllTransactions = asyncHandler(async (req, res) => {
  const { type, search, from, to } = req.query;

  if (type !== undefined && !["SALE", "RETURN", "PAYMENT"].includes(type)) {
    throw new ApiError(400, "Invalid transaction type");
  }
  if (search !== undefined && typeof search !== "string") {
    throw new ApiError(400, "Invalid search");
  }

  // 1. My customers
  const customers = await Customer.find({ shopkeeper: req.user._id }).select("_id name");
  const nameById = new Map(customers.map((c) => [c._id.toString(), c.name]));

  // 2. Build the filter step by step
  const filter = { customerId: { $in: customers.map((c) => c._id) } };

  if (type) filter.type = type;

  if (from !== undefined || to !== undefined) {
    filter.date = {};
    if (from !== undefined) {
      const d = new Date(from);
      if (Number.isNaN(d.getTime())) throw new ApiError(400, "Invalid from date");
      filter.date.$gte = d;   // from is included
    }
    if (to !== undefined) {
      const d = new Date(to);
      if (Number.isNaN(d.getTime())) throw new ApiError(400, "Invalid to date");
      filter.date.$lt = d;    // to is not included
    }
  }

  const term = search?.trim();
  if (term) {
    // escapeRegex stops user input like ".*" from becoming a pattern
    const regex = new RegExp(escapeRegex(term), "i");
    const matchingIds = customers.filter((c) => regex.test(c.name)).map((c) => c._id);
    filter.$or = [{ customerId: { $in: matchingIds } }, { "items.name": regex }];
  }

  // 3. Query, newest first, capped at 500
  const transactions = await Transaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(500)
    .lean();

  const result = transactions.map((t) => ({
    ...t,
    customerName: nameById.get(t.customerId.toString()),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, "Transactions retrieved successfully", { transactions: result }));
});

// Totals and latest transactions, for the Dashboard.
const getDashboardSummary = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ shopkeeper: req.user._id }).select("_id name balance");
  const ids = customers.map((c) => c._id);
  const customerById = new Map(customers.map((c) => [c._id.toString(), c]));

  // MongoDB adds up the amounts per type, so we don't load every transaction
  const totals = await Transaction.aggregate([
    { $match: { customerId: { $in: ids } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);
  const sumOf = (t) => round(totals.find((x) => x._id === t)?.total ?? 0);

  const recent = await Transaction.find({ customerId: { $in: ids } })
    .sort({ date: -1, createdAt: -1 })
    .limit(6)
    .lean();

  return res.status(200).json(
    new ApiResponse(200, "Dashboard summary retrieved successfully", {
      totalSales: sumOf("SALE"),
      totalCollected: sumOf("PAYMENT"),
      totalOutstanding: round(customers.reduce((sum, c) => sum + c.balance, 0)),
      recentTransactions: recent.map((t) => {
        const c = customerById.get(t.customerId.toString());
        return { ...t, customerName: c?.name, customerBalance: c?.balance ?? 0 };
      }),
    })
  );
});

// get transaction by id
const getTransactionById = asyncHandler(async (req,res) => {
  const {transactionId} = req.params;
  if(!mongoose.isValidObjectId(transactionId)){
    throw new ApiError(400,"Invalid transactionId");
  }

  const transaction = await Transaction.findById(transactionId);

  if(!transaction){
    throw new ApiError(404,"Transaction not found");
  }
 const customer = await Customer.findOne({_id:transaction.customerId,shopkeeper:req.user._id});

 if(!customer){
  throw new ApiError(404,"Unauthorized Request");
 }
return res.status(200).json(
  new ApiResponse(200, "Transaction Retrieved Successfully", transaction)
);
});

//delete transaction
const deleteTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  if (!mongoose.isValidObjectId(transactionId)) {
    throw new ApiError(400, "Invalid transaction id");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findById(transactionId).session(session);

      if (!transaction) {
        throw new ApiError(404, "Transaction not found");
      }

      // Ownership: the transaction belongs to me if its customer belongs to me.
      // Customer uses the field "shopkeeper" (Product uses "shopkeeperId").
      const customer = await Customer.findOne({
        _id: transaction.customerId,
        shopkeeper: req.user._id,
      }).session(session);

      if (!customer) {
        throw new ApiError(404, "Transaction not found");
      }

      // 1. Undo the stock change
      if (transaction.type === "SALE" || transaction.type === "RETURN") {
        for (const item of transaction.items) {
          // No isActive filter: a deactivated product still has stock to fix
          const product = await Product.findOne({
            _id: item.productId,
            shopkeeperId: req.user._id,
          }).session(session);

          if (!product) {
            throw new ApiError(404, `Product ${item.name} not found`);
          }

          if (transaction.type === "SALE") {
            // The sale took stock out, so put it back
            product.stock += item.quantity;
          } else {
            // The return added stock, so take it out again
            if (item.quantity > product.stock) {
              throw new ApiError(
                409,
                `Cannot delete this return: not enough ${item.name} in stock to take back`
              );
            }
            product.stock -= item.quantity;
          }

          await product.save({ session });
        }
      }

      // 2. Undo the balance change.
      // The sale added to the balance, so subtract it.
      // A payment or return subtracted, so add it back.
      const delta = transaction.type === "SALE" ? -transaction.amount : transaction.amount;

      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { balance: delta } },
        { session }
      );

      // 3. Remove the transaction
      await transaction.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Transaction deleted successfully"));
}); 

//update transaction 

const updateTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  // 1. Validate transaction ID
  if (!mongoose.isValidObjectId(transactionId)) {
    throw new ApiError(400, "Invalid Transaction ID");
  }

  const session = await mongoose.startSession();
  let updatedTransaction;

  try {
    await session.withTransaction(async () => {
      // 2. Find the existing transaction
      const existingTransaction = await Transaction.findById(
        transactionId
      ).session(session);

      if (!existingTransaction) {
        throw new ApiError(404, "Transaction Not Found");
      }

      // 3. Verify ownership through the original customer
      const ownerCustomer = await Customer.findOne({
        _id: existingTransaction.customerId,
        shopkeeper: req.user._id,
      }).session(session);

      if (!ownerCustomer) {
        throw new ApiError(404, "Transaction Not Found");
      }

      // Preserve original values before modifying anything
      const oldCustomerId = existingTransaction.customerId.toString();
      const oldType = existingTransaction.type;
      const oldAmount = existingTransaction.amount;

      const type = existingTransaction.type;

      if (!["SALE", "RETURN", "PAYMENT"].includes(type)) {
        throw new ApiError(400, "Invalid transaction type");
      }

      const {
        customerId,
        items,
        payment,
        returnInfo,
        note, amount, date
      } = req.body;

      // 4. Update customer if supplied
      if (customerId !== undefined) {
        if (!mongoose.isValidObjectId(customerId)) {
          throw new ApiError(400, "Invalid Customer ID");
        }

        const customerExists = await Customer.findOne({
          _id: customerId,
          shopkeeper: req.user._id,
        }).session(session);

        if (!customerExists) {
          throw new ApiError(404, "Customer Not Found");
        }

        existingTransaction.customerId = customerExists._id;
      }

      // 5. Update note
     if (note !== undefined) {
  if (typeof note !== "string") {
    throw new ApiError(400, "Note must be a string");
  }
  existingTransaction.note = note.trim();
}

if (date !== undefined) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, "Invalid date");
  }
  existingTransaction.date = d;
}
      // 6. Update SALE or RETURN items and stock
      if (items !== undefined) {
        if (type === "PAYMENT") {
          throw new ApiError(
            400,
            "Items cannot be updated for a payment"
          );
        }

        if (!Array.isArray(items) || items.length === 0) {
          throw new ApiError(400, "Items cannot be empty");
        }

        // Validate and aggregate duplicate product IDs
        const newQuantities = new Map();

        for (const item of items) {
          if (
            !item ||
            !mongoose.isValidObjectId(item.productId)
          ) {
            throw new ApiError(400, "Invalid Product ID");
          }

          if (
            typeof item.quantity !== "number" ||
            !Number.isFinite(item.quantity) ||
            item.quantity <= 0
          ) {
            throw new ApiError(400, "Invalid quantity");
          }

          const id = item.productId.toString();

          newQuantities.set(
            id,
            (newQuantities.get(id) || 0) + item.quantity
          );
        }

        // Aggregate old quantities by product
        const oldQuantities = new Map();
const oldPrices = new Map();

for (const oldItem of existingTransaction.items) {
  const id = oldItem.productId.toString();
  oldQuantities.set(id, (oldQuantities.get(id) || 0) + oldItem.quantity);
  oldPrices.set(id, oldItem.unitPrice);
}

        // Restore the old stock effect
        for (const [id, quantity] of oldQuantities) {
          const oldProduct = await Product.findOne({
            _id: id,
            shopkeeperId: req.user._id,
          }).session(session);

          if (!oldProduct) {
            throw new ApiError(
              404,
              "An existing transaction product could not be found"
            );
          }

          if (type === "SALE") {
            oldProduct.stock += quantity;
          } else if (type === "RETURN") {
            oldProduct.stock -= quantity;
          }

          if (
            !Number.isFinite(oldProduct.stock) ||
            oldProduct.stock < 0
          ) {
            throw new ApiError(
              400,
              `Cannot reverse old stock for ${oldProduct.name}`
            );
          }

          await oldProduct.save({ session });
        }

        // Apply new stock effect
        const itemsWithTotal = [];

        for (const [id, quantity] of newQuantities) {
          const product = await Product.findOne({
            _id: id,
            shopkeeperId: req.user._id,
            isActive: true,
          }).session(session);

          if (!product) {
            throw new ApiError(404, "Product Not Found");
          }

          if (type === "SALE") {
            if (quantity > product.stock) {
              throw new ApiError(
                400,
                `Not Enough Stock for ${product.name}`
              );
            }

            product.stock -= quantity;
          } else if (type === "RETURN") {
            product.stock += quantity;
          }

          await product.save({ session });
const unitPrice = oldPrices.get(id) ?? product.price; // old price if it was already in the sale
const total = round(unitPrice * quantity);

itemsWithTotal.push({
  productId: product._id,
  name: product.name,
  unitPrice,
  quantity,
  total,
});
        }

        existingTransaction.items = itemsWithTotal;

       existingTransaction.amount = round(
  itemsWithTotal.reduce((sum, item) => sum + item.total, 0)
);
      }

      // 7. Update PAYMENT details
      if (type === "PAYMENT") {
        if (amount !== undefined) {
          if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
          ) {
            throw new ApiError(400, "Invalid payment amount");
          }

          existingTransaction.amount = round(amount);
        }

        if (payment !== undefined) {
          if (
            !payment ||
            typeof payment !== "object" ||
            Array.isArray(payment)
          ) {
            throw new ApiError(400, "Invalid payment details");
          }

          const currentPayment =
            existingTransaction.payment?.toObject?.() ??
            existingTransaction.payment?.toJSON?.() ??
            {};

          const updatedPayment = {
            ...currentPayment,
            ...payment,
          };

          if (
            typeof updatedPayment.method !== "string" ||
            !updatedPayment.method.trim() ||
            typeof updatedPayment.receivedBy !== "string" ||
            !updatedPayment.receivedBy.trim()
          ) {
            throw new ApiError(400, "Invalid payment details");
          }

          existingTransaction.payment = updatedPayment;
        }
      } else if (amount !== undefined || payment !== undefined) {
        throw new ApiError(
          400,
          "Amount and payment details can only be updated for PAYMENT transactions"
        );
      }

      // 8. Update RETURN reason
      if (returnInfo !== undefined) {
        if (
          type !== "RETURN" ||
          !returnInfo ||
          typeof returnInfo !== "object" ||
          Array.isArray(returnInfo)
        ) {
          throw new ApiError(400, "Invalid return details");
        }

        const currentReturnInfo =
          existingTransaction.returnInfo?.toObject?.() ??
          existingTransaction.returnInfo?.toJSON?.() ??
          {};

        existingTransaction.returnInfo = {
          ...currentReturnInfo,
          ...returnInfo,
        };
      }

      if (type === "RETURN") {
        if (
          typeof existingTransaction.returnInfo?.reason !== "string" ||
          !existingTransaction.returnInfo.reason.trim()
        ) {
          throw new ApiError(400, "Return reason is required");
        }
      } else if (returnInfo !== undefined) {
        throw new ApiError(
          400,
          "Return details can only be updated for RETURN transactions"
        );
      }

      // 9. Update customer balances
      // SALE = positive effect; PAYMENT and RETURN = negative effect
      const balanceEffect = (transactionType, transactionAmount) =>
        transactionType === "SALE"
          ? transactionAmount
          : -transactionAmount;

      const oldEffect = balanceEffect(oldType, oldAmount);

      const newCustomerId =
        existingTransaction.customerId.toString();

      const newEffect = balanceEffect(
        existingTransaction.type,
        existingTransaction.amount
      );

      if (oldCustomerId === newCustomerId) {
        // Same customer: apply only the difference
        const customer = await Customer.findOne({
          _id: oldCustomerId,
          shopkeeper: req.user._id,
        }).session(session);

        if (!customer) {
          throw new ApiError(404, "Customer Not Found");
        }

        customer.balance += newEffect - oldEffect;

        await customer.save({ session });
      } else {
        // Different customers: reverse old effect, apply new effect
        const oldCustomer = await Customer.findOne({
          _id: oldCustomerId,
          shopkeeper: req.user._id,
        }).session(session);

        const newCustomer = await Customer.findOne({
          _id: newCustomerId,
          shopkeeper: req.user._id,
        }).session(session);

        if (!oldCustomer || !newCustomer) {
          throw new ApiError(404, "Customer Not Found");
        }

        oldCustomer.balance -= oldEffect;
        newCustomer.balance += newEffect;

        await oldCustomer.save({ session });
        await newCustomer.save({ session });
      }

      // 10. Save transaction last
      updatedTransaction = await existingTransaction.save({
        session,
      });
    });

    // Respond only after successful commit
    return res.status(200).json(
      new ApiResponse(
        200,
        "Transaction Updated Successfully",
        updatedTransaction
      )
    );
  } finally {
    await session.endSession();
  }
});



export {createTransaction, getCustomerTransactions, getCustomerBalance, getTransactionById, deleteTransaction, updateTransaction, getAllTransactions, getDashboardSummary}