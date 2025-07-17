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
const auth = getAuth();
const db = getDatabase(app);

// 🎯 On user state change
onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    const userRef = ref(db, "users/" + uid);

    // 💰 Fetch balance
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      document.getElementById("user-balance").textContent = data?.balance || 0;

      // 🔔 Notifications (real-time)
      if (data?.notification) {
        document.getElementById("notification").textContent = data.notification;
      }
    });
  } else {
    window.location.href = "index.html";
  }
});

// 🎡 SPIN
document.getElementById("spin-btn").addEventListener("click", () => {
  const spinBtn = document.getElementById("spin-btn");
  const wheel = document.getElementById("wheel");
  const result = document.getElementById("result");

  spinBtn.disabled = true;
  wheel.classList.add("spinning");

  const audio = new Audio("assets/spin.mp3");
  audio.play().catch(() => {}); // silent fail if browser blocks autoplay

  setTimeout(() => {
    wheel.classList.remove("spinning");

    const reward = Math.floor(Math.random() * 100) + 1;
    result.textContent = `You won ₹${reward}!`;

    const user = auth.currentUser;
    const userRef = ref(db, "users/" + user.uid);

    get(userRef).then((snapshot) => {
      const currentBalance = snapshot.val()?.balance || 0;
      update(userRef, { balance: currentBalance + reward });
    });

    // Confetti 🎉
    confetti();
    spinBtn.disabled = false;
  }, 3000);
});

// 📤 Support Ticket
document.getElementById("support-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const message = document.getElementById("support-message").value.trim();
  const user = auth.currentUser;

  if (!message || !user) return;

  const supportRef = ref(db, "supportTickets");
  push(supportRef, {
    uid: user.uid,
    message,
    time: new Date().toISOString()
  }).then(() => {
    alert("✅ Support request sent!");
    document.getElementById("support-message").value = "";
  });
});

// 🚪 Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});

// 💸 Withdrawal Handler
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
  const userRef = ref(db, "users/" + uid);

  get(userRef).then((snapshot) => {
    const data = snapshot.val();

    if (!data || typeof data.balance !== "number") {
      msgEl.textContent = "❌ Unable to fetch balance.";
      return;
    }

    if (data.balance < amount) {
      msgEl.textContent = "❌ Insufficient balance.";
      return;
    }

    const referrals = data.referrals ? Object.keys(data.referrals) : [];
    if (referrals.length < 3) {
      msgEl.textContent = "⚠️ You must have at least 3 referrals to withdraw.";
      return;
    }

    const withdrawalData = {
      uid,
      name: data.name || "Unnamed",
      mobile,
      upiOrAccount,
      ifsc: ifsc || "N/A",
      amount,
      status: "Pending",
      timestamp: new Date().toISOString()
    };

    const updates = {};
    updates["users/" + uid + "/balance"] = data.balance - amount;
    updates["withdrawals/" + uid + "_" + Date.now()] = withdrawalData;

    update(ref(db), updates)
      .then(() => {
        msgEl.textContent = "✅ Withdrawal request submitted!";
        document.getElementById("withdraw-form").reset();
      })
      .catch((err) => {
        console.error(err);
        msgEl.textContent = "❌ Something went wrong. Try again.";
      });
  });
}
