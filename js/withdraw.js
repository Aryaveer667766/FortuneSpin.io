import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUID = null;

// Wait for DOM
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUID = user.uid;
      fetchUserInfo(currentUID);
      loadWithdrawals(currentUID);
    } else {
      window.location.href = "index.html";
    }
  });

  // Toggle between UPI and Bank
  document.getElementById("payment-type").addEventListener("change", (e) => {
    const upiField = document.getElementById("upi-field");
    const bankFields = document.getElementById("bank-fields");
    if (e.target.value === "upi") {
      upiField.style.display = "block";
      bankFields.style.display = "none";
    } else {
      upiField.style.display = "none";
      bankFields.style.display = "block";
    }
  });

  // Submit form
  document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await requestWithdrawal();
  });
});

async function fetchUserInfo(uid) {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      const data = snap.val();
      const balanceEl = document.getElementById("user-balance"); // FIXED
      const referralEl = document.getElementById("referral-count");

      if (balanceEl && referralEl) {
        balanceEl.textContent = `${data.balance || 0}`;
        referralEl.textContent = `${data.referrals ? Object.keys(data.referrals).length : 0}`;
      }
    }
  } catch (err) {
    console.error("Error fetching info:", err);
  }
}

async function requestWithdrawal() {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const paymentType = document.getElementById("payment-type").value;
  const msgEl = document.getElementById("withdraw-msg");

  msgEl.textContent = "";

  if (!mobile || isNaN(amount) || amount < 1) {
    msgEl.textContent = "❌ Please fill all fields correctly.";
    return;
  }

  if (paymentType === "upi" && !upi) {
    msgEl.textContent = "❌ Please enter UPI ID.";
    return;
  }

  if (paymentType === "bank" && (!account || !ifsc)) {
    msgEl.textContent = "❌ Please enter bank account & IFSC.";
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

    const withdrawalRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(withdrawalRef, {
      mobile,
      upi: paymentType === "upi" ? upi : null,
      account: paymentType === "bank" ? account : null,
      ifsc: paymentType === "bank" ? ifsc : null,
      amount,
      status: "Pending",
      timestamp: new Date().toISOString()
    });

    await set(ref(db, `users/${currentUID}/balance`), balance - amount);

    msgEl.textContent = "✅ Withdrawal requested successfully.";

    const sound = document.getElementById("success-sound");
    if (sound) sound.play();

    // Cash animation
    for (let i = 0; i < 10; i++) {
      const bill = document.createElement("div");
      bill.className = "money-fly";
      bill.style.left = Math.random() * 90 + "%";
      bill.style.top = "80%";
      document.body.appendChild(bill);
      setTimeout(() => bill.remove(), 2000);
    }

    fetchUserInfo(currentUID);
    loadWithdrawals(currentUID);

  } catch (err) {
    console.error("Withdrawal error:", err);
    msgEl.textContent = "❌ Error submitting withdrawal.";
  }
}

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
