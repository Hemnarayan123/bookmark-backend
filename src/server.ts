import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import bookmarkRoutes from "./routes/bookmarkRoutes";
import tagRoutes from "./routes/tagRoutes";
import publicRoutes from "./routes/publicRoutes";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Smart Bookmark Manager API - Multi-User",
    version: "2.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      bookmarks: "/api/bookmarks",
      tags: "/api/tags",
      public: "/api/public",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/public", publicRoutes);

// Error handler (must be last)
app.use(errorHandler);

// ✅ Export app for Vercel
export default app;

// ✅ Local-only listener
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}
