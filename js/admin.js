// admin.js
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

let usersCache = {};
let currentAdmin = null;

// ----------------- Toast Notification -----------------
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.style.position = "fixed";
    container.style.top = "15px";
    container.style.left = "50%";
    container.style.transform = "translateX(-50%)";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  toast.style.background = type === "success" ? "#4CAF50" :
                           type === "error" ? "#f44336" :
                           type === "warning" ? "#ff9800" : "#2196F3";
  toast.style.color = "#fff";
  toast.style.padding = "10px 20px";
  toast.style.marginTop = "8px";
  toast.style.borderRadius = "5px";
  toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";
  
  container.appendChild(toast);

  setTimeout(() => toast.style.opacity = "1", 50);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ----------------- Auth Check -----------------
onAuthStateChanged(auth, (user) => {
  if (!user) return window.location.href = "index.html";
  currentAdmin = user;
  loadUsers();
  loadWithdrawals();
  loadTickets();
});

// ----------------- Load Users -----------------
function loadUsers() {
  const userRef = ref(db, "users");
  onValue(userRef, (snapshot) => {
    usersCache = snapshot.val() || {};
    renderUserList(usersCache);
  });
}

function renderUserList(users) {
  const list = document.getElementById("user-list");
  list.innerHTML = "";
  Object.entries(users).forEach(([id, data]) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div class="user-info">
        <strong>${data.uidCode || "N/A"}</strong> | ${data.email || ""} | Bal: ₹${data.balance || 0} | Spins: ${data.spinsLeft || 0} | MaxWin: ${data.maxWin || "N/A"}
      </div>
      <div class="user-actions">
        <button onclick="assignSpins('${id}')">🎯 Spins</button>
        <button onclick="assignMaxWin('${id}')">💰 MaxWin</button>
        <button onclick="toggleLock('${id}', ${data.unlocked})">${data.unlocked ? "🔒 Lock" : "🔓 Unlock"}</button>
        <button onclick="deleteUser('${id}')">🗑</button>
      </div>
    `;
    list.appendChild(row);
  });
}

// ----------------- Search -----------------
window.filterUsers = (query) => {
  query = query.toLowerCase();
  const filtered = {};
  Object.entries(usersCache).forEach(([id, user]) => {
    if (
      (user.uidCode && user.uidCode.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.toLowerCase().includes(query))
    ) {
      filtered[id] = user;
    }
  });
  renderUserList(filtered);
};

// ----------------- Assign Spins -----------------
window.assignSpins = async (uid) => {
  const spins = prompt("Enter number of spins to assign:");
  if (spins === null || spins.trim() === "") return;
  await update(ref(db, `users/${uid}`), { spinsLeft: Number(spins) });
  showToast(`✅ Assigned ${spins} spins to ${uid}`, "success");
  loadUsers();
};

// ----------------- Assign Max Win -----------------
window.assignMaxWin = async (uid) => {
  const maxWin = prompt("Enter max win amount (leave empty to remove):");
  if (maxWin === null) return;
  await update(ref(db, `users/${uid}`), { maxWin: maxWin === "" ? null : Number(maxWin) });
  showToast(`✅ MaxWin set to ${maxWin || "N/A"} for ${uid}`, "success");
  loadUsers();
};

// ----------------- Lock/Unlock -----------------
window.toggleLock = async (uid, unlocked) => {
  if (!confirm(`Are you sure you want to ${unlocked ? "lock" : "unlock"} this user?`)) return;
  await update(ref(db, `users/${uid}`), { unlocked: !unlocked });
  showToast(`🔄 User ${uid} is now ${!unlocked ? "unlocked" : "locked"}`, "info");
  loadUsers();
};

// ----------------- Delete User -----------------
window.deleteUser = async (uid) => {
  if (!confirm(`⚠️ Are you sure you want to delete user ${uid}?`)) return;
  await remove(ref(db, `users/${uid}`));
  showToast(`🗑 User ${uid} deleted`, "error");
  loadUsers();
};

// ----------------- Withdrawals -----------------
window.loadWithdrawals = () => {
  const wRef = ref(db, "withdrawals");
  const uRef = ref(db, "users");

  onValue(wRef, async (wSnap) => {
    const withdrawals = wSnap.val() || {};
    const usersSnap = await get(uRef);
    const users = usersSnap.val() || {};

    const list = document.getElementById("withdraw-list");
    list.innerHTML = "";

    Object.entries(withdrawals).forEach(([uid, wList]) => {
      const userData = users[uid] || {};
      Object.entries(wList).forEach(([wid, w]) => {
        if (w.status && w.status.toLowerCase() !== "pending") return;

        const div = document.createElement("div");
        div.className = "panel";
        div.innerHTML = `
          <p>🔹 UID: ${userData.uidCode || "N/A"}</p>
          <p>👤 Name: ${userData.username || "Unknown"}</p>
          <p>📱 Phone: ${userData.phone || "Not Provided"}</p>
          <p>💰 Amount: ₹${w.amount}</p>
          <p>🏦 UPI: ${w.upi}</p>
          <p>Status: ${w.status || "Pending"}</p>
          <button onclick="approveWithdraw('${uid}', '${wid}')">✅ Approve</button>
          <button onclick="rejectWithdraw('${uid}', '${wid}', ${w.amount})">❌ Reject</button>
        `;
        list.appendChild(div);
      });
    });
  });
};

window.approveWithdraw = async (uid, wid) => {
  await update(ref(db, `withdrawals/${uid}/${wid}`), { status: "Approved" });
  showToast("✅ Withdrawal approved", "success");
  loadWithdrawals();
};

window.rejectWithdraw = async (uid, wid, amount) => {
  const balSnap = await get(ref(db, `users/${uid}/balance`));
  const currentBal = balSnap.val() || 0;
  await update(ref(db, `users/${uid}`), { balance: currentBal + amount });
  await update(ref(db, `withdrawals/${uid}/${wid}`), { status: "Rejected" });
  showToast("❌ Withdrawal rejected & refunded", "error");
  loadWithdrawals();
};

// ----------------- Tickets -----------------
window.loadTickets = () => {
  const tRef = ref(db, "tickets");
  onValue(tRef, (snap) => {
    const tickets = snap.val() || {};
    const list = document.getElementById("ticket-list");
    list.innerHTML = "";

    Object.entries(tickets).forEach(([uid, tList]) => {
      Object.entries(tList).forEach(([tid, t]) => {
        if (t.status && t.status.toLowerCase() === "resolved") return;

        const div = document.createElement("div");
        div.className = "panel";
        div.innerHTML = `
          <p>📨 UID: ${uid}</p>
          <p>📄 ${t.subject}</p>
          <p>${t.message}</p>
          <button onclick="replyTicket('${uid}', '${tid}')">💬 Reply</button>
          <button onclick="resolveTicket('${uid}', '${tid}')">✅ Resolve</button>
        `;
        list.appendChild(div);
      });
    });
  });
};

window.replyTicket = async (uid, tid) => {
  const msg = prompt("Enter your reply:");
  if (!msg) return;
  const notifRef = ref(db, `users/${uid}/notifications`);
  await push(notifRef, msg);
  showToast("💬 Reply sent", "info");
};

window.resolveTicket = async (uid, tid) => {
  await update(ref(db, `tickets/${uid}/${tid}`), { status: "Resolved" });
  showToast("✅ Ticket resolved", "success");
  loadTickets();
};

// ----------------- Quick User Actions -----------------
window.assignSpinsDirect = async () => {
  const uid = document.getElementById("uid-input").value.trim();
  const spins = parseInt(document.getElementById("spins-input").value);
  if (!uid || isNaN(spins)) return showToast("❌ Enter UID and Spins", "error");

  await update(ref(db, `users/${uid}`), { spinsLeft: spins });
  showToast(`✅ Assigned ${spins} spins to ${uid}`, "success");
  loadUsers();
};

window.setMaxWinDirect = async () => {
  const uid = document.getElementById("uid-input").value.trim();
  const maxWin = parseInt(document.getElementById("maxwin-input").value);
  if (!uid || isNaN(maxWin)) return showToast("❌ Enter UID and MaxWin", "error");

  await update(ref(db, `users/${uid}`), { maxWin });
  showToast(`✅ MaxWin set to ${maxWin} for ${uid}`, "success");
  loadUsers();
};

window.adjustBalanceDirect = async () => {
  const uid = document.getElementById("uid-input").value.trim();
  const balance = parseFloat(document.getElementById("balance-input").value);
  if (!uid || isNaN(balance)) return showToast("❌ Enter UID and Balance", "error");

  await update(ref(db, `users/${uid}`), { balance });
  showToast(`✅ Balance updated to ₹${balance} for ${uid}`, "success");
  loadUsers();
};

window.lockUserDirect = async () => {
  const uid = document.getElementById("uid-input").value.trim();
  if (!uid) return showToast("❌ Enter UID", "error");

  await update(ref(db, `users/${uid}`), { unlocked: false });
  showToast(`🔒 User ${uid} locked`, "warning");
  loadUsers();
};

window.unlockUserDirect = async () => {
  const uid = document.getElementById("uid-input").value.trim();
  if (!uid) return showToast("❌ Enter UID", "error");

  await update(ref(db, `users/${uid}`), { unlocked: true });
  showToast(`🔓 User ${uid} unlocked`, "success");
  loadUsers();
};
