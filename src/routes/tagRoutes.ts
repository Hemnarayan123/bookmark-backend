import express from "express";
import { getAllTags, createTag, deleteTag } from "../controllers/tagController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticateToken, getAllTags);
router.post("/", authenticateToken, createTag);
router.delete("/:id", authenticateToken, deleteTag);

export default router;
