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



// 🔍 SEARCH USER
window.searchUser = async () => {
  const q = document.getElementById("search-user").value.trim().toLowerCase();
  const usersRef = ref(db, "users");

  const snap = await get(usersRef);
  let found = false;
  const div = document.getElementById("user-result");
  div.innerHTML = "";

  snap.forEach(child => {
    const user = child.val();
    if (
      user.uidCode?.toLowerCase() === q ||
      user.username?.toLowerCase() === q
    ) {
      found = true;
      div.innerHTML = `
        <p>🔹 UID: ${user.uidCode}</p>
        <p>👤 Email: ${user.email}</p>
        <p>💰 Balance: ₹${user.balance || 0}</p>
        <p>🎡 Unlocked: ${user.unlocked}</p>
        <button onclick="unlockUser('${child.key}')">Unlock</button>
        <button onclick="lockUser('${child.key}')">Lock</button>
        <button onclick="deleteUser('${child.key}')">❌ Delete</button>
        <button onclick="resetPassword('${child.key}')">🔄 Reset Password</button>
      `;
    }
  });

  if (!found) div.innerHTML = `<div class="alert">User not found.</div>`;
};

// 🔓 Unlock user
window.unlockUser = async (uid) => {
  await update(ref(db, `users/${uid}`), { unlocked: true });
  alert("✅ User Unlocked");
};

// 🔒 Lock user
window.lockUser = async (uid) => {
  await update(ref(db, `users/${uid}`), { unlocked: false });
  alert("🔒 User Locked");
};

// 🗑️ Delete user
window.deleteUser = async (uid) => {
  if (confirm("Are you sure?")) {
    await remove(ref(db, `users/${uid}`));
    alert("User deleted.");
  }
};

// 🔄 Reset password
window.resetPassword = async (uid) => {
  // You can implement password field logic or use Firebase admin SDK (external)
  alert("Manual reset required via Firebase console.");
};

// 🎡 ASSIGN SPINS + WIN AMOUNT
window.assignSpin = async () => {
  const uid = document.getElementById("spin-uid").value.trim();
  const spins = parseInt(document.getElementById("spin-count").value);
  const winAmt = parseInt(document.getElementById("win-amount").value);

  if (!uid || isNaN(spins)) return alert("Invalid UID or spin count");

  const userRef = ref(db, `users`);
  const snap = await get(userRef);
  let foundUID = null;

  snap.forEach(child => {
    if (child.val().uidCode === uid) {
      foundUID = child.key;
    }
  });

  if (!foundUID) return alert("UID not found.");

  await update(ref(db, `users/${foundUID}`), {
    spinsLeft: spins,
    assignedWin: isNaN(winAmt) ? null : winAmt
  });

  document.getElementById("spin-uid").value = "";
  document.getElementById("spin-count").value = "";
  document.getElementById("win-amount").value = "";
  alert("🎯 Spin assigned successfully!");
};

// 💸 LOAD WITHDRAWALS
// 💸 LOAD WITHDRAWALS (Updated with UID, Name, and Mobile)
window.loadWithdrawals = async () => {
  const list = document.getElementById("withdraw-list");
  list.innerHTML = "Loading...";

  const withdrawalsSnap = await get(ref(db, `withdrawals`));
  const usersSnap = await get(ref(db, `users`));

  list.innerHTML = "";

  withdrawalsSnap.forEach(user => {
    const uid = user.key;
    const userData = usersSnap.child(uid).val();

    const userName = userData?.username || "Unknown";
    const userMobile = userData?.phone || "Not Provided";
    const uidCode = userData?.uidCode || "N/A";

    Object.entries(user.val()).forEach(([id, w]) => {
      const div = document.createElement("div");
      div.classList.add("panel");

      div.innerHTML = `
        <p>🔹 UID: ${uidCode}</p>
        <p>👤 Name: ${userName}</p>
        <p>📱 Phone: ${userMobile}</p>
        <p>💰 Amount: ₹${w.amount}</p>
        <p>Status: ${w.status}</p>
        <button onclick="approveWithdraw('${uid}', '${id}', ${w.amount})">✅ Approve</button>
        <button onclick="rejectWithdraw('${uid}', '${id}', ${w.amount})">❌ Reject</button>
      `;

      list.appendChild(div);
    });
  });
};

// ✅ Approve withdrawal and delete from DB
window.approveWithdraw = async (uid, id, amount) => {
  try {
    await update(ref(db, `withdrawals/${uid}/${id}`), {
      status: "Approved"
    });

    // Delete the request from DB after approval
    await remove(ref(db, `withdrawals/${uid}/${id}`));

    alert("✅ Withdrawal approved");
    loadWithdrawals();
  } catch (error) {
    console.error("Approval error:", error);
    alert("Error approving withdrawal");
  }
};

// ❌ Reject withdrawal, refund balance, and delete from DB
window.rejectWithdraw = async (uid, id, amount) => {
  try {
    const balSnap = await get(ref(db, `users/${uid}/balance`));
    const currentBal = balSnap.val() || 0;

    await update(ref(db, `users/${uid}`), {
      balance: currentBal + amount
    });

    // Delete the request from DB after rejection
    await remove(ref(db, `withdrawals/${uid}/${id}`));

    alert("❌ Withdrawal rejected & amount refunded");
    loadWithdrawals();
  } catch (error) {
    console.error("Rejection error:", error);
    alert("Error rejecting withdrawal");
  }
};



// 🧾 LOAD TICKETS
window.loadTickets = async () => {
  const list = document.getElementById("ticket-list");
  list.innerHTML = "Loading...";

  const snap = await get(ref(db, `tickets`));
  list.innerHTML = "";

  snap.forEach(user => {
    const uid = user.key;
    Object.entries(user.val()).forEach(([id, t]) => {
      const div = document.createElement("div");
      div.classList.add("panel");

      div.innerHTML = `
        <p>📨 UID: ${uid}</p>
        <p>📄 ${t.subject}</p>
        <p>${t.message}</p>
        <button onclick="replyTicket('${uid}', '${id}')">💬 Reply</button>
        <button onclick="resolveTicket('${uid}', '${id}')">✅ Mark Resolved</button>
      `;

      list.appendChild(div);
    });
  });
};

// 💬 REPLY TICKET
window.replyTicket = async (uid, id) => {
  const msg = prompt("Enter your reply:");
  if (!msg) return;

  const notifRef = ref(db, `users/${uid}/notifications`);
  await push(notifRef, msg);

  alert("Reply sent.");
};

// ✅ RESOLVE
window.resolveTicket = async (uid, id) => {
  await update(ref(db, `tickets/${uid}/${id}`), { status: "Resolved" });
  alert("Marked resolved.");
  loadTickets();
};

// 👥 REFERRAL TREE
window.viewReferralTree = async () => {
  const uidText = document.getElementById("ref-uid").value.trim();
  if (!uidText.startsWith("UID#")) return alert("Enter valid UID#...");

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
