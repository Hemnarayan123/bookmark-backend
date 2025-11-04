import { Request, Response } from 'express';
import pool from '../config/db';
import { fetchMetadata } from '../utils/metadataFetcher';
import { createBookmarkSchema, updateBookmarkSchema, sanitizeString } from '../utils/validation';
import { BookmarkWithTags, Bookmark, Tag } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Get all bookmarks with tags
export const getAllBookmarks = async (req: Request, res: Response) => {
  try {
    const { folder, tag, search } = req.query;

    let query = `
      SELECT DISTINCT b.*, 
        GROUP_CONCAT(t.name) as tag_names,
        GROUP_CONCAT(t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (folder) {
      conditions.push('b.folder = ?');
      params.push(folder);
    }

    if (tag) {
      conditions.push('t.name = ?');
      params.push(tag);
    }

    if (search) {
      conditions.push('(b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY b.id ORDER BY b.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const bookmarks: BookmarkWithTags[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names ? 
        row.tag_names.split(',').map((name: string, idx: number) => ({
          id: parseInt(row.tag_ids.split(',')[idx]),
          name: name,
          created_at: new Date()
        })) : []
    }));

    res.json({
      success: true,
      data: bookmarks
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarks'
    });
  }
};

// Get single bookmark
export const getBookmarkById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }

    const row = rows[0];
    const bookmark: BookmarkWithTags = {
      id: row.id,
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names ? 
        row.tag_names.split(',').map((name: string, idx: number) => ({
          id: parseInt(row.tag_ids.split(',')[idx]),
          name: name,
          created_at: new Date()
        })) : []
    };

    res.json({
      success: true,
      data: bookmark
    });
  } catch (error) {
    console.error('Get bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmark'
    });
  }
};

// Create bookmark
export const createBookmark = async (req: Request, res: Response) => {
  try {
    const validatedData = createBookmarkSchema.parse(req.body);
    const { url, tags, folder = 'Unsorted' } = validatedData;

    // Fetch metadata if not provided
    let { title, description, favicon } = validatedData;
    
    if (!title || !description || !favicon) {
      const metadata = await fetchMetadata(url);
      title = title || metadata.title;
      description = description || metadata.description;
      favicon = favicon || metadata.favicon;
    }

    // Insert bookmark
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO bookmarks (title, url, description, favicon, folder)
       VALUES (?, ?, ?, ?, ?)`,
      [sanitizeString(title), url, description, favicon, folder]
    );

    const bookmarkId = result.insertId;

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const sanitizedTag = sanitizeString(tagName);
        
        // Insert or get tag
        await pool.query(
          'INSERT IGNORE INTO tags (name) VALUES (?)',
          [sanitizedTag]
        );

        const [tagRows] = await pool.query<RowDataPacket[]>(
          'SELECT id FROM tags WHERE name = ?',
          [sanitizedTag]
        );

        if (tagRows.length > 0) {
          await pool.query(
            'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
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
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names ? 
        row.tag_names.split(',').map((name: string, idx: number) => ({
          id: parseInt(row.tag_ids.split(',')[idx]),
          name: name,
          created_at: new Date()
        })) : []
    };

    res.status(201).json({
      success: true,
      data: bookmark,
      message: 'Bookmark created successfully'
    });
  } catch (error) {
    console.error('Create bookmark error:', error);
    throw error;
  }
};

// Update bookmark
export const updateBookmark = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateBookmarkSchema.parse(req.body);
    const { title, description, folder, tags } = validatedData;

    // Check if bookmark exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM bookmarks WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }

    // Update bookmark fields
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(sanitizeString(title));
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (folder !== undefined) {
      updates.push('folder = ?');
      params.push(folder);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Update tags if provided
    if (tags !== undefined) {
      // Remove existing tags
      await pool.query('DELETE FROM bookmark_tags WHERE bookmark_id = ?', [id]);

      // Add new tags
      for (const tagName of tags) {
        const sanitizedTag = sanitizeString(tagName);
        
        await pool.query(
          'INSERT IGNORE INTO tags (name) VALUES (?)',
          [sanitizedTag]
        );

        const [tagRows] = await pool.query<RowDataPacket[]>(
          'SELECT id FROM tags WHERE name = ?',
          [sanitizedTag]
        );

        if (tagRows.length > 0) {
          await pool.query(
            'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
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
      title: row.title,
      url: row.url,
      description: row.description,
      favicon: row.favicon,
      folder: row.folder,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tags: row.tag_names ? 
        row.tag_names.split(',').map((name: string, idx: number) => ({
          id: parseInt(row.tag_ids.split(',')[idx]),
          name: name,
          created_at: new Date()
        })) : []
    };

    res.json({
      success: true,
      data: bookmark,
      message: 'Bookmark updated successfully'
    });
  } catch (error) {
    console.error('Update bookmark error:', error);
    throw error;
  }
};

// Delete bookmark
export const deleteBookmark = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM bookmarks WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }

    res.json({
      success: true,
      message: 'Bookmark deleted successfully'
    });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bookmark'
    });
  }
};

// Get all folders
export const getAllFolders = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT folder, COUNT(*) as count 
       FROM bookmarks 
       GROUP BY folder 
       ORDER BY folder`
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch folders'
    });
  }
};