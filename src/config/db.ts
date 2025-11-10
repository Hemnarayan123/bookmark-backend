import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool | null = null; // ✅ initialize as null to avoid TS warning

export function getPool(): Pool {
  if (!pool) {
    if (process.env.MYSQL_URL) {
      // ✅ Railway / Production
      console.log("🌐 Using Railway MySQL (via URL)...");

      pool = mysql.createPool({
        uri: process.env.MYSQL_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    } else {
      // ✅ Local Development
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

    // ⚠️ Test connection only in local mode
    if (process.env.NODE_ENV !== "production") {
      (async () => {
        try {
          const connection = await pool!.getConnection();
          console.log("✅ MySQL Database connected successfully (Local)");
          connection.release();
        } catch (error) {
          console.error("❌ Local MySQL connection failed:", error);
        }
      })();
    }
  }

  return pool;
}

export default getPool;