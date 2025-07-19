// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, remove, child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCHh9XG4eK2IDYgaUzja8Lk6obU6zxIIwc",
  authDomain: "fortunespin-57b4f.firebaseapp.com",
  databaseURL: "https://fortunespin-57b4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fortunespin-57b4f",
  storageBucket: "fortunespin-57b4f.appspot.com",
  messagingSenderId: "204339176543",
  appId: "1:204339176543:web:b417b7a2574a0e44fbe7ea"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Admin credentials
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin121";

// DOM Elements
const loginSection = document.getElementById("admin-login");
const dashboardSection = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("admin-login-form");
const userList = document.getElementById("user-list");
const withdrawalList = document.getElementById("withdrawal-list");
const ticketList = document.getElementById("ticket-list");
const winRateInput = document.getElementById("win-rate");
const loseRateInput = document.getElementById("lose-rate");
const updateSpinBtn = document.getElementById("update-spin-btn");
const treeViewer = document.getElementById("referral-tree");
const treeForm = document.getElementById("tree-form");

// Admin Login
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value.trim();
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";
    loadAllData();
  } else {
    alert("Invalid admin credentials");
  }
});

// Load everything
function loadAllData() {
  loadUsers();
  listenWithdrawals();
  listenTickets();
  fetchSpinRates();
}

// Load Users
function loadUsers() {
  onValue(ref(db, "users"), snapshot => {
    userList.innerHTML = "";
    if (snapshot.exists()) {
      const users = snapshot.val();
      Object.entries(users).forEach(([uid, user]) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${uid}</strong><br>
          Balance: ₹<input type="number" value="${user.balance || 0}" id="bal-${uid}" style="width:80px" />
          <button onclick="updateBalance('${uid}')">Update</button>
        `;
        userList.appendChild(li);
      });
    }
  });
}

// Balance Updater
window.updateBalance = function(uid) {
  const val = parseInt(document.getElementById(`bal-${uid}`).value);
  if (!isNaN(val)) {
    update(ref(db, `users/${uid}`), { balance: val });
    alert("Balance updated");
  }
};

// Withdrawals
function listenWithdrawals() {
  onValue(ref(db, "withdrawals"), snapshot => {
    withdrawalList.innerHTML = "";
    if (snapshot.exists()) {
      const all = snapshot.val();
      Object.entries(all).forEach(([uid, requests]) => {
        Object.entries(requests).forEach(([reqId, req]) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <b>${req.method.toUpperCase()}</b> ₹${req.amount} - ${req.status}<br>
            Mobile: ${req.mobile}<br>
            ${req.method === "upi" ? "UPI: " + req.upi : `A/C: ${req.account} - IFSC: ${req.ifsc}`}<br>
            <button onclick="approveWithdrawal('${uid}', '${reqId}', ${req.amount})">Approve</button>
            <button onclick="rejectWithdrawal('${uid}', '${reqId}')">Reject</button>
          `;
          withdrawalList.appendChild(li);
        });
      });
    }
  });
}

window.approveWithdrawal = async function(uid, reqId, amount) {
  await update(ref(db, `withdrawals/${uid}/${reqId}`), { status: "Approved" });
  remove(ref(db, `withdrawals/${uid}/${reqId}`)); // remove after approval
};

window.rejectWithdrawal = function(uid, reqId) {
  remove(ref(db, `withdrawals/${uid}/${reqId}`));
};

// Spin Rate Controls
function fetchSpinRates() {
  get(ref(db, "settings/spinRates")).then(snapshot => {
    const data = snapshot.val() || { win: 50, lose: 50 };
    winRateInput.value = data.win;
    loseRateInput.value = data.lose;
  });
}

updateSpinBtn.addEventListener("click", () => {
  const win = parseInt(winRateInput.value);
  const lose = parseInt(loseRateInput.value);
  if (win + lose === 100) {
    set(ref(db, "settings/spinRates"), { win, lose });
    alert("Spin rates updated!");
  } else {
    alert("Win + Lose must equal 100%");
  }
});

// Support Tickets
function listenTickets() {
  onValue(ref(db, "tickets"), snapshot => {
    ticketList.innerHTML = "";
    if (snapshot.exists()) {
      const tickets = snapshot.val();
      Object.entries(tickets).forEach(([uid, msgs]) => {
        Object.entries(msgs).forEach(([msgId, msg]) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${uid}</strong>: ${msg.message} <br>
            <button onclick="remove(ref(db, 'tickets/${uid}/${msgId}'))">Delete</button>
          `;
          ticketList.appendChild(li);
        });
      });
    }
  });
}

// Referral Tree Viewer
treeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rootUID = document.getElementById("tree-uid").value.trim();
  treeViewer.innerHTML = "";
  viewTree(rootUID, 0);
});

function viewTree(uid, level) {
  get(ref(db, `referrals/${uid}`)).then(snapshot => {
    if (snapshot.exists()) {
      const children = snapshot.val();
      Object.keys(children).forEach(childUID => {
        const div = document.createElement("div");
        div.style.marginLeft = `${level * 20}px`;
        div.textContent = "↳ " + childUID;
        treeViewer.appendChild(div);
        viewTree(childUID, level + 1);
      });
    }
  });
}
