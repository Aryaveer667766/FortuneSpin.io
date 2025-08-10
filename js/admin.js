import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  child,
  onValue,
  push,
  remove
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// --------------- USER LIST & SEARCH -----------------
let allUsers = [];

// Load all users and render in list container
async function loadAllUsers() {
  const usersRef = ref(db, "users");
  const snap = await get(usersRef);

  allUsers = [];
  snap.forEach(childSnap => {
    allUsers.push({ key: childSnap.key, ...childSnap.val() });
  });

  renderUserList(allUsers);
}

// Render user list in container
function renderUserList(users) {
  const list = document.getElementById("user-list");
  if (!list) return;

  if (!users.length) {
    list.innerHTML = `<div class="alert">No users found.</div>`;
    return;
  }

  list.innerHTML = '';
  users.forEach(user => {
    const lockedClass = user.unlocked ? '' : 'locked';
    const lockTitle = user.unlocked ? 'Lock User' : 'Unlock User';

    const userRow = document.createElement('div');
    userRow.classList.add('user-row');

    userRow.innerHTML = `
      <div class="user-info">
        <strong>${user.name || '(No Name)'}</strong> | UID: <code>${user.uidCode || '-'}</code><br />
        📧 ${user.email || '-'} | 📞 ${user.phone || '-'} | Balance: ₹${user.balance || 0}<br/>
        Spins Left: ${user.spinsLeft ?? 0} | Max Win: ₹${user.maxWinAmount ?? 'Not set'} | Unlocked: ${user.unlocked ? 'Yes' : 'No'}
      </div>
      <div class="user-actions">
        <button title="${lockTitle}" class="${lockedClass}" onclick="toggleLock('${user.key}', ${user.unlocked})">
          ${user.unlocked ? '🔓' : '🔒'}
        </button>
        <button title="Delete User" onclick="deleteUser('${user.key}')">❌</button>
      </div>
    `;

    list.appendChild(userRow);
  });
}

// Filter users live in user list by name, email, phone, uidCode
window.filterUserList = (query) => {
  query = query.trim().toLowerCase();
  if (!query) {
    renderUserList(allUsers);
    return;
  }
  const filtered = allUsers.filter(user => {
    return (
      (user.name && user.name.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.toLowerCase().includes(query)) ||
      (user.uidCode && user.uidCode.toLowerCase().includes(query))
    );
  });
  renderUserList(filtered);
};

// Toggle lock/unlock user
window.toggleLock = async (key, currentlyUnlocked) => {
  try {
    await update(ref(db, `users/${key}`), { unlocked: !currentlyUnlocked });
    alert(`User ${currentlyUnlocked ? 'locked' : 'unlocked'} successfully.`);
    await loadAllUsers();
  } catch (err) {
    alert("Error updating user lock status.");
    console.error(err);
  }
};

// Delete user
window.deleteUser = async (key) => {
  if (!confirm("Are you sure you want to delete this user?")) return;
  try {
    await remove(ref(db, `users/${key}`));
    alert("User deleted successfully.");
    await loadAllUsers();
  } catch (err) {
    alert("Error deleting user.");
    console.error(err);
  }
};

// ------------------ SEARCH USER (single user details) ----------------
window.searchUser = async () => {
  const q = document.getElementById("search-user").value.trim().toLowerCase();
  const usersRef = ref(db, "users");

  const snap = await get(usersRef);
  let found = false;
  const div = document.getElementById("user-result");
  div.innerHTML = "";

  snap.forEach(childSnap => {
    const user = childSnap.val();

    // Use name instead of username here
    const uidCode = (user.uidCode || "").toLowerCase();
    const username = (user.name || "").toLowerCase();  // Fixed here
    const email = (user.email || "").toLowerCase();
    const phone = (user.phone || "").toLowerCase();

    if (
      uidCode === q ||
      username === q ||
      email === q ||
      phone === q
    ) {
      found = true;
      div.innerHTML = `
        <p>🔹 UID: ${user.uidCode}</p>
        <p>👤 Name: ${user.name || "N/A"}</p>
        <p>📱 Phone: ${user.phone || "N/A"}</p>
        <p>📧 Email: ${user.email || "N/A"}</p>
        <p>💰 Balance: ₹${user.balance || 0}</p>
        <p>🎡 Unlocked: ${user.unlocked}</p>
        <p>🎯 Spins Left: ${user.spinsLeft ?? 0}</p>
        <p>🏷️ Max Win: ₹${user.maxWinAmount ?? "Not set"}</p>
        <div style="margin-top:8px;">
          <button onclick="unlockUser('${childSnap.key}')">Unlock</button>
          <button onclick="lockUser('${childSnap.key}')">Lock</button>
          <button onclick="deleteUser('${childSnap.key}')">❌ Delete</button>
          <button onclick="resetPassword('${childSnap.key}')">🔄 Reset Password</button>
        </div>
      `;
    }
  });

  if (!found) div.innerHTML = `<div class="alert">User not found.</div>`;
};

// Unlock/Lock/Reset Password for searched user (reuse previous definitions)
window.unlockUser = async (uid) => {
  try {
    await update(ref(db, `users/${uid}`), { unlocked: true });
    alert("✅ User Unlocked");
    await loadAllUsers();
  } catch (err) {
    alert("Error unlocking user");
  }
};

window.lockUser = async (uid) => {
  try {
    await update(ref(db, `users/${uid}`), { unlocked: false });
    alert("🔒 User Locked");
    await loadAllUsers();
  } catch (err) {
    alert("Error locking user");
  }
};

window.resetPassword = async (uid) => {
  alert("Manual reset required via Firebase console or Admin SDK.");
};

// ----------------- MAX WIN -------------------
window.setMaxWin = async () => {
  const uidInput = document.getElementById("max-win-uid").value.trim();
  const maxWinAmt = parseInt(document.getElementById("max-win-amount").value, 10);

  if (!uidInput) {
    alert("Please enter a UID.");
    return;
  }
  if (isNaN(maxWinAmt) || maxWinAmt < 0) {
    alert("Enter a valid max win amount.");
    return;
  }

  // Find user by uidCode
  const usersRef = ref(db, "users");
  const snap = await get(usersRef);

  let userKey = null;
  snap.forEach(childSnap => {
    if ((childSnap.val().uidCode || "").toLowerCase() === uidInput.toLowerCase()) {
      userKey = childSnap.key;
    }
  });

  if (!userKey) {
    alert("User UID not found.");
    return;
  }

  try {
    await update(ref(db, `users/${userKey}`), {
      maxWinAmount: maxWinAmt
    });

    document.getElementById("max-win-msg").innerText = `✅ Max win ₹${maxWinAmt} set for UID ${uidInput}`;
    document.getElementById("max-win-uid").value = "";
    document.getElementById("max-win-amount").value = "";
  } catch (err) {
    alert("Error setting max win");
  }
};

// -------------- ASSIGN SPINS -------------------
window.assignSpin = async () => {
  const uidCodeInput = document.getElementById("spin-uid").value.trim();
  const spins = parseInt(document.getElementById("spin-count").value, 10);
  const winAmt = parseInt(document.getElementById("win-amount").value, 10);

  if (!uidCodeInput) return alert("Please enter UID code.");
  if (isNaN(spins) || spins < 0) return alert("Invalid spin count");

  const usersRef = ref(db, "users");
  const snap = await get(usersRef);
  let foundKey = null;

  snap.forEach(childSnap => {
    if ((childSnap.val().uidCode || "").toLowerCase() === uidCodeInput.toLowerCase()) {
      foundKey = childSnap.key;
    }
  });

  if (!foundKey) return alert("UID not found.");

  const updates = {
    spinsLeft: spins
  };
  if (!isNaN(winAmt)) updates.assignedWin = winAmt;

  try {
    await update(ref(db, `users/${foundKey}`), updates);
    document.getElementById("spin-uid").value = "";
    document.getElementById("spin-count").value = "";
    document.getElementById("win-amount").value = "";
    alert("🎯 Spin assigned successfully!");
  } catch (err) {
    alert("Error assigning spins");
  }
};

// ------------------ WITHDRAWALS -------------------
window.loadWithdrawals = async () => {
  const list = document.getElementById("withdraw-list");
  list.innerHTML = "Loading...";

  const withdrawalsSnap = await get(ref(db, `withdrawals`));
  const usersSnap = await get(ref(db, `users`));

  list.innerHTML = "";

  if (!withdrawalsSnap.exists()) {
    list.innerHTML = "<div class='panel'>No withdrawals found.</div>";
    return;
  }

  withdrawalsSnap.forEach(user => {
    const uid = user.key;
    const userData = usersSnap.child(uid).val();

    const userName = userData?.username || userData?.name || "Unknown";
    const userMobile = userData?.phone || "Not Provided";
    const uidCode = userData?.uidCode || "N/A";

    Object.entries(user.val()).forEach(([id, w]) => {
      if (w.status && w.status.toLowerCase() !== "pending") return; // only pending

      const div = document.createElement("div");
      div.classList.add("panel");

      div.innerHTML = `
        <p>🔹 UID: ${uidCode}</p>
        <p>👤 Name: ${userName}</p>
        <p>📱 Phone: ${userMobile}</p>
        <p>💰 Amount: ₹${w.amount}</p>
        <p>UPI🏦: ${w.upi || 'N/A'}</p>
        <p>Status: ${w.status || "Pending"}</p>
        <button onclick="approveWithdraw('${uid}', '${id}', ${w.amount})">✅ Approve</button>
        <button onclick="rejectWithdraw('${uid}', '${id}', ${w.amount})">❌ Reject</button>
      `;

      list.appendChild(div);
    });
  });
};

// Approve withdrawal
window.approveWithdraw = async (uid, id, amount) => {
  try {
    await update(ref(db, `withdrawals/${uid}/${id}`), {
      status: "Approved"
    });

    alert("✅ Withdrawal approved");
    loadWithdrawals();
  } catch (error) {
    alert("Error approving withdrawal");
  }
};

// Reject withdrawal + refund
window.rejectWithdraw = async (uid, id, amount) => {
  try {
    const balSnap = await get(ref(db, `users/${uid}/balance`));
    const currentBal = balSnap.val() || 0;

    await update(ref(db, `users/${uid}`), {
      balance: currentBal + amount
    });

    await update(ref(db, `withdrawals/${uid}/${id}`), {
      status: "Rejected"
    });

    alert("❌ Withdrawal rejected & amount refunded");
    loadWithdrawals();
  } catch (error) {
    alert("Error rejecting withdrawal");
  }
};

// ------------------ TICKETS -------------------
window.loadTickets = async () => {
  const list = document.getElementById("ticket-list");
  list.innerHTML = "Loading...";

  const snap = await get(ref(db, `tickets`));
  list.innerHTML = "";

  if (!snap.exists()) {
    list.innerHTML = "<div class='panel'>No tickets found.</div>";
    return;
  }

  snap.forEach(user => {
    const uid = user.key;
    Object.entries(user.val()).forEach(([id, t]) => {
      const div = document.createElement("div");
      div.classList.add("panel");

      div.innerHTML = `
        <p>📨 UID: ${uid}</p>
        <p>📄 ${t.subject}</p>
        <p>${t.message}</p>
        <p>Status: ${t.status || 'Open'}</p>
        <button onclick="replyTicket('${uid}', '${id}')">💬 Reply</button>
        <button onclick="resolveTicket('${uid}', '${id}')">✅ Mark Resolved</button>
      `;

      list.appendChild(div);
    });
  });
};

// Reply ticket
window.replyTicket = async (uid, id) => {
  const msg = prompt("Enter your reply:");
  if (!msg) return;

  try {
    const notifRef = ref(db, `users/${uid}/notifications`);
    await push(notifRef, msg);
    alert("Reply sent.");
  } catch (err) {
    alert("Error sending reply");
  }
};

// Resolve ticket
window.resolveTicket = async (uid, id) => {
  try {
    await update(ref(db, `tickets/${uid}/${id}`), { status: "Resolved" });
    alert("Marked resolved.");
    loadTickets();
  } catch (err) {
    alert("Error resolving ticket");
  }
};

// -------------- REFERRAL TREE -------------------
window.viewReferralTree = async () => {
  const uidText = document.getElementById("ref-uid").value.trim();
  if (!uidText) return alert("Enter a UID");

  const usersSnap = await get(ref(db, `users`));
  const treeDiv = document.getElementById("ref-tree");
  treeDiv.innerHTML = "Loading...";

  let rootUID = null;

  usersSnap.forEach(child => {
    if (child.val().uidCode === uidText) {
      rootUID = child.key;
    }
  });

  if (!rootUID) {
    treeDiv.innerHTML = `<div class="alert">User not found.</div>`;
    return;
  }

  const refs = [];
  usersSnap.forEach(child => {
    const u = child.val();
    if (u.referralBy === uidText) {
      refs.push(u.uidCode);
    }
  });

  if (refs.length === 0) {
    treeDiv.innerHTML = `<div>No referrals found.</div>`;
    return;
  }

  treeDiv.innerHTML = `<p>Referrals by ${uidText}:</p><ul>${refs.map(r => `<li>${r}</li>`).join('')}</ul>`;
};

// ------------------- INITIALIZE -------------------
window.addEventListener('DOMContentLoaded', () => {
  loadAllUsers();
  loadWithdrawals();
  loadTickets();
});
