import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUID = null;

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUID = user.uid;
      fetchBalance();
      loadWithdrawals();
    } else {
      window.location.href = "index.html";
    }
  });

  const methodSelect = document.getElementById("payment-method");
  methodSelect.addEventListener("change", () => {
    const upi = document.getElementById("upi-section");
    const bank = document.getElementById("bank-section");

    if (methodSelect.value === "upi") {
      upi.style.display = "block";
      bank.style.display = "none";
    } else {
      upi.style.display = "none";
      bank.style.display = "block";
    }
  });

  document.getElementById("withdraw-form").addEventListener("submit", handleWithdraw);
});

async function fetchBalance() {
  const snap = await get(ref(db, `users/${currentUID}/balance`));
  if (snap.exists()) {
    const bal = snap.val();
    document.getElementById("user-balance").textContent = `₹${bal}`;
  }
}

async function handleWithdraw(e) {
  e.preventDefault();
  const msg = document.getElementById("withdraw-msg");
  msg.textContent = "";

  const method = document.getElementById("payment-method").value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  if (!mobile || isNaN(amount)) {
    msg.textContent = "❌ Please enter all required fields.";
    return;
  }

  if (amount < 500) {
    msg.textContent = "❌ Minimum withdrawal is ₹500.";
    return;
  }

  if (method === "upi" && !upi) {
    msg.textContent = "❌ Enter valid UPI ID.";
    return;
  }

  if (method === "bank" && (!account || !ifsc)) {
    msg.textContent = "❌ Enter valid account details.";
    return;
  }

  const balanceSnap = await get(ref(db, `users/${currentUID}/balance`));
  const balance = balanceSnap.exists() ? parseInt(balanceSnap.val()) : 0;

  if (amount > balance) {
    msg.textContent = "❌ Insufficient balance.";
    return;
  }

  // Create withdrawal entry
  const withdrawalRef = push(ref(db, `withdrawals/${currentUID}`));
  await set(withdrawalRef, {
    method,
    mobile,
    upi: method === "upi" ? upi : null,
    account: method === "bank" ? account : null,
    ifsc: method === "bank" ? ifsc : null,
    amount,
    status: "Pending",
    timestamp: new Date().toISOString()
  });

  // Deduct balance
  await set(ref(db, `users/${currentUID}/balance`), balance - amount);

  msg.textContent = "✅ Withdrawal requested.";

  // Sound + animation
  const sound = document.getElementById("success-sound");
  if (sound) sound.play();

  for (let i = 0; i < 10; i++) {
    const money = document.createElement("div");
    money.className = "money-fly";
    money.style.left = Math.random() * 90 + "%";
    document.body.appendChild(money);
    setTimeout(() => money.remove(), 2000);
  }

  fetchBalance();
  loadWithdrawals();
}

async function loadWithdrawals() {
  const list = document.getElementById("withdrawal-history");
  list.innerHTML = "";
  const snap = await get(ref(db, `withdrawals/${currentUID}`));

  if (snap.exists()) {
    const data = Object.values(snap.val()).reverse();
    data.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `₹${item.amount} - ${item.status}<br><small>${item.timestamp}</small>`;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = "<li>No withdrawal history yet.</li>";
  }
}
