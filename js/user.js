// 📦 Firebase Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  child,
  onValue,
  update,
  push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// 🔐 Firebase Config
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

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase();
const auth = getAuth(app);

let currentUID = null;

// 🔁 Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    loadUserData(user.uid);
    loadWithdrawalHistory();
    loadNotifications();
  } else {
    window.location.href = "index.html";
  }
});

// 🎡 Spin Logic
const wheel = document.getElementById("wheel");
const resultText = document.getElementById("spin-result");
const spinButton = document.querySelector("button[onclick='spinWheel()']");
const spinSound = new Audio("assets/spin.mp3");
spinSound.preload = "auto";

const prizes = ["₹168", "₹596", "₹991", "₹1047", "₹1579", "₹2039", "₹0", "₹5097"];

function spinWheel() {
  if (!currentUID) return;

  spinButton.disabled = true;
  const prizeIndex = Math.floor(Math.random() * prizes.length);
  const prize = prizes[prizeIndex];
  const sliceAngle = 360 / prizes.length;
  const randomOffset = Math.floor(Math.random() * sliceAngle);
  const rotation = (360 * 5) + (prizeIndex * sliceAngle) + randomOffset;

  wheel.style.transition = "transform 4s ease-out";
  wheel.style.transform = `rotate(${rotation}deg)`;

  spinSound.currentTime = 0;
  spinSound.play();

  setTimeout(() => {
    if (prize === "₹0") {
      resultText.textContent = "😢 Oops! You got ₹0!";
    } else {
      resultText.textContent = `🎉 You won ${prize}!`;
      triggerConfetti();

      // Add to user balance
      const wonAmount = parseInt(prize.replace("₹", ""));
      const balanceRef = ref(db, `users/${currentUID}/balance`);
      get(balanceRef).then((snapshot) => {
        const currentBalance = snapshot.exists() ? snapshot.val() : 0;
        set(balanceRef, currentBalance + wonAmount);
      });
    }

    spinButton.disabled = false;
  }, 4000);
}

// 🎊 Confetti
function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;

  const confetti = window.confetti.create(canvas, { resize: true });
  confetti({ particleCount: 100, spread: 90 });
}

// 📩 Load Notifications
function loadNotifications() {
  const notiBox = document.getElementById("notifications");
  if (!notiBox) return;

  const notiRef = ref(db, `notifications/${currentUID}`);
  onValue(notiRef, (snapshot) => {
    notiBox.innerHTML = "";
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const id in data) {
        const msg = data[id];
        const div = document.createElement("div");
        div.className = "notification";
        div.innerText = msg;
        notiBox.appendChild(div);
      }
    }
  });
}

// 📤 Withdrawal Request
window.requestWithdrawal = function () {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const msgBox = document.getElementById("withdraw-msg");

  if (!mobile || (!upi && !account) || !amount || amount < 1) {
    msgBox.innerText = "⚠️ Fill all required fields correctly.";
    return;
  }

  // Must have 3 referrals
  const referralRef = ref(db, `users/${currentUID}/referrals`);
  get(referralRef).then((snapshot) => {
    const referrals = snapshot.exists() ? Object.keys(snapshot.val()) : [];
    if (referrals.length < 3) {
      msgBox.innerText = "❌ You need at least 3 referrals to withdraw.";
      return;
    }

    // Check balance
    const balanceRef = ref(db, `users/${currentUID}/balance`);
    get(balanceRef).then((balSnap) => {
      const balance = balSnap.exists() ? balSnap.val() : 0;
      if (amount > balance) {
        msgBox.innerText = "⚠️ Insufficient balance.";
        return;
      }

      // Deduct balance and push withdrawal
      const withdrawRef = ref(db, `withdrawals/${currentUID}`);
      const newRef = push(withdrawRef);
      const requestData = {
        mobile,
        upi,
        account,
        ifsc,
        amount,
        status: "Pending",
        time: new Date().toLocaleString()
      };

      set(newRef, requestData).then(() => {
        set(balanceRef, balance - amount);
        msgBox.innerText = "✅ Withdrawal request submitted!";
        loadWithdrawalHistory();
      });
    });
  });
};

// 📜 Load Withdrawal History
function loadWithdrawalHistory() {
  const box = document.getElementById("withdraw-history");
  if (!box) return;

  const refHist = ref(db, `withdrawals/${currentUID}`);
  onValue(refHist, (snapshot) => {
    box.innerHTML = "";
    if (snapshot.exists()) {
      const data = snapshot.val();
      const entries = Object.values(data).reverse();

      for (const entry of entries) {
        const div = document.createElement("div");
        div.className = "withdraw-entry";
        div.innerHTML = `
          <b>₹${entry.amount}</b> – ${entry.status}<br/>
          <small>${entry.time}</small>
        `;
        box.appendChild(div);
      }
    } else {
      box.innerHTML = "<p>No withdrawals yet.</p>";
    }
  });
}

// 👤 Load User Data (Balance, Name, etc)
function loadUserData(uid) {
  const balRef = ref(db, `users/${uid}/balance`);
  get(balRef).then((snap) => {
    if (snap.exists()) {
      document.getElementById("balance").innerText = "₹" + snap.val();
    }
  });
}

// 🚪 Logout
window.logout = function () {
  signOut(auth);
};
