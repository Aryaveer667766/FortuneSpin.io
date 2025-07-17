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
  child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Confetti and Sounds
const confettiCanvas = document.getElementById("confetti-canvas");
const spinSound = document.getElementById("spin-sound");
const winSound = document.getElementById("win-sound");
const errorSound = document.getElementById("error-sound");

let currentUID = null;

// On Auth
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    document.getElementById("user-uid").textContent = currentUID;
    loadUserData();
    loadNotifications();
    loadWithdrawStatus();
  } else {
    window.location.href = "index.html";
  }
});

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

  let deg = Math.floor(3600 + Math.random() * 360);
  wheel.style.transition = "all 4s ease-out";
  wheel.style.transform = `rotate(${deg}deg)`;

  const result = getRandomPrize();
  setTimeout(() => {
    winSound.play();
    showConfetti();
    document.getElementById("spin-result").textContent = `🎉 You won ₹${result}!`;
    updateUserBalance(result);
  }, 4000);
};

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

function showConfetti() {
  const confetti = window.confetti.create(confettiCanvas, { resize: true });
  confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
}

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

// 💸 Withdraw
window.requestWithdrawal = function () {
  console.log("Withdraw clicked");

  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const msgBox = document.getElementById("withdraw-msg");

  if (!mobile || !upi || isNaN(amount)) {
    msgBox.textContent = "⚠️ Please fill all required fields.";
    errorSound.play();
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

      update(userRef, {
        balance: balance - amount
      });

      msgBox.textContent = "✅ Withdrawal request submitted!";
      document.getElementById("user-balance").textContent = balance - amount;

      // Show status box
      loadWithdrawStatus();
    }
  });
};

function loadWithdrawStatus() {
  const statusRef = ref(db, "withdrawals/" + currentUID);
  get(statusRef).then((snap) => {
    if (snap.exists()) {
      document.getElementById("withdraw-status-box").style.display = "block";
      document.getElementById("withdraw-status").textContent = snap.val().status;
    }
  });
}

// 🆘 Support
window.submitTicket = function () {
  const subject = document.getElementById("ticket-subject").value.trim();
  const message = document.getElementById("ticket-message").value.trim();

  if (!subject || !message) {
    alert("Fill both subject and message.");
    return;
  }

  const ticketRef = push(ref(db, "tickets"));
  set(ticketRef, {
    uid: currentUID,
    subject,
    message,
    timestamp: Date.now()
  });

  alert("Ticket submitted!");
  document.getElementById("ticket-subject").value = "";
  document.getElementById("ticket-message").value = "";
};
