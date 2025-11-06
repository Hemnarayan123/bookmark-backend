import express from "express";
import {
  getAllBookmarks,
  getBookmarkById,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getAllFolders,
  togglePrivacy,
} from "../controllers/bookmarkController";
import { authenticateToken, optionalAuth } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticateToken, getAllBookmarks);
router.get("/folders", authenticateToken, getAllFolders);
router.get("/:id", optionalAuth, getBookmarkById);
router.post("/", authenticateToken, createBookmark);
router.put("/:id", authenticateToken, updateBookmark);
router.patch("/:id/privacy", authenticateToken, togglePrivacy);
router.delete("/:id", authenticateToken, deleteBookmark);

export default router;
