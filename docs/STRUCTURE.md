# Project structure

The project is now organized around a safe production-oriented base:

```txt
Dayen/
+-- apps/
|   +-- api/          # Node.js + Express + TypeScript backend
|   +-- web/          # React + Vite frontend
+-- storage/
|   +-- uploads/      # Local uploaded files for development
+-- legacy/           # Old HTML/CSS/JS frontend kept as reference
+-- docker-compose.yml
+-- package.json      # Root scripts for web/api commands
+-- README.txt
```

## Root scripts

```bash
npm run web:dev
npm run web:build
npm run web:preview
npm run api:dev
npm run api:build
npm run api:test
```

## Frontend

The frontend lives in `apps/web`.

Current main folders:

```txt
apps/web/src/
+-- features/
+-- providers/
+-- services/
+-- shell/
+-- styles/
+-- types/
+-- views/
```

## Backend

The backend lives in `apps/api`.

Current main folders:

```txt
apps/api/
+-- db/
+-- middleware/
+-- modules/
+   +-- admin/
+   +-- auth/
+   +-- catalog/
+   +-- notifications/
+   +-- orders/
+   +-- products/
+   +-- profile/
+   +-- sellers/
+   +-- uploads/
+-- services/
+-- tests/
+-- types/
+-- utils/
+-- server.ts
```

Each module owns its route files in `modules/<domain>/routes`.
Shared technical code still lives in `db`, `middleware`, `services`, `types`, and `utils`.
This keeps the migration safe while preparing the backend for the next layer split:
controllers, services, repositories, and schemas inside each module.

Current layered modules:

```txt
apps/api/modules/products/
+-- controllers/
+-- repositories/
+-- routes/
+-- services/

apps/api/modules/orders/
+-- controllers/
+-- routes/
+-- services/

apps/api/modules/admin/
+-- controllers/
+-- repositories/
+-- routes/
+-- services/

apps/api/modules/sellers/
+-- controllers/
+-- repositories/
+-- routes/
+-- services/
```

`products` now owns product listing/details, product actions, favorites, ratings, and reviews
through a route -> controller -> service -> repository flow.

`orders` now owns order creation, user orders, repeat order, order history, seller sales,
payment status updates, and seller/admin order status actions through route -> controller -> service.

`admin` now keeps thin route entry points and routes admin catalog/product/seller-request/tool
handlers through controller -> service -> repository layers.

`sellers` now keeps thin route entry points and moves seller public pages, seller profile,
seller applications, and seller product handlers into controllers. Seller product CRUD and
pagination/filtering already use service and repository layers.

## Uploads

Uploaded files are stored outside the backend app:

```txt
storage/uploads/
```

The backend reads the path from `UPLOAD_DIR`.

Local default:

```txt
../../storage/uploads
```

Docker value:

```txt
UPLOAD_DIR=/app/uploads
```

## Legacy

`legacy/` stores the old static version and is not part of the current React/Vite app:

```txt
legacy/
+-- about/
+-- css/
+-- frontend/
+-- js/
```

Keep it only as a reference until the final QA pass is complete. Do not use it for the diploma demonstration; the current frontend is `apps/web`.
