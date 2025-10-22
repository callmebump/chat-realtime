// ==========================
// 📦 Import và setup cơ bản
// ==========================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");

const app = express();

// ==========================
// ⚙️ Cấu hình CORS (cho phép ASP.NET gọi API upload)
// ==========================
app.use(cors({
    origin: "http://localhost:5104", // trang web ASP.NET của bạn
    methods: ["GET", "POST"],
}));

// ==========================
// 📂 Upload file setup (MULTER)
// ==========================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + ext);
    }
});
const upload = multer({ storage });

// 📤 Route upload
app.post("/upload", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            console.log("❌ Không có file trong request!");
            return res.status(400).json({ error: "No file uploaded" });
        }
        const fileUrl = `http://localhost:3003/uploads/${req.file.filename}`;
        console.log("✅ File uploaded:", fileUrl);
        res.json({ url: fileUrl });
    } catch (err) {
        console.error("❌ Lỗi upload:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// Cho phép truy cập file tĩnh (ảnh/video/file)
app.use("/uploads", express.static(uploadDir));

// ==========================
// 💾 Cấu hình SQL Server
// ==========================
const dbConfig = {
    user: "sa",
    password: "123456",
    server: "localhost\\MSSQLSERVER01",
    database: "Gym2",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// ==========================
// ⚡ Khởi tạo HTTP + Socket.IO
// ==========================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5104",
        methods: ["GET", "POST"]
    }
});

// ==========================
// 📋 Bộ nhớ tạm lưu user trong phòng
// ==========================
const rooms = {}; // { roomName: [user1, user2, ...] }

// ✅ Hàm lưu tin nhắn vào SQL Server
async function saveMessageToDatabase({ username, room, message, sentAt }) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input("Username", sql.NVarChar, username)
            .input("Room", sql.NVarChar, room)
            .input("Message", sql.NVarChar, message)
            .input("SentAt", sql.DateTime, sentAt)
            .query(`
                INSERT INTO ChatMessages (Username, Room, Message, SentAt)
                VALUES (@Username, @Room, @Message, @SentAt)
            `);
        console.log(`💾 [DB] ${username} -> ${room}: ${message.substring(0, 60)}...`);
    } catch (err) {
        console.error("❌ Lỗi lưu tin nhắn:", err);
    }
}

// ==========================
// ==========================
// 🔌 Xử lý Socket.IO (Realtime Chat)
// ==========================
io.on("connection", (socket) => { // Đây là nơi bạn đăng ký các sự kiện với mỗi socket client
    console.log("🟢 Client connected:", socket.id);

    // Khi người dùng tham gia phòng
    socket.on("join_room", async ({ username, room }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;

        if (!rooms[room]) rooms[room] = [];
        if (!rooms[room].includes(username)) rooms[room].push(username);

        console.log(`👤 ${username} joined room: ${room}`);

        // Gửi danh sách người trong phòng
        io.to(room).emit("update_user_list", rooms[room]);

        // 🔔 Gửi thông báo hệ thống dạng object
        io.to(room).emit("system_message", {
            type: "join",
            username,
            room,
            text: `${username} đã tham gia phòng.`,
            time: new Date().toISOString()
        });

        // Gửi lịch sử chat (30 tin gần nhất)
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input("Room", sql.NVarChar, room)
                .query(`
                    SELECT TOP 30 Username, Message, SentAt
                    FROM ChatMessages
                    WHERE Room = @Room
                    ORDER BY SentAt DESC
                `);
            const history = result.recordset.reverse();
            socket.emit("chat_history", history);
        } catch (err) {
            console.error("❌ Lỗi tải lịch sử:", err);
        }
    });

    // Khi nhận tin nhắn mới
    socket.on("send_message", async (data) => {
        try {
            const sentAt = new Date();
            io.to(data.room).emit("receive_message", {
                username: data.username,
                message: data.message,
                room: data.room,
                sentAt: sentAt.toISOString()
            });

            await saveMessageToDatabase({
                username: data.username,
                room: data.room,
                message: data.message,
                sentAt
            });
        } catch (err) {
            console.error("❌ Lỗi xử lý send_message:", err);
        }
    });

    // Khi người dùng rời hoặc mất kết nối
    socket.on("disconnect", () => {
        const { username, room } = socket;
        if (username && room && rooms[room]) {
            rooms[room] = rooms[room].filter(u => u !== username);

            // Gửi thông báo hệ thống
            io.to(room).emit("system_message", {
                type: "leave",
                username,
                room,
                text: `${username} đã rời khỏi phòng.`,
                time: new Date().toISOString()
            });

            io.to(room).emit("update_user_list", rooms[room]);
            console.log(`🔴 ${username} đã rời phòng ${room}`);
        }
    });

    // Thông báo lỗi khi có sự kiện hệ thống
    socket.on("system_message", (data) => {
        const chatBox = document.getElementById("chat-box");
        const notice = document.createElement("div");
        notice.classList.add("system-message");
        notice.innerText = `🔔 ${data.text}`;
        chatBox.appendChild(notice);
    });
});

// ==========================
// 🚀 Khởi động server
// ==========================
const PORT = 3003;
server.listen(PORT, () => {
    console.log(`✅ Chat server đang chạy tại: http://localhost:${PORT}`);
});
