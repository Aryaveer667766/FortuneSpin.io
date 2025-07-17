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

// 🆕 Withdrawal request handler
function requestWithdrawal() {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upiOrAccount = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseFloat(document.getElementById("withdraw-amount").value.trim());
  const msgEl = document.getElementById("withdraw-msg");

  if (!mobile || !upiOrAccount || isNaN(amount) || amount <= 0) {
    msgEl.textContent = "❌ Please fill all required fields correctly.";
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    msgEl.textContent = "❌ You must be logged in to withdraw.";
    return;
  }

  const uid = user.uid;
  const userRef = db.ref("users/" + uid);

  userRef.once("value").then((snapshot) => {
    const data = snapshot.val();

    if (!data || !data.balance || isNaN(data.balance)) {
      msgEl.textContent = "❌ Unable to fetch balance.";
      return;
    }

    if (data.balance < amount) {
      msgEl.textContent = "❌ Insufficient balance.";
      return;
    }

    // 🔍 Check referral count
    if (!data.referrals || Object.keys(data.referrals).length < 3) {
      msgEl.textContent = "⚠️ You must have at least 3 referrals to withdraw.";
      return;
    }

    const withdrawalData = {
      mobile,
      upiOrAccount,
      ifsc: ifsc || "N/A",
      amount,
      timestamp: new Date().toISOString(),
      status: "Pending"
    };

    // 🔽 Deduct balance and push withdrawal request
    const updates = {};
    updates["/users/" + uid + "/balance"] = data.balance - amount;
    updates["/withdrawals/" + uid + "_" + Date.now()] = {
      ...withdrawalData,
      uid,
      name: data.name || "Unknown"
    };

    db.ref().update(updates)
      .then(() => {
        msgEl.textContent = "✅ Withdrawal request submitted successfully!";
        document.getElementById("withdraw-form").reset();
      })
      .catch((error) => {
        console.error(error);
        msgEl.textContent = "❌ Something went wrong. Please try again.";
      });
  });
}

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
