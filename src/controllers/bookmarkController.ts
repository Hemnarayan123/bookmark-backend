import { Response } from "express";
import pool from "../config/db";
import { fetchMetadata } from "../utils/metadataFetcher";
import { sanitizeString } from "../utils/validation";
import { BookmarkWithTags, AuthRequest } from "../types";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Get user's bookmarks (private + public)
export const getAllBookmarks = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { folder, tag, search } = req.query;

    let query = `
      SELECT DISTINCT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.user_id = ?
    `;

    const params: any[] = [req.user.userId];

    if (folder) {
      query += " AND b.folder = ?";
      params.push(folder);
    }

    if (tag) {
      query += " AND t.name = ?";
      params.push(tag);
    }

    if (search) {
      query += " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += " GROUP BY b.id ORDER BY b.created_at DESC";

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const bookmarks: BookmarkWithTags[] = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: Boolean(row.is_public),
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
    }));

    res.json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bookmarks",
    });
  }
};

// Get single bookmark (with auth check)
export const getBookmarkById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids,
        u.username, u.full_name, u.avatar_url
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = ?
      GROUP BY b.id`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Bookmark not found",
      });
    }

    const row = rows[0];

    // Check access: owner or public
    if (row.user_id !== req.user?.userId && !row.is_public) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const bookmark: BookmarkWithTags = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: Boolean(row.is_public),
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
    };

    res.json({
      success: true,
      data: bookmark,
    });
  } catch (error) {
    console.error("Get bookmark error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bookmark",
    });
  }
};

// Create bookmark
export const createBookmark = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { url, tags, folder = "Unsorted", is_public = false } = req.body;
    let { title, description, favicon } = req.body;

    // Fetch metadata if not provided
    if (!title || !description || !favicon) {
      const metadata = await fetchMetadata(url);
      title = title || metadata.title;
      description = description || metadata.description;
      favicon = favicon || metadata.favicon;
    }

    // Insert bookmark
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO bookmarks (user_id, title, url, description, favicon, folder, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        sanitizeString(title),
        url,
        description,
        favicon,
        folder,
        is_public,
      ]
    );

    const bookmarkId = result.insertId;

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const sanitizedTag = sanitizeString(tagName);

        // Insert or get tag for this user
        await pool.query(
          "INSERT IGNORE INTO tags (user_id, name) VALUES (?, ?)",
          [req.user.userId, sanitizedTag]
        );

        const [tagRows] = await pool.query<RowDataPacket[]>(
          "SELECT id FROM tags WHERE user_id = ? AND name = ?",
          [req.user.userId, sanitizedTag]
        );

        if (tagRows.length > 0) {
          await pool.query(
            "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
            [bookmarkId, tagRows[0].id]
          );
        }
      }
    }

    // Fetch created bookmark with tags
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.id = ?
      GROUP BY b.id`,
      [bookmarkId]
    );

    const row = rows[0];
    const bookmark: BookmarkWithTags = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: Boolean(row.is_public),
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
    };

    res.status(201).json({
      success: true,
      data: bookmark,
      message: "Bookmark created successfully",
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        error: "You already have a bookmark with this URL",
      });
    }
    console.error("Create bookmark error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create bookmark",
    });
  }
};

// Update bookmark (owner only)
export const updateBookmark = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { id } = req.params;
    const { title, description, folder, is_public, tags } = req.body;

    // Check ownership
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT user_id FROM bookmarks WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Bookmark not found",
      });
    }

    if (existing[0].user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Update bookmark fields
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(sanitizeString(title));
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (folder !== undefined) {
      updates.push("folder = ?");
      params.push(folder);
    }
    if (is_public !== undefined) {
      updates.push("is_public = ?");
      params.push(is_public);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE bookmarks SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    // Update tags if provided
    if (tags !== undefined) {
      await pool.query("DELETE FROM bookmark_tags WHERE bookmark_id = ?", [id]);

      for (const tagName of tags) {
        const sanitizedTag = sanitizeString(tagName);

        await pool.query(
          "INSERT IGNORE INTO tags (user_id, name) VALUES (?, ?)",
          [req.user.userId, sanitizedTag]
        );

        const [tagRows] = await pool.query<RowDataPacket[]>(
          "SELECT id FROM tags WHERE user_id = ? AND name = ?",
          [req.user.userId, sanitizedTag]
        );

        if (tagRows.length > 0) {
          await pool.query(
            "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
            [id, tagRows[0].id]
          );
        }
      }
    }

    // Fetch updated bookmark
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.id = ?
      GROUP BY b.id`,
      [id]
    );

    const row = rows[0];
    const bookmark: BookmarkWithTags = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      is_public: Boolean(row.is_public),
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
    };

    res.json({
      success: true,
      data: bookmark,
      message: "Bookmark updated successfully",
    });
  } catch (error) {
    console.error("Update bookmark error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update bookmark",
    });
  }
};

// Delete bookmark (owner only)
export const deleteBookmark = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM bookmarks WHERE id = ? AND user_id = ?",
      [id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Bookmark not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Bookmark deleted successfully",
    });
  } catch (error) {
    console.error("Delete bookmark error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete bookmark",
    });
  }
};

// Toggle privacy
export const togglePrivacy = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { id } = req.params;

    const [bookmarks] = await pool.query<RowDataPacket[]>(
      "SELECT user_id, is_public FROM bookmarks WHERE id = ?",
      [id]
    );

    if (bookmarks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Bookmark not found",
      });
    }

    if (bookmarks[0].user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const newPrivacy = !bookmarks[0].is_public;

    await pool.query("UPDATE bookmarks SET is_public = ? WHERE id = ?", [
      newPrivacy,
      id,
    ]);

    res.json({
      success: true,
      data: { is_public: newPrivacy },
      message: `Bookmark is now ${newPrivacy ? "public" : "private"}`,
    });
  } catch (error) {
    console.error("Toggle privacy error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle privacy",
    });
  }
};

// Get user's folders
export const getAllFolders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT folder, COUNT(*) as count 
       FROM bookmarks 
       WHERE user_id = ?
       GROUP BY folder 
       ORDER BY folder`,
      [req.user.userId]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get folders error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch folders",
    });
  }
};
