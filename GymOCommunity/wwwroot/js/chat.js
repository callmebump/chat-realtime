document.addEventListener("DOMContentLoaded", () => {
    const socket = io("http://localhost:3003");

    let username = "";
    let room = "";

    // Khi nhấn nút Tham gia
    const joinBtn = document.getElementById("joinBtn");
    const usernameInput = document.getElementById("usernameInput");
    const roomInput = document.getElementById("roomInput");

    joinBtn.addEventListener("click", () => {
        username = usernameInput.value.trim();
        room = roomInput.value.trim();

        if (!username || !room) {
            alert("Vui lòng nhập đầy đủ thông tin!");
            return;
        }
        // Ẩn form, hiện chat box
        document.getElementById("joinContainer").style.display = "none";
        document.getElementById("chatContainer").style.display = "flex";

        // Ẩn form, hiện chat box
        const roomDisplayNames = {
            Gym: "Phòng Gym 🏋️‍♂️",
            DinhDuong: "Dinh dưỡng 🥗",
            BaiTap: "Bài tập 📘",
            GiaoLuu: "Giao lưu 💬",
            Khac: "Phòng khác 🌐"
        };
        document.getElementById("roomName").innerText = roomDisplayNames[room] || `Phòng: ${room}`;

        socket.emit("join_room", { username, room });
    });

    // Gửi tin nhắn
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("message");

    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    function sendMessage() {
        const msg = messageInput.value.trim();
        if (!msg) return;

        socket.emit("send_message", { username, room, message: msg });
        messageInput.value = "";
    }

    // Nhận tin nhắn
    socket.on("receive_message", (data) => {
        const chatBox = document.getElementById("messages");
        const div = document.createElement("div");
        div.classList.add("chat-message");
        div.classList.add(data.username === username ? "my-message" : "other-message");

        const time = new Date(data.sentAt || new Date()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        div.innerHTML = `
            <div class="bubble">
                <b>${data.username === username ? "Bạn" : data.username}</b><br>
                ${data.message}
                <div class="time">${time}</div>
            </div>
        `;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Cập nhật danh sách người trong phòng
    socket.on("update_user_list", (users) => {
        const list = document.getElementById("userList");
        list.innerHTML = users.map(u => `<div class="user">${u}</div>`).join("");
    });

    // Thông báo người tham gia
    socket.on("user_joined", (msg) => {
        const chatBox = document.getElementById("messages");
        const div = document.createElement("div");
        div.style.color = "cyan";
        div.innerText = msg;
        chatBox.appendChild(div);
    });

    // 🟢 Khi có người rời khỏi phòng
    socket.on("user_left", (msg) => {
        const chatBox = document.getElementById("messages");
        const div = document.createElement("div");
        div.style.color = "orange";
        div.style.textAlign = "center";
        div.style.margin = "5px 0";
        div.innerText = msg;
        chatBox.appendChild(div);
    });
});


