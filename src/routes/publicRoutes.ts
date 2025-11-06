import express from "express";
import {
  getPublicBookmarks,
  getUserPublicBookmarks,
  getPopularTags,
} from "../controllers/publicController";

const router = express.Router();

router.get("/bookmarks", getPublicBookmarks);
router.get("/users/:username/bookmarks", getUserPublicBookmarks);
router.get("/tags", getPopularTags);

export default router;
