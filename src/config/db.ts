import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool;
console.log("Debug ENV MYSQL_URL:", process.env.MYSQL_URL ? "Exists ✅" : "Missing ❌");

try {
  if (process.env.MYSQL_URL) {
    // ✅ Railway Environment
    console.log("🌐 Connecting to Railway MySQL...");
    pool = mysql.createPool({
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  } else {
    // ✅ Local Environment
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

  // Optional: Test connection
  (async () => {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Database connected successfully");
    connection.release();
  })();
} catch (error) {
  console.error("❌ Database connection failed:", error);
  process.exit(1);
}


export default pool;