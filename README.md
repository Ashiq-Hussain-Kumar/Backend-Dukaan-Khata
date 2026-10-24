# Dukaan Khata: Backend API

REST API for **Dukaan Khata**, a digital *khata* (credit ledger) for small shops. A shopkeeper keeps customers, a product list with stock, and records sales, payments and returns. The API keeps every customer balance and every stock count correct, even when a request fails halfway.

- **Live demo:** `<https://dukaan-khati-8few649eg-dev-forge.vercel.app/>`
- **API base URL:** `<https://dukaan-khata-api.onrender.com>/api/v1`
- **Frontend repository:** `<https://github.com/Ashiq-Hussain-Kumar/Dukaan-khata>`

> **Demo login:** `<demo@example.com>` / `<Demo@2026Khata>`
> The free hosting plan can put the server to sleep, so the first request after a pause may take about 30 seconds.

---

## Features

- **Accounts:** register, log in, log out, silent token refresh, optional email verification with resend.
- **Customers:** create, list, view, edit and delete. A customer who has transactions cannot be deleted.
- **Products:** create, list, edit and remove (removing hides a product but keeps old transactions valid).
- **Transactions:** `SALE`, `PAYMENT` and `RETURN`, each with a date and a note. Create, view, edit and delete.
- **Automatic balances and stock:** every create, edit and delete adjusts the customer balance and product stock in one database transaction.
- **Dashboard data:** totals for sales, collections and money outstanding, plus the latest transactions.
- **Search and filters:** transaction list by type, text, and date range.

## Tech stack

| Area | Tools |
|---|---|
| Runtime and framework | Node.js, Express |
| Database | MongoDB with Mongoose (multi-document transactions) |
| Authentication | JSON Web Tokens in `httpOnly` cookies, `bcryptjs` |
| Security | `helmet`, `cors`, `express-rate-limit`, input checks on every route |
| Email | `nodemailer` (SMTP), used for verification links |
| Config | `dotenv` |

---

## How the ledger works

### Rules

| Type | Customer balance | Product stock |
|---|---|---|
| `SALE` | goes **up** by the sale total | goes **down** |
| `PAYMENT` | goes **down** by the amount | unchanged |
| `RETURN` | goes **down** by the return total | goes **up** |

A **positive balance means the customer owes the shop.** A negative balance means the customer has paid in advance.

### Design decisions

- **One database transaction per change.** Creating, editing or deleting a transaction updates the transaction document, product stock and customer balance inside a single MongoDB session. If any step fails, nothing is saved.
- **The server computes every amount.** The client sends only a product id and a quantity for each item. The server reads the price from the product, so a tampered request cannot change what a customer owes.
- **No overselling.** Stock is checked and reduced in the same session, and a sale that needs more than the available stock is rejected with a clear message.
- **Balance with `$inc`.** The balance is changed with MongoDB's atomic increment instead of reading, adding and saving, so two requests at the same moment cannot overwrite each other.
- **Price snapshots.** Each transaction item stores the product name and unit price at the time of sale. Changing a product's price later does not rewrite old sales, and editing a sale keeps the original price for products that were already on it.
- **Edit and delete reverse the old effect.** Editing restores the old stock, applies the new stock and moves only the balance difference. Changing the customer of a transaction moves the effect from one customer to the other. Deleting a transaction reverses its stock and balance, and deleting a `RETURN` is refused (HTTP 409) when the returned goods are no longer in stock.
- **Products are deactivated, not deleted,** so old transactions that point to them stay valid.
- **Ownership on every query.** A transaction belongs to a shopkeeper through its customer, and every query is scoped to the logged-in shopkeeper.

---

## Authentication flow

1. **Login** sets two `httpOnly` cookies: a short-lived **access token** and a longer-lived **refresh token**.
2. Protected routes read the access token. When it has expired, the API answers `401` with the code `ACCESS_TOKEN_EXPIRED`.
3. The client calls `POST /shopkeepers/refresh-token`, which issues a new pair of tokens (**refresh token rotation**: the old refresh token stops working).
4. **Logout** works from the refresh token, so it succeeds even when the access token has expired, and it clears both cookies.
5. **Email verification** (when enabled): a random token is emailed, only its SHA-256 hash is stored, and it expires after 30 minutes. A resend endpoint issues a new link.

## Security

- Passwords hashed with bcrypt.
- Tokens only in `httpOnly` cookies, with `secure` and `sameSite` set by environment (`sameSite: none` for separate production domains).
- Rate limits: login (5 failed attempts per 15 minutes per IP, successful logins do not count), registration, and verification resend.
- `helmet` headers, a CORS allow-list for the frontend origin, a 100 KB body limit, and `trust proxy` for hosting behind a proxy.
- Every request body field is type-checked, so objects like `{ "$gt": "" }` cannot reach a query.
- Login returns the same message for a wrong email and a wrong password, and the resend endpoint answers the same whether or not an account exists.
- Internal error details are hidden in production.

---

## API reference

Base path: `/api/v1`. Responses use one shape:

```json
{ "statusCode": 200, "message": "Customers Retrieved Successfully", "data": {}, "success": true }
```

Errors return `success: false`, a `message`, and the matching HTTP status. Routes marked **Auth** need the login cookies.

### Shopkeepers: `/shopkeepers`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | no | Create an account (rate limited) |
| POST | `/login` | no | Log in and set cookies (rate limited) |
| POST | `/logout` | no | Revoke the refresh token and clear cookies |
| POST | `/refresh-token` | cookie | Issue a new access and refresh token |
| POST | `/verify` | no | Verify an email with the token from the link |
| POST | `/resend-verification` | no | Send a new verification link (rate limited) |
| GET | `/me` | yes | Current user |

### Customers: `/customers`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/get-customers` | yes | List customers with balances |
| POST | `/create-customer` | yes | Create a customer (`name`, `address`, `phone`) |
| GET | `/:customerId` | yes | One customer |
| PATCH | `/:customerId` | yes | Edit name, address or phone |
| DELETE | `/:customerId` | yes | Delete (refused if the customer has transactions) |

### Products: `/products`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | yes | Create (`name`, `price`, optional `stock`, `unit`, `category`) |
| GET | `/` | yes | List active products |
| PATCH | `/:productId` | yes | Edit a product |
| DELETE | `/:productId` | yes | Deactivate a product |

### Transactions: `/transactions`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | yes | Create a `SALE`, `PAYMENT` or `RETURN` |
| GET | `/` | yes | All transactions. Query: `type`, `search`, `from`, `to` (newest 500) |
| GET | `/summary` | yes | Total sales, total collected, total outstanding, latest 6 |
| GET | `/customer/:customerId` | yes | One customer's transactions |
| GET | `/customer/:customerId/balance` | yes | One customer's balance |
| GET | `/:transactionId` | yes | One transaction |
| PATCH | `/:transactionId` | yes | Edit a transaction (stock and balance are corrected) |
| DELETE | `/:transactionId` | yes | Delete a transaction (stock and balance are reversed) |

**Request bodies for `POST /transactions`**

```json
// SALE
{ "customerId": "...", "type": "SALE", "date": "2026-10-05", "note": "optional",
  "items": [{ "productId": "...", "quantity": 2 }] }

// PAYMENT
{ "customerId": "...", "type": "PAYMENT", "amount": 100,
  "payment": { "method": "Cash", "receivedBy": "Self", "reference": "optional" } }

// RETURN
{ "customerId": "...", "type": "RETURN",
  "items": [{ "productId": "...", "quantity": 1 }],
  "returnInfo": { "reason": "Damaged" } }
```

> A Postman collection with every request is in `docs/` (add it after exporting).

---

## Getting started

### Requirements

- Node.js 18 or newer
- A MongoDB **replica set**. MongoDB Atlas works out of the box, and the free tier is enough. Transactions do not work on a plain standalone `mongod`.

### Install and run

```bash
git clone <this-repo-url>
cd <repo-folder>
npm install
cp .env.sample .env      # then fill in the values
npm run dev
```

The server starts on `PORT` (default `5000`) and logs `MongoDB Connected` when the database is reachable.

### Environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (a replica set, for example Atlas) |
| `PORT` | Port to listen on (default `5000`) |
| `NODE_ENV` | `development` or `production` (controls cookie flags and error detail) |
| `CLIENT_URL` | Frontend origin for CORS and email links, no trailing slash |
| `ACCESS_TOKEN_SECRET` | Secret for access tokens (use a long random string) |
| `ACCESS_TOKEN_EXPIRY` | For example `15m` |
| `REFRESH_TOKEN_SECRET` | Secret for refresh tokens (different from the access secret) |
| `REFRESH_TOKEN_EXPIRY` | For example `7d` |
| `EMAIL_VERIFICATION` | Set to `off` to create accounts as already verified. Any other value, or unset, keeps verification on |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Mail server used for verification emails |
| `MAIL_FROM` | Sender address for verification emails |

### Project structure

```
src/
  index.js            starts the server after connecting to the database
  app.js              middleware, routes, 404 and error handling
  db/                 database connection
  routes/             URL to controller mapping
  controllers/        request handling and business rules
  models/             Mongoose schemas
  middlewares/        auth (JWT) and rate limiters
  utils/              asyncHandler, ApiError, ApiResponse, token helpers
  config/             email sending
```

---

## Testing

The project is tested manually with a written checklist that covers the money rules end to end: sales, payments and returns, edit and delete with correct stock and balance, the failed-request rollback, the blocked return delete, authentication and token refresh, rate limits, and data isolation between two accounts. There are no automated tests yet.

## Deployment notes

- Set every variable above in the host's environment settings.
- `NODE_ENV=production` turns on `secure` cookies and `sameSite: none`, which are required when the frontend and backend are on different domains.
- The live demo runs with `EMAIL_VERIFICATION=off`, because the free hosting plan blocks outbound SMTP. The verification flow is fully implemented, and it works when SMTP is available.
- Allow the host's outbound traffic in MongoDB Atlas network access.

## Known limitations

- Money is stored as numbers rounded to two decimals, not as integer paise.
- `GET /transactions` returns the newest 500 transactions and has no pagination.
- A transaction has no direct owner field. Ownership is checked through its customer.
- Refresh tokens are stored as issued in the database (not hashed).
- Rate limits are kept in server memory, so they reset on restart.
- A sale that contains a product removed afterwards cannot be edited until that item is deleted from the sale.
- There is no password reset or email change yet.

## Possible improvements

- Integer money (paise) and a `shopkeeper` field on transactions.
- Pagination for the transaction list.
- Automated tests for the balance and stock rules.
- Password reset and profile settings.
- Hashing stored refresh tokens.

## Author

`<Ashiq-Hussain-Kumar>` · `<https://github.com/Ashiq-Hussain-Kumar>` ·