const sql = require("mssql");

const dbConfig = {
    user: "sa",
    password: "123456",
    server: "localhost\\MSSQLSERVER01", // đổi lại đúng instance
    database: "GymOCommunity",
    options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log("✅ Kết nối thành công!");
        const result = await pool.request().query("SELECT GETDATE() AS Now");
        console.log(result.recordset);
    } catch (err) {
        console.error("❌ Lỗi kết nối:", err);
    }
}

test();
