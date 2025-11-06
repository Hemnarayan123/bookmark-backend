import { Response } from "express";
import pool from "../config/db";
import { AuthRequest, RegisterDTO, LoginDTO, UserPublic } from "../types";
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} from "../utils/password";
import { generateTokenPair } from "../utils/jwt";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Register new user
export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, full_name }: RegisterDTO = req.body;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.message,
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Username or email already exists",
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)",
      [username, email, password_hash, full_name || null]
    );

    const userId = result.insertId;

    // Generate tokens
    const tokens = generateTokenPair({
      userId,
      username,
      email,
    });

    // Get created user
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, username, email, full_name, avatar_url, created_at FROM users WHERE id = ?",
      [userId]
    );

    const user: UserPublic = users[0] as UserPublic;

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens,
      },
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
};

// Login
export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password }: LoginDTO = req.body;

    // Find user
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    // Return user data without password
    const userPublic: UserPublic = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    };

    res.json({
      success: true,
      data: {
        user: userPublic,
        tokens,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};

// Get current user
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, username, email, full_name, avatar_url, created_at, last_login FROM users WHERE id = ?",
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
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user data",
    });
  }
};

// Logout (client-side token removal)
export const logout = async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
};
