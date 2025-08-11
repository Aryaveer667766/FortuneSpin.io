// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  get
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
const successSound = document.getElementById("withdraw-sound");

// Create toast container once
let toastTimeout;
let toast;
(function createToast() {
  toast = document.createElement("div");
  toast.id = "toast-message";
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    min-width: 220px;
    max-width: 320px;
    padding: 14px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #000;
    opacity: 0;
    pointer-events: none;
    user-select: none;
    transition: opacity 0.4s ease, transform 0.4s ease;
    background-color: #ffcc00;
    transform: translateY(-20px);
    z-index: 9999;
  `;

  // Icon span
  const icon = document.createElement("span");
  icon.id = "toast-icon";
  icon.style.fontSize = "20px";
  toast.appendChild(icon);

  // Message span
  const message = document.createElement("span");
  message.id = "toast-text";
  message.style.flex = "1";
  toast.appendChild(message);

  // Close button
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.fontSize = "20px";
  closeBtn.style.marginLeft = "10px";
  closeBtn.title = "Dismiss";
  closeBtn.onclick = () => hideToast();
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);
})();

// Toast show/hide logic
function showToast(message, type = "warning") {
  const iconEl = document.getElementById("toast-icon");
  const textEl = document.getElementById("toast-text");

  // Define icon + colors by type
  const icons = {
    success: "✔️",
    warning: "⚠️",
    error: "❌",
    info: "ℹ️",
  };

  const bgColors = {
    success: "#4caf50",
    warning: "#ffcc00",
    error: "#f44336",
    info: "#2196f3",
  };

  toast.style.backgroundColor = bgColors[type] || bgColors.warning;
  toast.style.color = "#000";
  iconEl.textContent = icons[type] || icons.warning;
  textEl.textContent = message;

  toast.style.pointerEvents = "auto";
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 4000);
}

function hideToast() {
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-20px)";
  toast.style.pointerEvents = "none";
  clearTimeout(toastTimeout);
}

// UI toggle for method
methodSelect.addEventListener("change", () => {
  const method = methodSelect.value;
  upiSection.style.display = method === "upi" ? "block" : "none";
  bankSection.style.display = method === "bank" ? "block" : "none";
});

let currentUID = null;
let currentBalance = 0;
let currentUIDCode = null;

// Auth check
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUID = user.uid;
    const userSnap = await get(ref(db, `users/${currentUID}`));
    if (userSnap.exists()) {
      const userData = userSnap.val();
      currentBalance = userData.balance || 0;
      currentUIDCode = userData.uidCode || null;
      balanceEl.textContent = `Balance: ₹${currentBalance}`;
      loadWithdrawalHistory();
    } else {
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
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);

    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    msg.textContent = "Withdrawal request submitted!";
    msg.style.color = "lime";
    showToast("Withdrawal request submitted successfully!", "success");
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    msg.textContent = "Error occurred. Try again.";
    msg.style.color = "red";
    showToast("Error occurred. Please try again.", "error");
  }
});

// Count unlocked referrals for current user based on uidCode
async function countUnlockedReferrals(uidCode) {
  const usersRef = ref(db, 'users');
  const usersSnap = await get(usersRef);
  let count = 0;
  if (usersSnap.exists()) {
    const users = usersSnap.val();
    for (const user of Object.values(users)) {
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
