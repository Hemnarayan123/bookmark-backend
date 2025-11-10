import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

let pool: Pool;

// For Vercel deployment, ALWAYS use the public URL
const isVercel = process.env.VERCEL === '1';
const databaseUrl = isVercel 
  ? process.env.MYSQL_PUBLIC_URL 
  : process.env.MYSQL_URL;

if (databaseUrl) {
  console.log(`🌐 Using Railway MySQL (${isVercel ? 'Public' : 'Internal'} URL)...`);
  pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: isVercel ? 1 : 10, // Lower limit for serverless
    maxIdle: isVercel ? 1 : 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
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

// Don't test connection in production/serverless
if (process.env.NODE_ENV !== "production" && !isVercel) {
  (async () => {
    try {
      const connection = await pool.getConnection();
      console.log("✅ MySQL connected successfully");
      connection.release();
    } catch (error) {
      console.error("❌ MySQL connection failed:", error);
    }
  })();
}

export default pool;