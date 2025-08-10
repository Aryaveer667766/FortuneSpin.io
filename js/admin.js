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

// ----------------- Toast Notification (top-center) -----------------
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    // top-center styling (mobile friendly)
    container.style.position = "fixed";
    container.style.top = "12px";
    container.style.left = "50%";
    container.style.transform = "translateX(-50%)";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.gap = "8px";
    container.style.zIndex = "99999";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  // Basic look
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "8px";
  toast.style.color = "#fff";
  toast.style.fontSize = "14px";
  toast.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  toast.style.transform = "translateY(-6px)";

  // color by type
  const bg = type === "success" ? "#2ECC71" :
             type === "error" ? "#E74C3C" :
             type === "warning" ? "#F39C12" : "#3498DB";
  toast.style.background = bg;

  container.appendChild(toast);

  // show
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // remove after 3s
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 250);
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

// ----------------- Helper: find DB key from UID input -----------------
async function findUserKeyByUidInput(uidInput) {
  if (!uidInput) return null;
  uidInput = uidInput.trim();

  // If usersCache already has this as a DB key, return it directly
  if (usersCache[uidInput]) return uidInput;

  const normalizedInput = uidInput.toLowerCase().replace(/^uid#/, '');

  // Search local cache first (fast)
  for (const [key, user] of Object.entries(usersCache)) {
    const ucode = (user.uidCode || "").toLowerCase();
    if (ucode === uidInput.toLowerCase()) return key;
    if (ucode.replace(/^uid#/, '') === normalizedInput) return key;
  }

  // Fallback: fetch from DB and search (covers cache misses)
  const usersSnap = await get(ref(db, "users"));
  if (!usersSnap.exists()) return null;

  let foundKey = null;
  usersSnap.forEach(childSnap => {
    const u = childSnap.val();
    const ucode = (u.uidCode || "").toLowerCase();
    if (ucode === uidInput.toLowerCase() || ucode.replace(/^uid#/, '') === normalizedInput) {
      foundKey = childSnap.key;
    }
  });

  return foundKey;
}

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
  if (!list) return;
  list.innerHTML = "";
  Object.entries(users).forEach(([id, data]) => {
    const row = document.createElement("div");
    row.className = "user-row";
    // show either maxWin or maxWinAmount (compatibility)
    const maxWinDisplay = data.maxWin ?? data.maxWinAmount ?? "Not set";

    row.innerHTML = `
      <div class="user-info">
        <strong>${data.uidCode || "N/A"}</strong> | ${data.email || ""} | Bal: ₹${data.balance ?? 0} | Spins: ${data.spinsLeft ?? 0} | MaxWin: ₹${maxWinDisplay}
      </div>
      <div class="user-actions">
        <button onclick="assignSpins('${id}')">🎯 Spins</button>
        <button onclick="assignMaxWin('${id}')">💰 MaxWin</button>
        <button onclick="toggleLock('${id}', ${!!data.unlocked})">${data.unlocked ? "🔒 Lock" : "🔓 Unlock"}</button>
        <button onclick="deleteUser('${id}')">🗑</button>
      </div>
    `;
    list.appendChild(row);
  });
}

// ----------------- Search -----------------
window.filterUsers = (query) => {
  if (!query) return renderUserList(usersCache);
  query = query.toLowerCase();
  const filtered = {};
  Object.entries(usersCache).forEach(([id, user]) => {
    if (
      (user.uidCode && user.uidCode.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.toLowerCase().includes(query)) ||
      (user.name && user.name.toLowerCase().includes(query))
    ) {
      filtered[id] = user;
    }
  });
  renderUserList(filtered);
};

// ----------------- Assign Spins (from list button using DB key) -----------------
window.assignSpins = async (dbKey) => {
  const val = prompt("Enter number of spins to assign:");
  if (val === null || val.trim() === "") return;
  const spins = Number(val);
  if (Number.isNaN(spins)) return showToast("Invalid number", "error");

  await update(ref(db, `users/${dbKey}`), { spinsLeft: spins });
  // update cache/UI immediately
  usersCache[dbKey] = usersCache[dbKey] || {};
  usersCache[dbKey].spinsLeft = spins;
  renderUserList(usersCache);
  showToast(`✅ Assigned ${spins} spins`, "success");
};

// ----------------- Assign Max Win (from list button using DB key) -----------------
window.assignMaxWin = async (dbKey) => {
  const val = prompt("Enter max win amount (leave empty to remove):");
  if (val === null) return;
  const maxWin = val === "" ? null : Number(val);
  if (val !== "" && Number.isNaN(maxWin)) return showToast("Invalid number", "error");

  // write both names for compatibility
  const updateObj = { maxWin: maxWin };
  if (maxWin !== null) updateObj.maxWinAmount = maxWin; else { updateObj.maxWinAmount = null; }

  await update(ref(db, `users/${dbKey}`), updateObj);
  usersCache[dbKey] = usersCache[dbKey] || {};
  usersCache[dbKey].maxWin = maxWin;
  usersCache[dbKey].maxWinAmount = maxWin;
  renderUserList(usersCache);
  showToast(`✅ MaxWin updated`, "success");
};

// ----------------- Lock/Unlock -----------------
window.toggleLock = async (dbKey, unlocked) => {
  if (!confirm(`Are you sure you want to ${unlocked ? "lock" : "unlock"} this user?`)) return;
  const newStatus = !unlocked;
  await update(ref(db, `users/${dbKey}`), { unlocked: newStatus });
  usersCache[dbKey] = usersCache[dbKey] || {};
  usersCache[dbKey].unlocked = newStatus;
  renderUserList(usersCache);
  showToast(`🔄 User ${newStatus ? "unlocked" : "locked"}`, "info");
};

// ----------------- Delete User -----------------
window.deleteUser = async (dbKey) => {
  if (!confirm("Are you sure you want to delete this user?")) return;
  await remove(ref(db, `users/${dbKey}`));
  delete usersCache[dbKey];
  renderUserList(usersCache);
  showToast("🗑 User deleted", "error");
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
    if (!list) return;
    list.innerHTML = "";

    Object.entries(withdrawals).forEach(([uid, wList]) => {
      const userData = users[uid] || {};
      Object.entries(wList).forEach(([wid, w]) => {
        if (w.status && w.status.toLowerCase() !== "pending") return;

        const div = document.createElement("div");
        div.className = "withdraw-row panel";
        div.innerHTML = `
          <div class="withdraw-header"><strong>${userData.uidCode || uid}</strong><span>₹${w.amount}</span></div>
          <div>👤 ${userData.username || userData.name || "Unknown"}</div>
          <div>📱 ${userData.phone || "Not Provided"}</div>
          <div>UPI: ${w.upi || "N/A"}</div>
          <div class="withdraw-actions">
            <button onclick="approveWithdraw('${uid}', '${wid}')">✅ Approve</button>
            <button onclick="rejectWithdraw('${uid}', '${wid}', ${w.amount})">❌ Reject</button>
          </div>
        `;
        list.appendChild(div);
      });
    });
  });
};

window.approveWithdraw = async (uid, wid) => {
  await update(ref(db, `withdrawals/${uid}/${wid}`), { status: "Approved" });
  showToast("✅ Withdrawal approved", "success");
  // list will auto-refresh via onValue
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
    if (!list) return;
    list.innerHTML = "";

    Object.entries(tickets).forEach(([uid, tList]) => {
      Object.entries(tList).forEach(([tid, t]) => {
        if (t.status && t.status.toLowerCase() === "resolved") return;

        const div = document.createElement("div");
        div.className = "ticket-row panel";
        div.innerHTML = `
          <div class="ticket-header"><strong>${uid}</strong><span>${t.subject}</span></div>
          <div>${t.message}</div>
          <div class="ticket-actions">
            <button onclick="replyTicket('${uid}', '${tid}')">💬 Reply</button>
            <button onclick="resolveTicket('${uid}', '${tid}')">✅ Resolve</button>
          </div>
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

// ----------------- Quick User Actions (direct UID input) -----------------
window.assignSpinsDirect = async () => {
  const uidInput = document.getElementById("uid-input").value.trim();
  const spins = parseInt(document.getElementById("spins-input").value, 10);
  if (!uidInput || Number.isNaN(spins)) return showToast("❌ Enter UID and valid Spins", "error");

  const key = await findUserKeyByUidInput(uidInput);
  if (!key) return showToast("❌ User not found", "error");

  await update(ref(db, `users/${key}`), { spinsLeft: spins });
  usersCache[key] = usersCache[key] || {};
  usersCache[key].spinsLeft = spins;
  renderUserList(usersCache);
  showToast(`✅ Assigned ${spins} spins to ${uidInput}`, "success");
};

window.setMaxWinDirect = async () => {
  const uidInput = document.getElementById("uid-input").value.trim();
  const maxWin = parseInt(document.getElementById("maxwin-input").value, 10);
  if (!uidInput || Number.isNaN(maxWin)) return showToast("❌ Enter UID and valid MaxWin", "error");

  const key = await findUserKeyByUidInput(uidInput);
  if (!key) return showToast("❌ User not found", "error");

  // write both keys for compatibility
  await update(ref(db, `users/${key}`), { maxWin: maxWin, maxWinAmount: maxWin });
  usersCache[key] = usersCache[key] || {};
  usersCache[key].maxWin = maxWin;
  usersCache[key].maxWinAmount = maxWin;
  renderUserList(usersCache);
  showToast(`✅ MaxWin set to ₹${maxWin} for ${uidInput}`, "success");
};

window.adjustBalanceDirect = async () => {
  const uidInput = document.getElementById("uid-input").value.trim();
  const balance = parseFloat(document.getElementById("balance-input").value);
  if (!uidInput || Number.isNaN(balance)) return showToast("❌ Enter UID and valid Balance", "error");

  const key = await findUserKeyByUidInput(uidInput);
  if (!key) return showToast("❌ User not found", "error");

  await update(ref(db, `users/${key}`), { balance });
  usersCache[key] = usersCache[key] || {};
  usersCache[key].balance = balance;
  renderUserList(usersCache);
  showToast(`✅ Balance updated to ₹${balance} for ${uidInput}`, "success");
};

window.lockUserDirect = async () => {
  const uidInput = document.getElementById("uid-input").value.trim();
  if (!uidInput) return showToast("❌ Enter UID", "error");

  const key = await findUserKeyByUidInput(uidInput);
  if (!key) return showToast("❌ User not found", "error");

  await update(ref(db, `users/${key}`), { unlocked: false });
  usersCache[key] = usersCache[key] || {};
  usersCache[key].unlocked = false;
  renderUserList(usersCache);
  showToast(`🔒 User ${uidInput} locked`, "warning");
};

window.unlockUserDirect = async () => {
  const uidInput = document.getElementById("uid-input").value.trim();
  if (!uidInput) return showToast("❌ Enter UID", "error");

  const key = await findUserKeyByUidInput(uidInput);
  if (!key) return showToast("❌ User not found", "error");

  await update(ref(db, `users/${key}`), { unlocked: true });
  usersCache[key] = usersCache[key] || {};
  usersCache[key].unlocked = true;
  renderUserList(usersCache);
  showToast(`🔓 User ${uidInput} unlocked`, "success");
};
// 👥 REFERRAL TREE (Sorted + Totals + Faded Locked)
window.viewReferralTree = async () => {
  const uidNumber = document.getElementById("ref-uid").value.trim();
  if (!uidNumber) return alert("Enter a UID...");

  const fullUID = `UID#${uidNumber}`;
  const usersSnap = await get(ref(db, "users"));
  const treeDiv = document.getElementById("ref-tree");
  treeDiv.innerHTML = "Loading...";

  let rootFound = false;
  const referrals = [];

  // Find root and collect referrals
  usersSnap.forEach(child => {
    const u = child.val();
    if (u.uidCode === fullUID) {
      rootFound = true;
    }
    if (u.referralBy === fullUID) {
      referrals.push({
        name: u.username || u.uidCode.replace("UID#", ""),
        locked: !!u.locked
      });
    }
  });

  if (!rootFound) {
    treeDiv.innerHTML = `<div class="alert">User not found.</div>`;
    return;
  }

  if (referrals.length === 0) {
    treeDiv.innerHTML = `<div>No referrals found.</div>`;
    return;
  }

  // Sort: unlocked first, then locked
  referrals.sort((a, b) => a.locked - b.locked);

  // Count totals
  const unlockedCount = referrals.filter(r => !r.locked).length;
  const lockedCount = referrals.length - unlockedCount;

  // Build HTML list
  let html = `
    <p>Referrals by ${uidNumber}:</p>
    <p>
      <span class="unlocked">Unlocked: ${unlockedCount}</span> | 
      <span class="locked">Locked: ${lockedCount}</span> | 
      Total: ${referrals.length}
    </p>
    <ul>
  `;
  referrals.forEach(r => {
    html += `<li class="${r.locked ? "locked-item" : ""}">
               ${r.name} - <span class="${r.locked ? "locked" : "unlocked"}">
                 ${r.locked ? "Locked" : "Unlocked"}
               </span>
             </li>`;
  });
  html += `</ul>`;

  treeDiv.innerHTML = html;
};
