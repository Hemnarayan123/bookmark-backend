-- Create database
CREATE DATABASE IF NOT EXISTS bookmark_manager;
USE bookmark_manager;

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(2048) NOT NULL UNIQUE,
  description TEXT,
  favicon VARCHAR(2048),
  folder VARCHAR(100) DEFAULT 'Unsorted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_folder (folder),
  INDEX idx_created (created_at),
  INDEX idx_url (url(255))
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Bookmark-Tags junction table
CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  INDEX idx_bookmark (bookmark_id),
  INDEX idx_tag (tag_id)
);

-- Insert sample data (optional)
INSERT INTO bookmarks (title, url, description, folder, favicon) VALUES
('GitHub', 'https://github.com', 'Where the world builds software', 'Development', 'https://github.com/favicon.ico'),
('Stack Overflow', 'https://stackoverflow.com', 'Q&A for developers', 'Development', 'https://stackoverflow.com/favicon.ico'),
('MDN Web Docs', 'https://developer.mozilla.org', 'Web technology documentation', 'Learning', 'https://developer.mozilla.org/favicon.ico');

INSERT INTO tags (name) VALUES
('programming'),
('javascript'),
('learning'),
('tools');

INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES
(1, 1),
(1, 4),
(2, 1),
(3, 2),
(3, 3);


-- ============================================
-- Migration Script: Single-User to Multi-User
-- Bookmark Manager with Public/Private Support
-- ============================================

USE bookmark_manager;

-- ============================================
-- STEP 1: Create Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_username (username),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 2: Create Default System User
-- ============================================
-- Password: "admin123" (CHANGE THIS IN PRODUCTION!)
INSERT INTO users (username, email, password_hash, full_name, is_active)
VALUES (
  'system_admin',
  'admin@bookmark-manager.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIWNc.QzOy',
  'System Administrator',
  TRUE
);

-- ============================================
-- STEP 3: Modify Bookmarks Table
-- ============================================

-- Add user_id column (NULLABLE first)
ALTER TABLE bookmarks 
ADD COLUMN user_id INT NULL AFTER id;

-- Assign all existing bookmarks to default user
UPDATE bookmarks 
SET user_id = (SELECT id FROM users WHERE username = 'system_admin' LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE bookmarks 
MODIFY COLUMN user_id INT NOT NULL;

-- Add foreign key constraint
ALTER TABLE bookmarks 
ADD CONSTRAINT fk_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id index
ALTER TABLE bookmarks 
ADD INDEX idx_user_id (user_id);

-- Add is_public column
ALTER TABLE bookmarks 
ADD COLUMN is_public BOOLEAN DEFAULT FALSE AFTER folder;

-- Add indexes for is_public
ALTER TABLE bookmarks 
ADD INDEX idx_is_public (is_public),
ADD INDEX idx_user_public (user_id, is_public);

-- Update unique constraint (drop old, add new per-user)
ALTER TABLE bookmarks DROP INDEX uq_url;
ALTER TABLE bookmarks 
ADD UNIQUE KEY uq_user_url (user_id, url(191));

-- ============================================
-- STEP 4: Modify Tags Table
-- ============================================

-- Add user_id column (NULLABLE first)
ALTER TABLE tags 
ADD COLUMN user_id INT NULL AFTER id;

-- Assign all existing tags to default user
UPDATE tags 
SET user_id = (SELECT id FROM users WHERE username = 'system_admin' LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE tags 
MODIFY COLUMN user_id INT NOT NULL;

-- Add foreign key and index
ALTER TABLE tags 
ADD CONSTRAINT fk_tag_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
ADD INDEX idx_tag_user (user_id);

-- Update unique constraint
ALTER TABLE tags DROP INDEX name;
ALTER TABLE tags 
ADD UNIQUE KEY uq_user_tag (user_id, name);

-- ============================================
-- STEP 5: Create User Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 6: Create Public Bookmark Views (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS public_bookmark_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bookmark_id INT NOT NULL,
  viewer_user_id INT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_bookmark (bookmark_id),
  INDEX idx_viewer (viewer_user_id),
  INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 7: Verify Migration
-- ============================================

-- Check users table
SELECT 'Users Table:' as Info;
SELECT * FROM users;

-- Check bookmarks with user_id
SELECT 'Bookmarks (first 5):' as Info;
SELECT id, user_id, title, is_public, folder FROM bookmarks LIMIT 5;

-- Check tags with user_id
SELECT 'Tags:' as Info;
SELECT * FROM tags;

-- Show table structures
SELECT 'Bookmarks Table Structure:' as Info;
SHOW CREATE TABLE bookmarks;

SELECT 'Tags Table Structure:' as Info;
SHOW CREATE TABLE tags;

-- ============================================
-- OPTIONAL: Create Additional Users for Testing
-- ============================================

-- User 1: john_doe (password: "test1234")
INSERT INTO users (username, email, password_hash, full_name)
VALUES (
  'john_doe',
  'john@example.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'John Doe'
);

-- User 2: jane_smith (password: "test1234")
INSERT INTO users (username, email, password_hash, full_name)
VALUES (
  'jane_smith',
  'jane@example.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Jane Smith'
);

-- ============================================
-- Migration Complete!
-- ============================================
SELECT '✅ Migration completed successfully!' as Status;