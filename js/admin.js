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
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
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
};

// ----------------- Assign Max Win -----------------
window.assignMaxWin = async (uid) => {
  const maxWin = prompt("Enter max win amount (leave empty to remove):");
  if (maxWin === null) return;
  await update(ref(db, `users/${uid}`), { maxWin: maxWin === "" ? null : Number(maxWin) });
  showToast(`✅ MaxWin set to ${maxWin || "N/A"} for ${uid}`, "success");
};

// ----------------- Lock/Unlock -----------------
window.toggleLock = async (uid, unlocked) => {
  if (!confirm(`Are you sure you want to ${unlocked ? "lock" : "unlock"} this user?`)) return;
  await update(ref(db, `users/${uid}`), { unlocked: !unlocked });
  showToast(`🔄 User ${uid} is now ${!unlocked ? "unlocked" : "locked"}`, "info");
};

// ----------------- Delete User -----------------
window.deleteUser = async (uid) => {
  if (!confirm(`⚠️ Are you sure you want to delete user ${uid}?`)) return;
  await remove(ref(db, `users/${uid}`));
  showToast(`🗑 User ${uid} deleted`, "error");
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
          <button onclick="approveWithdraw('${uid}', '${wid}', ${w.amount})">✅ Approve</button>
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
};

window.rejectWithdraw = async (uid, wid, amount) => {
  const balSnap = await get(ref(db, `users/${uid}/balance`));
  const currentBal = balSnap.val() || 0;
  await update(ref(db, `users/${uid}`), { balance: currentBal + amount });
  await update(ref(db, `withdrawals/${uid}/${wid}`), { status: "Rejected" });
  showToast("❌ Withdrawal rejected & refunded", "error");
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
};
