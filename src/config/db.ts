import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool;

try {
  if (process.env.MYSQL_URL) {
    // ✅ Railway / Production Environment
    console.log("🌐 Connecting to Railway MySQL...");

    pool = mysql.createPool({
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  } else {
    // ✅ Local Development Environment
    console.log("💻 Connecting to Local MySQL...");

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

  // Test Connection Immediately
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
