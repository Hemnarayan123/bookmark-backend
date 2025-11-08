import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

// Only load .env in development
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

let pool: Pool;

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

console.log("Debug ENV MYSQL_URL:", mysqlUrl ? "Exists ✅" : "Missing ❌");
console.log("NODE_ENV:", process.env.NODE_ENV);

try {
  if (mysqlUrl) {
    console.log("🌐 Connecting to Railway MySQL...");
    pool = mysql.createPool({
      uri: mysqlUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  } else {
    console.log("💻 Connecting to Local MySQL...");
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "bookmark_manager",
      port: parseInt(process.env.DB_PORT || "3306"),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  // Test connection
  (async () => {
    try {
      const connection = await pool.getConnection();
      console.log("✅ MySQL Database connected successfully");
      connection.release();
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      process.exit(1);
    }
  })();
} catch (error) {
  console.error("❌ Database connection failed:", error);
  process.exit(1);
}

export default pool;