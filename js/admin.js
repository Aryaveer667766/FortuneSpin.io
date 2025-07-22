import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, remove, push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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

// =================== USERS ===================
function loadUsers() {
  onValue(ref(db, 'users'), snapshot => {
    const container = document.getElementById("user-list");
    container.innerHTML = "";
    snapshot.forEach(userSnap => {
      const user = userSnap.val();
      const uid = userSnap.key;
      const div = document.createElement("div");
      div.className = "user-card";
      div.innerHTML = `
        <p><strong>UID#${uid.slice(-6)}</strong></p>
        <p>Phone: ${user.phone || "-"}</p>
        <p>Balance: ₹${user.balance || 0}</p>
        <p>Locked: ${user.locked ? "Yes" : "No"}</p>
        <button onclick="editBalance('${uid}')">Edit Balance</button>
        <button onclick="toggleLock('${uid}', ${!user.locked})">
          ${user.locked ? "Unlock" : "Lock"}
        </button>
        <button onclick="deleteUser('${uid}')">Delete</button>
      `;
      container.appendChild(div);
    });
  });
}
window.editBalance = (uid) => {
  const amount = prompt("New balance:");
  if (amount) update(ref(db, `users/${uid}`), { balance: parseInt(amount) });
};
window.toggleLock = (uid, status) => {
  update(ref(db, `users/${uid}`), { locked: status });
};
window.deleteUser = (uid) => {
  if (confirm("Delete user permanently?")) remove(ref(db, `users/${uid}`));
};

// =================== WITHDRAWALS ===================
function loadWithdrawals() {
  onValue(ref(db, 'withdrawals'), snapshot => {
    const container = document.getElementById("withdrawal-list");
    container.innerHTML = "";
    snapshot.forEach(child => {
      const data = child.val();
      const id = child.key;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <p>UID: ${data.uid}</p>
        <p>Phone: ${data.phone}</p>
        <p>Amount: ₹${data.amount}</p>
        <p>Method: ${data.method}</p>
        <p>Details: ${data.method === "upi" ? data.upi : data.accountNumber + " / " + data.ifsc}</p>
        <button onclick="approveWithdrawal('${id}')">✅ Approve</button>
        <button onclick="rejectWithdrawal('${id}')">❌ Reject</button>
      `;
      container.appendChild(div);
    });
  });
}
window.approveWithdrawal = (id) => remove(ref(db, `withdrawals/${id}`));
window.rejectWithdrawal = (id) => remove(ref(db, `withdrawals/${id}`));

// =================== TICKETS ===================
function loadTickets() {
  onValue(ref(db, 'supportTickets'), snapshot => {
    const container = document.getElementById("ticket-list");
    container.innerHTML = "";
    snapshot.forEach(child => {
      const data = child.val();
      const id = child.key;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <p><strong>${data.uid}</strong></p>
        <p>${data.message}</p>
        <button onclick="deleteTicket('${id}')">🗑 Delete</button>
      `;
      container.appendChild(div);
    });
  });
}
window.deleteTicket = (id) => remove(ref(db, `supportTickets/${id}`));

// =================== REFERRAL TREE ===================
function loadReferrals() {
  onValue(ref(db, 'referrals'), snapshot => {
    const container = document.getElementById("referral-list");
    container.innerHTML = "";
    snapshot.forEach(codeSnap => {
      const code = codeSnap.key;
      const users = Object.keys(codeSnap.val() || {}).length;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<p><strong>${code}</strong> referred ${users} user(s)</p>`;
      container.appendChild(div);
    });
  });
}

// =================== FAKE USER GENERATOR ===================
window.generateFakeUser = () => {
  const uid = Math.random().toString(36).substring(2, 10);
  const userData = {
    phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    balance: Math.floor(Math.random() * 1000),
    locked: false
  };
  set(ref(db, `users/${uid}`), userData);
};

// =================== INIT ===================
window.addEventListener("DOMContentLoaded", () => {
  loadUsers();
  loadWithdrawals();
  loadTickets();
  loadReferrals();
});
