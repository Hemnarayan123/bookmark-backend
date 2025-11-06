import { Response } from "express";
import pool from "../config/db";
import { AuthRequest, UpdateProfileDTO, ChangePasswordDTO } from "../types";
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} from "../utils/password";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Get user profile
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, email, full_name, avatar_url, created_at, last_login,
              (SELECT COUNT(*) FROM bookmarks WHERE user_id = users.id) as total_bookmarks,
              (SELECT COUNT(*) FROM bookmarks WHERE user_id = users.id AND is_public = TRUE) as public_bookmarks
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { full_name, avatar_url }: UpdateProfileDTO = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (full_name !== undefined) {
      updates.push("full_name = ?");
      params.push(full_name);
    }

    if (avatar_url !== undefined) {
      updates.push("avatar_url = ?");
      params.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      });
    }

    params.push(req.user.userId);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, username, email, full_name, avatar_url, created_at FROM users WHERE id = ?",
      [req.user.userId]
    );

    res.json({
      success: true,
      data: users[0],
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

// Change password
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { current_password, new_password }: ChangePasswordDTO = req.body;

    // Validate new password
    const passwordValidation = validatePasswordStrength(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.message,
      });
    }

    // Get current user
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      current_password,
      users[0].password_hash
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const new_password_hash = await hashPassword(new_password);

    // Update password
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      new_password_hash,
      req.user.userId,
    ]);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
};

// Get public profile by username
export const getPublicProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, full_name, avatar_url, created_at,
              (SELECT COUNT(*) FROM bookmarks WHERE user_id = users.id AND is_public = TRUE) as public_bookmarks
       FROM users WHERE username = ? AND is_active = TRUE`,
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    console.error("Get public profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Delete account
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { password } = req.body;

    // Verify password before deletion
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isPasswordValid = await comparePassword(
      password,
      users[0].password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Password is incorrect",
      });
    }

    // Delete user (cascades to bookmarks, tags, etc.)
    await pool.query("DELETE FROM users WHERE id = ?", [req.user.userId]);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete account",
    });
  }
};
