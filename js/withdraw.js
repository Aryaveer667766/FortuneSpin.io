// Import Firebase modules (assumes firebase-app, firebase-auth, firebase-database already loaded via script tags)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, push, set, child } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// 🔥 Firebase Config
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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUID = null;

// 📥 On Page Load
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    fetchUserInfo(currentUID);
    loadWithdrawals(currentUID);
  } else {
    window.location.href = "index.html"; // Redirect to login
  }
});

// 🔎 Fetch User Info (balance, referral count)
async function fetchUserInfo(uid) {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      const data = snap.val();
      document.getElementById("balance").textContent = `₹${data.balance || 0}`;
      document.getElementById("referral-count").textContent = `${data.referrals ? Object.keys(data.referrals).length : 0}`;
    }
  } catch (err) {
    console.error("Error fetching info:", err);
  }
}

// 💸 Request Withdrawal
window.requestWithdrawal = async function () {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const msgEl = document.getElementById("withdraw-msg");

  msgEl.textContent = "";

  if (!mobile || !upi || isNaN(amount) || amount < 1) {
    msgEl.textContent = "❌ Please fill all fields correctly.";
    return;
  }

  try {
    const userSnap = await get(ref(db, `users/${currentUID}`));
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.val();
    const balance = parseInt(userData.balance || 0);
    const referralCount = userData.referrals ? Object.keys(userData.referrals).length : 0;

    if (referralCount < 3) {
      msgEl.textContent = "❌ You need at least 3 referrals to withdraw.";
      return;
    }

    if (amount > balance) {
      msgEl.textContent = "❌ Insufficient balance.";
      return;
    }

    // Proceed with request
    const withdrawalRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(withdrawalRef, {
      mobile,
      upi,
      ifsc,
      amount,
      status: "Pending",
      timestamp: new Date().toISOString()
    });

    // Deduct balance
    await set(ref(db, `users/${currentUID}/balance`), balance - amount);

    msgEl.textContent = "✅ Withdrawal requested successfully.";

    // 🎉 Effects
    document.getElementById("success-sound").play();
    for (let i = 0; i < 10; i++) {
      const bill = document.createElement("div");
      bill.className = "money-fly";
      bill.style.left = Math.random() * 90 + "%";
      bill.style.top = "80%";
      document.body.appendChild(bill);
      setTimeout(() => bill.remove(), 2000);
    }

    // Refresh balance & history
    fetchUserInfo(currentUID);
    loadWithdrawals(currentUID);
  } catch (err) {
    console.error(err);
    msgEl.textContent = "❌ Error submitting withdrawal.";
  }
};

// 📜 Load Withdrawal History
async function loadWithdrawals(uid) {
  try {
    const snap = await get(ref(db, `withdrawals/${uid}`));
    const list = document.getElementById("history-list");
    list.innerHTML = "";

    if (snap.exists()) {
      const data = snap.val();
      const items = Object.values(data).reverse();
      items.forEach(entry => {
        const li = document.createElement("li");
        li.innerHTML = `₹${entry.amount} - ${entry.status || "Pending"} <br><small>${entry.timestamp}</small>`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>No withdrawal history.</li>";
    }
  } catch (err) {
    console.error("Error loading withdrawals:", err);
  }
}
