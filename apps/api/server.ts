import express from "express"
import cors from "cors"
import path from "path"

import { pool } from "./db/pool"
import { migrate } from "./db/migrate"

import { createAdminCategoriesRouter } from "./modules/admin/routes/admin-categories.routes"
import { createAdminProductCreateRouter } from "./modules/admin/routes/admin-product-create.routes"
import { createAdminProductsRouter } from "./modules/admin/routes/admin-products.routes"
import { createAdminSellerRequestsRouter } from "./modules/admin/routes/admin-seller-requests.routes"
import { createAdminToolsRouter } from "./modules/admin/routes/admin-tools.routes"
import { createAdminUsersRouter } from "./modules/admin/routes/admin-users.routes"
import { createAdminMarketplaceRouter } from "./modules/admin/routes/admin-marketplace.routes"
import { createAssistantRouter } from "./modules/assistant/routes/assistant.routes"
import { createAuthRouter } from "./modules/auth/routes/auth.routes"
import { createCategoriesPublicRouter } from "./modules/catalog/routes/categories-public.routes"
import { createMarketplacePublicRouter } from "./modules/catalog/routes/marketplace-public.routes"
import { createSearchRouter } from "./modules/catalog/routes/search.routes"
import { createTilesRouter } from "./modules/catalog/routes/tiles.routes"
import { createNotificationsRouter } from "./modules/notifications/routes/notifications.routes"
import { createOrderActionsRouter } from "./modules/orders/routes/order-actions.routes"
import { createOrdersRouter } from "./modules/orders/routes/orders.routes"
import { createProductActionsRouter } from "./modules/products/routes/product-actions.routes"
import { createProductsRouter } from "./modules/products/routes/products.routes"
import { createReviewsRouter } from "./modules/products/routes/reviews.routes"
import { createProfileRouter } from "./modules/profile/routes/profile.routes"
import { createSellerProductsRouter } from "./modules/sellers/routes/seller-products.routes"
import { createSellerProfileRouter } from "./modules/sellers/routes/seller-profile.routes"
import { createSellerRequestsRouter } from "./modules/sellers/routes/seller-requests.routes"
import { createSellersRouter } from "./modules/sellers/routes/sellers.routes"
import { createSupportRouter } from "./modules/support/routes/support.routes"
import { createUploadsRouter } from "./modules/uploads/routes/uploads.routes"

import { hashPassword, makeSalt, makeToken, nowPlusDays } from "./utils/crypto"
import { createAuthMiddleware } from "./middleware/auth"
import { requestContext } from "./middleware/request-context"
import { csrfOriginGuard, getAllowedOrigins, securityHeaders } from "./middleware/security"
import { normalizeImagesInput, saveProductImages } from "./utils/product-images"
import { createProductPresenters } from "./utils/product-presenters"
import { createUploadMiddleware, ensureDir, UPLOAD_BUCKETS } from "./utils/upload"
import { fail } from "./utils/http"

import { createEmailService } from "./services/email"


const app = express()
const PORT = process.env.PORT || 3000
const allowedOrigins = getAllowedOrigins()

const { authRequired, optionalAuth, adminRequired } =
  createAuthMiddleware({ pool })

const { attachImagesToProducts, withProductStats } =
  createProductPresenters(pool)

const emailService = createEmailService()

app.set("trust proxy", 1)
app.disable("x-powered-by")
app.use(requestContext)
app.use(securityHeaders)
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    return callback(null, allowedOrigins.has(origin.replace(/\/$/, "")))
  }
}))
app.use(express.json({ limit: "1mb" }))
app.use(csrfOriginGuard)

app.use(express.static("public"))

const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "../../storage/uploads")

ensureDir(uploadsDir)
Object.values(UPLOAD_BUCKETS).forEach((bucket) => ensureDir(path.join(uploadsDir, bucket)))

const publicUploads = express.static(uploadsDir)
const supportUploads = express.static(path.join(uploadsDir, UPLOAD_BUCKETS.support))

app.use(`/uploads/${UPLOAD_BUCKETS.support}`, authRequired, adminRequired, supportUploads)
app.use("/uploads", (req, res, next) => {
  const rawPath = String(req.path || "").replace(/\\/g, "/")
  let decodedPath = rawPath

  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    decodedPath = rawPath
  }

  const normalizedPath = path.posix.normalize(`/${decodedPath.replace(/\\/g, "/")}`).toLowerCase()
  const supportPrefix = `/${UPLOAD_BUCKETS.support}`.toLowerCase()

  if (normalizedPath === supportPrefix || normalizedPath.startsWith(`${supportPrefix}/`)) {
    return fail(res, 404, "not_found")
  }

  return publicUploads(req, res, next)
})

const upload = createUploadMiddleware(uploadsDir)

app.use("/api/reviews", createReviewsRouter({ pool, authRequired }))

app.use("/api", createCategoriesPublicRouter({
  pool,
  attachImagesToProducts,
  withProductStats
}))

app.use("/api", createMarketplacePublicRouter({ pool }))

app.use("/api", createAdminCategoriesRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createSearchRouter({ pool }))

app.use("/api", createProductsRouter({
  pool,
  attachImagesToProducts,
  withProductStats
}))

app.use("/api", createNotificationsRouter({ pool, authRequired }))

app.use("/api", createSupportRouter({
  pool,
  optionalAuth,
  authRequired,
  adminRequired
}))

app.use("/api", createAssistantRouter({
  pool,
  optionalAuth
}))

app.use("/api", createSellersRouter({
  pool,
  authRequired,
  attachImagesToProducts,
  withProductStats
}))

app.use("/api", createAuthRouter({
  pool,
  authRequired,
  hashPassword,
  makeSalt,
  makeToken,
  nowPlusDays,
  emailService
}))

app.use("/api", createOrdersRouter({ pool, authRequired }))

app.use("/api", createProductActionsRouter({
  pool,
  authRequired,
  withProductStats
}))

app.use("/api", createProfileRouter({
  pool,
  authRequired,
  upload,
  attachImagesToProducts,
  withProductStats
}))

app.use("/api", createAdminProductCreateRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages
}))

app.use("/api", createAdminProductsRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages
}))

app.use("/api", createOrderActionsRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createAdminToolsRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createAdminSellerRequestsRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createAdminUsersRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createAdminMarketplaceRouter({
  pool,
  authRequired,
  adminRequired
}))

app.use("/api", createSellerProfileRouter({
  pool,
  authRequired,
  attachImagesToProducts,
  withProductStats
}))

app.use("/api", createSellerRequestsRouter({ pool, authRequired }))

app.use("/api", createSellerProductsRouter({
  pool,
  authRequired,
  normalizeImagesInput,
  saveProductImages
}))

app.use("/api", createTilesRouter({ pool }))

app.use("/api", createUploadsRouter({
  authRequired,
  upload
}))

app.use((err: any, _req: any, res: any, _next: any) => {
  if (!err) return fail(res, 500, "unknown")
  if (err.message === "bad_file_type") return fail(res, 400, "bad_file_type")
  if (err.code === "LIMIT_FILE_SIZE") return fail(res, 400, "file_too_large")
  return fail(res, 500, "server_error")
})

app.get("/", (_req, res) => {
  res.send("Marketplace API running")
})

async function startServer() {
  try {
    if (process.env.RUN_MIGRATIONS_ON_START !== "0") {
      console.log("Running database migrations...")
      await migrate()
      console.log("Database migrations ready")
    }

    app.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Server startup failed:", error)
    await pool.end().catch(() => {})
    process.exit(1)
  }
}

void startServer()
