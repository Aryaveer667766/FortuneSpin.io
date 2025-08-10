// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  get,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const balanceEl = document.getElementById("user-balance");
const form = document.getElementById("withdraw-form");
const msg = document.getElementById("withdraw-msg");
const methodSelect = document.getElementById("payment-method");
const upiSection = document.getElementById("upi-section");
const bankSection = document.getElementById("bank-section");
const historyList = document.getElementById("withdrawal-history");
const successSound = document.getElementById("withdraw-sound"); // 🔊 Correct ID here

// Toast container for warnings
let toastTimeout;
function showToast(message, type = "warning") {
  let toast = document.getElementById("toast-message");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-message";
    toast.style = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: ${type === "warning" ? "#ffcc00" : "#4caf50"};
      color: #000;
      padding: 12px 20px;
      border-radius: 5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-weight: bold;
      z-index: 9999;
      font-family: 'Orbitron', sans-serif;
      min-width: 200px;
      text-align: center;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.backgroundColor = type === "warning" ? "#ffcc00" : "#4caf50";
  toast.style.color = "#000";

  clearTimeout(toastTimeout);
  toast.style.opacity = "1";

  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3500);
}

// UI toggle for method
methodSelect.addEventListener("change", () => {
  const method = methodSelect.value;
  upiSection.style.display = method === "upi" ? "block" : "none";
  bankSection.style.display = method === "bank" ? "block" : "none";
});

let currentUID = null;
let currentBalance = 0;
let currentUIDCode = null; // We'll store the uidCode here for referral matching

// Auth check
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUID = user.uid;
    // Fetch current user info (including balance and uidCode)
    const userSnap = await get(ref(db, `users/${currentUID}`));
    if (userSnap.exists()) {
      const userData = userSnap.val();
      currentBalance = userData.balance || 0;
      currentUIDCode = userData.uidCode || null;
      balanceEl.textContent = `Balance: ₹${currentBalance}`;
      loadWithdrawalHistory();
    } else {
      // If user record not found, redirect to login
      window.location.href = "index.html";
    }
  } else {
    window.location.href = "index.html";
  }
});

// Handle form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUIDCode) {
    msg.textContent = "User data loading, please try again.";
    msg.style.color = "red";
    return;
  }

  // Before processing withdrawal, check referral count
  const unlockedReferralsCount = await countUnlockedReferrals(currentUIDCode);

  if (unlockedReferralsCount < 3) {
    showToast(`You need at least 3 unlocked referrals to withdraw. You currently have ${unlockedReferralsCount}.`, "warning");
    return;
  }

  const method = methodSelect.value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());

  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  if (!mobile || isNaN(amount)) {
    msg.textContent = "Please fill in all required fields.";
    msg.style.color = "orange";
    return;
  }

  if (amount < 500) {
    msg.textContent = "Minimum withdrawal amount is ₹500.";
    msg.style.color = "red";
    return;
  }

  if (amount > currentBalance) {
    msg.textContent = "Insufficient balance.";
    msg.style.color = "red";
    return;
  }

  let data = {
    method,
    mobile,
    amount,
    status: "Pending",
    timestamp: Date.now()
  };

  if (method === "upi") {
    if (!upi) {
      msg.textContent = "Please enter UPI ID.";
      msg.style.color = "red";
      return;
    }
    data.upi = upi;
  } else {
    if (!account || !ifsc) {
      msg.textContent = "Please enter bank details.";
      msg.style.color = "red";
      return;
    }
    data.account = account;
    data.ifsc = ifsc;
  }

  try {
    // Create withdrawal request
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);

    // Deduct balance
    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    msg.textContent = "Withdrawal request submitted!";
    msg.style.color = "lime";
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    msg.textContent = "Error occurred. Try again.";
    msg.style.color = "red";
  }
});

// Count unlocked referrals for current user based on uidCode
async function countUnlockedReferrals(uidCode) {
  // Query users where referralBy === uidCode
  const usersRef = ref(db, 'users');
  const usersSnap = await get(usersRef);
  let count = 0;
  if (usersSnap.exists()) {
    const users = usersSnap.val();
    for (const [key, user] of Object.entries(users)) {
      if (user.referralBy === uidCode && user.unlocked === true) {
        count++;
      }
    }
  }
  return count;
}

// Fetch balance and update display
async function fetchBalance() {
  const snapshot = await get(ref(db, `users/${currentUID}/balance`));
  currentBalance = snapshot.exists() ? snapshot.val() : 0;
  balanceEl.textContent = `Balance: ₹${currentBalance}`;
}

// Load withdrawal history
async function loadWithdrawalHistory() {
  historyList.innerHTML = "";
  const snap = await get(ref(db, `withdrawals/${currentUID}`));
  if (snap.exists()) {
    const data = snap.val();
    const entries = Object.values(data).reverse();
    entries.forEach(entry => {
      const li = document.createElement("li");
      li.textContent = `${entry.method.toUpperCase()} ₹${entry.amount} - ${entry.status}`;
      historyList.appendChild(li);
    });
  }
}

// Effects on success
function playEffects() {
  if (successSound) {
    successSound.play().catch(e => console.warn("Autoplay blocked:", e));
  }

  for (let i = 0; i < 20; i++) {
    const money = document.createElement("div");
    money.className = "money-fly";
    money.style.left = Math.random() * window.innerWidth + "px";
    money.style.top = window.innerHeight + "px";
    document.body.appendChild(money);

    setTimeout(() => {
      money.remove();
    }, 2000);
  }
}
