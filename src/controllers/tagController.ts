import { Request, Response } from 'express';
import pool from '../config/db';
import { createTagSchema, sanitizeString } from '../utils/validation';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Get all tags
export const getAllTags = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, COUNT(bt.bookmark_id) as usage_count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
       GROUP BY t.id
       ORDER BY usage_count DESC, t.name`
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags'
    });
  }
};

// Create tag
export const createTag = async (req: Request, res: Response) => {
  try {
    const validatedData = createTagSchema.parse(req.body);
    const tagName = sanitizeString(validatedData.name);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO tags (name) VALUES (?)',
      [tagName]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tags WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Tag created successfully'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Tag already exists'
      });
    }
    console.error('Create tag error:', error);
    throw error;
  }
};

// Delete tag
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM tags WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag'
    });
  }
};