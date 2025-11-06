import { Request, Response } from "express";
import pool from "../config/db";
import { BookmarkWithTags, AuthRequest } from "../types";
import { RowDataPacket } from "mysql2";

// Get all public bookmarks
export const getPublicBookmarks = async (req: Request, res: Response) => {
  try {
    const { tag, search, limit = "50", offset = "0" } = req.query;

    let query = `
      SELECT DISTINCT b.*, 
        GROUP_CONCAT(DISTINCT t.name) as tag_names,
        GROUP_CONCAT(DISTINCT t.id) as tag_ids,
        u.username, u.full_name, u.avatar_url
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.is_public = TRUE
    `;

    const params: any[] = [];

    if (tag) {
      query += " AND t.name = ?";
      params.push(tag);
    }

    if (search) {
      query +=
        " AND (b.title LIKE ? OR b.description LIKE ? OR u.username LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += " GROUP BY b.id ORDER BY b.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit as string), parseInt(offset as string));

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const bookmarks: BookmarkWithTags[] = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names
        ? row.tag_names.split(",").map((name: string, idx: number) => ({
            id: parseInt(row.tag_ids.split(",")[idx]),
            user_id: row.user_id,
            name: name,
            created_at: new Date(),
          }))
        : [],
      user: {
        id: row.user_id,
        username: row.username,
        email: "",
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        created_at: new Date(),
      },
    }));

    res.json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    console.error("Get public bookmarks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch public bookmarks",
    });
  }
};

// Get user's public bookmarks by username
export const getUserPublicBookmarks = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { limit = "50", offset = "0" } = req.query;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids,
        u.username, u.full_name, u.avatar_url
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE u.username = ? AND b.is_public = TRUE
      GROUP BY b.id 
      ORDER BY b.created_at DESC 
      LIMIT ? OFFSET ?`,
      [username, parseInt(limit as string), parseInt(offset as string)]
    );

    const bookmarks: BookmarkWithTags[] = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names
        ? row.tag_names.split(",").map((name: string, idx: number) => ({
            id: parseInt(row.tag_ids.split(",")[idx]),
            user_id: row.user_id,
            name: name,
            created_at: new Date(),
          }))
        : [],
      user: {
        id: row.user_id,
        username: row.username,
        email: "",
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        created_at: new Date(),
      },
    }));

    res.json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    console.error("Get user public bookmarks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bookmarks",
    });
  }
};

// Get popular public tags
export const getPopularTags = async (req: Request, res: Response) => {
  try {
    const { limit = "20" } = req.query;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.name, COUNT(DISTINCT bt.bookmark_id) as usage_count
       FROM tags t
       INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
       INNER JOIN bookmarks b ON bt.bookmark_id = b.id
       WHERE b.is_public = TRUE
       GROUP BY t.id, t.name
       ORDER BY usage_count DESC
       LIMIT ?`,
      [parseInt(limit as string)]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get popular tags error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tags",
    });
  }
};
