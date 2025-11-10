import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool;

if (process.env.MYSQL_URL) {
  console.log("🌐 Using Railway MySQL (URL)...");
  pool = mysql.createPool({
    uri: process.env.MYSQL_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
} else {
  console.log("💻 Using Local MySQL...");
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

if (process.env.NODE_ENV !== "production") {
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
