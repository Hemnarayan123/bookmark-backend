import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import bookmarkRoutes from "./routes/bookmarkRoutes";
import tagRoutes from "./routes/tagRoutes";
import publicRoutes from "./routes/publicRoutes";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS setup for both local & Vercel
app.use(
  cors({
    origin: [
      process.env.CORS_ORIGIN || "http://localhost:5173",
      "https://smart-bookmark.vercel.app",
      "https://your-frontend-app.vercel.app" // add your real frontend domain
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Health check route (root)
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "🚀 Smart Bookmark Manager API is live on Vercel!",
    version: "2.0.0",
  });
});

// ✅ Register all API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/public", publicRoutes);

// ✅ Global error handler (must be last)
app.use(errorHandler);

// ✅ Export for Vercel (critical!)
export {app}

// ✅ Local-only server start
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`💻 Server running locally on http://localhost:${PORT}`);
  });
}
