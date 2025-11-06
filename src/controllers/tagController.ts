import { Response } from "express";
import pool from "../config/db";
import { createTagSchema, sanitizeString } from "../utils/validation";
import { AuthRequest } from "../types";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Get user's tags
export const getAllTags = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, COUNT(bt.bookmark_id) as usage_count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY usage_count DESC, t.name`,
      [req.user.userId]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tags",
    });
  }
};

// Create tag
export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const validatedData = createTagSchema.parse(req.body);
    const tagName = sanitizeString(validatedData.name);

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO tags (user_id, name) VALUES (?, ?)",
      [req.user.userId, tagName]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM tags WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: rows[0],
      message: "Tag created successfully",
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        error: "Tag already exists",
      });
    }
    console.error("Create tag error:", error);
    throw error;
  }
};

// Delete tag
export const deleteTag = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM tags WHERE id = ? AND user_id = ?",
      [id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Tag not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("Delete tag error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete tag",
    });
  }
};
