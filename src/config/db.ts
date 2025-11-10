import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool;

// Detect Vercel environment
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// Use MYSQL_URL in production/Vercel, fallback to individual params locally
if (process.env.MYSQL_URL) {
  console.log(`🌐 Using MySQL URL connection (${isVercel ? 'Vercel' : 'Railway'})...`);
  pool = mysql.createPool({
    uri: process.env.MYSQL_URL,
    waitForConnections: true,
    connectionLimit: isVercel ? 1 : 5, // Very low for serverless
    maxIdle: 1,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000, // 10 second timeout
  });
} else {
  console.log("💻 Using Local MySQL configuration...");
  pool = mysql.createPool({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQLDATABASE || "bookmark_manager",
    port: parseInt(process.env.MYSQLPORT || "3306"),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// Test connection only in local development
if (!isVercel && process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      const connection = await pool.getConnection();
      console.log("✅ MySQL connected successfully (Local)");
      connection.release();
    } catch (error) {
      console.error("❌ MySQL connection failed:", error);
    }
  })();
}

export default pool;