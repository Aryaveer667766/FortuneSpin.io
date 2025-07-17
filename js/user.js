
import { auth, db } from './firebase.js';
// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  push,
  onValue
  child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

import confetti from 'https://cdn.skypack.dev/canvas-confetti';

const confettiCanvas = document.getElementById("confetti-canvas");
confettiCanvas.width = window.innerWidth;
confettiCanvas.height = window.innerHeight;

const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");
// Firebase Config
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

const spinSound = new Audio('assets/spin.mp3');
const winSound = new Audio('assets/win.mp3');
const clickSound = new Audio('assets/sounds/click.mp3');
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

let currentUser, uid;
// Confetti and Sounds
const confettiCanvas = document.getElementById("confetti-canvas");
const spinSound = document.getElementById("spin-sound");
const winSound = document.getElementById("win-sound");
const errorSound = document.getElementById("error-sound");

// Generate UID
function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return `UID#${result}`;
}
let currentUID = null;

// 🔔 Auth Check
onAuthStateChanged(auth, async (user) => {
// On Auth
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    uid = user.uid;

    const userRef = ref(db, `users/${uid}`);
    const snap = await get(userRef);

    if (!snap.exists()) {
      const newUID = generateUID();
      await set(userRef, {
        email: user.email,
        balance: 0,
        unlocked: false,
        uidCode: newUID,
        referralBy: "",
        notifications: [],
        spinsLeft: 1
      });
      uidEl.innerText = newUID;
      referralEl.value = `${window.location.origin}/?ref=${newUID}`;
      document.getElementById("locked-msg").style.display = "block";
      return;
    }

    const data = snap.val();
    uidEl.innerText = data.uidCode;
    referralEl.value = `${window.location.origin}/?ref=${data.uidCode}`;
    balanceEl.innerText = data.balance || 0;

    if (data.unlocked) {
      document.getElementById("spin-section").style.display = "block";
    } else {
      document.getElementById("locked-msg").style.display = "block";
    }

    currentUID = user.uid;
    document.getElementById("user-uid").textContent = currentUID;
    loadUserData();
    loadNotifications();
    loadWithdrawals();
    loadWithdrawStatus();
  } else {
    window.location.href = "login.html";
    window.location.href = "index.html";
  }
});

// 🎡 Spin
window.spinWheel = async () => {
// Load Data
function loadUserData() {
  const userRef = ref(db, "users/" + currentUID);
  get(userRef).then((snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const balance = data.balance || 0;
      document.getElementById("user-balance").textContent = balance;
      document.getElementById("referral-link").value = `${window.location.origin}/?ref=${currentUID}`;

      // Show correct section based on lock
      if (data.locked) {
        document.getElementById("locked-msg").style.display = "block";
      } else {
        document.getElementById("spin-section").style.display = "block";
      }
    } else {
      // Create default data
      set(userRef, {
        balance: 0,
        locked: true,
        referrals: [],
        notifications: []
      });
    }
  });
}

// SPIN Logic
window.spinWheel = function () {
  const wheel = document.getElementById("wheel");
  spinSound.play();

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();
  let deg = Math.floor(3600 + Math.random() * 360);
  wheel.style.transition = "all 4s ease-out";
  wheel.style.transform = `rotate(${deg}deg)`;

  if (data.spinsLeft <= 0) {
    alert("No spins left!");
    return;
  }
  const result = getRandomPrize();
  setTimeout(() => {
    winSound.play();
    showConfetti();
    document.getElementById("spin-result").textContent = `🎉 You won ₹${result}!`;
    updateUserBalance(result);
  }, 4000);
};

  document.getElementById("spin-result").innerText = "Spinning...";
function getRandomPrize() {
  const options = [0, 5, 10, 20, 50, 99];
  const weights = [0.3, 0.25, 0.2, 0.15, 0.08, 0.02];
  let sum = 0;
  const rand = Math.random();
  for (let i = 0; i < options.length; i++) {
    sum += weights[i];
    if (rand < sum) return options[i];
  }
  return 0;
}

  setTimeout(async () => {
    const outcome = data.assignedWin || Math.floor(Math.random() * 1000);
    winSound.play();
    confetti({ particleCount: 100, spread: 70 });
function updateUserBalance(amount) {
  const userRef = ref(db, "users/" + currentUID);
  get(userRef).then((snap) => {
    if (snap.exists()) {
      const current = snap.val().balance || 0;
      update(userRef, { balance: current + amount });
      document.getElementById("user-balance").textContent = current + amount;
    }
  });
}

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}`;
function showConfetti() {
  const confetti = window.confetti.create(confettiCanvas, { resize: true });
  confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
}

    await update(userRef, {
      balance: (data.balance || 0) + outcome,
      spinsLeft: data.spinsLeft - 1
    });
// 📢 Notifications
function loadNotifications() {
  const notifyRef = ref(db, "notifications/");
  onValue(notifyRef, (snap) => {
    const area = document.getElementById("notifications");
    area.innerHTML = "";
    if (snap.exists()) {
      const data = snap.val();
      Object.values(data).reverse().forEach((msg) => {
        const p = document.createElement("p");
        p.textContent = msg;
        area.appendChild(p);
      });
    } else {
      area.textContent = "No messages yet.";
    }
  });
}

    balanceEl.innerText = (data.balance || 0) + outcome;
  }, 3000);
};
// 💸 Withdraw
window.requestWithdrawal = function () {
  console.log("Withdraw clicked");

// 💸 Withdraw Logic
window.requestWithdrawal = async () => {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const msgBox = document.getElementById("withdraw-msg");

  if (!mobile || isNaN(amount) || amount <= 0 || (!upi && !account)) {
    alert("Please fill all required fields properly.");
  if (!mobile || !upi || isNaN(amount)) {
    msgBox.textContent = "⚠️ Please fill all required fields.";
    errorSound.play();
    return;
  }

  if (account && !ifsc) {
    alert("IFSC is required for bank withdrawals.");
    return;
  }

  const snap = await get(ref(db, `users/${uid}`));
  const data = snap.val();

  if (amount > data.balance) {
    alert("Insufficient balance.");
    return;
  }
  const userRef = ref(db, "users/" + currentUID);
  get(userRef).then((snap) => {
    if (snap.exists()) {
      const userData = snap.val();
      const referrals = userData.referrals || [];
      const balance = userData.balance || 0;

      if (referrals.length < 3) {
        msgBox.textContent = "❌ You need at least 3 referrals to withdraw.";
        errorSound.play();
        return;
      }

      if (balance < amount) {
        msgBox.textContent = "❌ Insufficient balance.";
        errorSound.play();
        return;
      }

      const withdrawRef = ref(db, "withdrawals/" + currentUID);
      set(withdrawRef, {
        uid: currentUID,
        mobile,
        upi,
        ifsc,
        amount,
        status: "Pending",
        timestamp: Date.now()
      });

  // Check referral count
  const referralsSnap = await get(ref(db, `referrals/${data.uidCode}`));
  const referralList = referralsSnap.exists() ? Object.values(referralsSnap.val()) : [];
      update(userRef, {
        balance: balance - amount
      });

  if (referralList.length < 3) {
    alert("❌ You must have at least 3 referrals to withdraw.");
    return;
  }
      msgBox.textContent = "✅ Withdrawal request submitted!";
      document.getElementById("user-balance").textContent = balance - amount;

  const withdrawalData = {
    mobile,
    upi,
    account,
    ifsc,
    amount,
    status: "Pending",
    date: new Date().toISOString()
  };

  await push(ref(db, `withdrawals/${uid}`), withdrawalData);
  document.getElementById("withdraw-msg").innerText = "✅ Withdrawal Requested! You can track it below.";
  document.getElementById("withdraw-form").reset();

  // Deduct amount immediately
  await update(ref(db, `users/${uid}`), {
    balance: data.balance - amount
      // Show status box
      loadWithdrawStatus();
    }
  });

  balanceEl.innerText = data.balance - amount;
  loadWithdrawals();
};

// 📊 Track Withdrawals
function loadWithdrawals() {
  const list = document.getElementById("withdraw-history");
  const refPath = ref(db, `withdrawals/${uid}`);

  onValue(refPath, (snap) => {
    list.innerHTML = "";
function loadWithdrawStatus() {
  const statusRef = ref(db, "withdrawals/" + currentUID);
  get(statusRef).then((snap) => {
    if (snap.exists()) {
      Object.values(snap.val()).forEach(w => {
        const item = document.createElement("div");
        item.className = "withdraw-item";
        item.innerHTML = `<p>₹${w.amount} — ${w.status}</p><small>${new Date(w.date).toLocaleString()}</small>`;
        list.appendChild(item);
      });
    } else {
      list.innerHTML = "<p>No withdrawals yet.</p>";
      document.getElementById("withdraw-status-box").style.display = "block";
      document.getElementById("withdraw-status").textContent = snap.val().status;
    }
  });
}

// 🧾 Support Ticket
window.submitTicket = async () => {
  const subject = document.getElementById("ticket-subject").value;
  const msg = document.getElementById("ticket-message").value;
  if (!subject || !msg) return alert("Fill subject and message");
// 🆘 Support
window.submitTicket = function () {
  const subject = document.getElementById("ticket-subject").value.trim();
  const message = document.getElementById("ticket-message").value.trim();

  if (!subject || !message) {
    alert("Fill both subject and message.");
    return;
  }

  const ticketRef = ref(db, `tickets/${uid}`);
  await push(ticketRef, {
  const ticketRef = push(ref(db, "tickets"));
  set(ticketRef, {
    uid: currentUID,
    subject,
    message: msg,
    status: "Open",
    timestamp: new Date().toISOString()
    message,
    timestamp: Date.now()
  });

  alert("Ticket submitted!");
  document.getElementById("ticket-subject").value = "";
  document.getElementById("ticket-message").value = "";
};

// 🔔 Notifications
function loadNotifications() {
  const notifRef = ref(db, `users/${uid}/notifications`);
  onValue(notifRef, (snapshot) => {
    const notifications = snapshot.val();
    const div = document.getElementById("notifications");
    div.innerHTML = "";

    if (notifications) {
      Object.values(notifications).forEach(n => {
        const p = document.createElement("p");
        p.innerText = `🔔 ${n}`;
        div.appendChild(p);
      });
    } else {
      div.innerText = "No messages yet.";
    }
  });
}
