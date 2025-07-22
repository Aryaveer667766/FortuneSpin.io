import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, remove, update, push, get, child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCHh9XG4eK2IDYgaUzja8Lk6obU6zxIIwc",
  authDomain: "fortunespin-57b4f.firebaseapp.com",
  databaseURL: "https://fortunespin-57b4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fortunespin-57b4f",
  storageBucket: "fortunespin-57b4f.appspot.com",
  messagingSenderId: "204339176543",
  appId: "1:204339176543:web:b417b7a2574a0e44fbe7ea",
  measurementId: "G-VT1N70H3HK"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const userList = document.getElementById("userList");
const searchInput = document.getElementById("searchUser");
const withdrawalsDiv = document.getElementById("withdrawals");
const ticketsDiv = document.getElementById("tickets");
const referralUidInput = document.getElementById("referralUid");
const referralOutput = document.getElementById("referralOutput");
const generateFakeBtn = document.getElementById("generateFakeUser");
const viewReferralTreeBtn = document.getElementById("viewReferralTree");

function formatUID(uid) {
  return `UID#${uid.slice(-6)}`;
}

function renderUser(uid, userData) {
  const div = document.createElement("div");
  div.className = "user";
  div.innerHTML = `
    <span><b>${formatUID(uid)}</b></span>
    <span>Phone: ${userData.phone || "N/A"}</span>
    <span>Balance: ₹${userData.balance || 0}</span>
    <span>Status: ${userData.locked ? "🔒 Locked" : "✅ Active"}</span>
    <div class="controls">
      <button class="success" onclick="updateBalance('${uid}')">Add ₹100</button>
      <button class="danger" onclick="deleteUser('${uid}')">Delete</button>
      <button class="info" onclick="toggleLock('${uid}', ${userData.locked || false})">
        ${userData.locked ? "Unlock" : "Lock"}
      </button>
    </div>
  `;
  return div;
}

function fetchUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    userList.innerHTML = "";
    snapshot.forEach((child) => {
      const uid = child.key;
      const user = child.val();
      const text = `${uid} ${user.phone || ""} ${user.balance || ""}`.toLowerCase();
      if (text.includes(searchInput.value.toLowerCase())) {
        userList.appendChild(renderUser(uid, user));
      }
    });
  });
}

window.updateBalance = (uid) => {
  const userRef = ref(db, `users/${uid}`);
  get(userRef).then((snap) => {
    const balance = (snap.val().balance || 0) + 100;
    update(userRef, { balance });
  });
};

window.deleteUser = (uid) => {
  if (confirm("Delete user permanently?")) {
    remove(ref(db, `users/${uid}`));
  }
};

window.toggleLock = (uid, isLocked) => {
  update(ref(db, `users/${uid}`), { locked: !isLocked });
};

// Withdrawal Management
function loadWithdrawals() {
  const refW = ref(db, "withdrawals");
  onValue(refW, (snapshot) => {
    withdrawalsDiv.innerHTML = "";
    snapshot.forEach((child) => {
      const id = child.key;
      const data = child.val();
      const box = document.createElement("div");
      box.className = "user";
      box.innerHTML = `
        <span><b>${formatUID(id)}</b> - ₹${data.amount}</span>
        <span>Method: ${data.method}</span>
        <span>Details: ${data.details || ""}</span>
        <span>Status: ${data.status}</span>
        <div class="controls">
          <button class="success" onclick="approveWithdrawal('${id}')">Approve</button>
          <button class="danger" onclick="rejectWithdrawal('${id}')">Reject</button>
        </div>
      `;
      withdrawalsDiv.appendChild(box);
    });
  });
}

window.approveWithdrawal = (uid) => {
  update(ref(db, `withdrawals/${uid}`), { status: "Approved" }).then(() => {
    setTimeout(() => remove(ref(db, `withdrawals/${uid}`)), 1500);
  });
};

window.rejectWithdrawal = (uid) => {
  update(ref(db, `withdrawals/${uid}`), { status: "Rejected" }).then(() => {
    setTimeout(() => remove(ref(db, `withdrawals/${uid}`)), 1500);
  });
};

// Support Tickets
function loadTickets() {
  const refT = ref(db, "tickets");
  onValue(refT, (snapshot) => {
    ticketsDiv.innerHTML = "";
    snapshot.forEach((child) => {
      const id = child.key;
      const data = child.val();
      const ticket = document.createElement("div");
      ticket.className = "user";
      ticket.innerHTML = `
        <span><b>${formatUID(id)}</b></span>
        <span>Message: ${data.message}</span>
        <button class="danger" onclick="remove(ref(db, 'tickets/${id}'))">Delete</button>
      `;
      ticketsDiv.appendChild(ticket);
    });
  });
}

// Referral Tree Viewer
viewReferralTreeBtn.addEventListener("click", async () => {
  const uid = referralUidInput.value.trim();
  const treeRef = ref(db, `referrals/${uid}`);
  const snap = await get(treeRef);
  if (!snap.exists()) {
    referralOutput.textContent = "No referrals found.";
    return;
  }
  const referred = Object.keys(snap.val() || {});
  referralOutput.textContent = `Referred UIDs:\n` + referred.map(formatUID).join("\n");
});

// Fake User Generator
generateFakeBtn.addEventListener("click", () => {
  const fakeUID = `fake${Date.now()}`;
  set(ref(db, `users/${fakeUID}`), {
    phone: `9${Math.floor(Math.random() * 1000000000)}`,
    balance: Math.floor(Math.random() * 1000),
    locked: false,
    isFake: true
  });
});

// Search Filter
searchInput.addEventListener("input", fetchUsers);

// Init
fetchUsers();
loadWithdrawals();
loadTickets();
