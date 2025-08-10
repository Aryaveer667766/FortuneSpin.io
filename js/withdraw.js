// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, set, push, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
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

// Toast container
const toastContainer = createToastContainer();
document.body.appendChild(toastContainer);

// UI toggle for method
methodSelect.addEventListener("change", () => {
  const method = methodSelect.value;
  upiSection.style.display = method === "upi" ? "block" : "none";
  bankSection.style.display = method === "bank" ? "block" : "none";
});

let currentUID = null;
let currentBalance = 0;

// Auth check
onAuthStateChanged(auth, user => {
  if (user) {
    currentUID = user.uid;
    fetchBalance();
    loadWithdrawalHistory();
  } else {
    window.location.href = "index.html";
  }
});

// Get balance
function fetchBalance() {
  get(ref(db, `users/${currentUID}/balance`)).then(snapshot => {
    currentBalance = snapshot.exists() ? snapshot.val() : 0;
    balanceEl.textContent = `Balance: ₹${currentBalance}`;
  });
}

// Check if user has 3 or more unlocked referrals
async function hasThreeUnlockedReferrals(uid) {
  const referralsSnap = await get(ref(db, `referrals/${uid}`));
  if (!referralsSnap.exists()) {
    return false;
  }

  const referredUids = Object.keys(referralsSnap.val());
  let unlockedCount = 0;

  for (const referredUid of referredUids) {
    try {
      const accountLockedSnap = await get(ref(db, `users/${referredUid}/accountLocked`));
      if (accountLockedSnap.exists()) {
        const accountLocked = accountLockedSnap.val();
        if (accountLocked === false) {
          unlockedCount++;
          if (unlockedCount >= 3) return true;
        }
      }
    } catch (err) {
      console.error(`Error checking accountLocked for user ${referredUid}`, err);
    }
  }

  return unlockedCount >= 3;
}

// Handle form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const method = methodSelect.value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());

  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  // Basic validations
  if (!mobile || isNaN(amount)) {
    showToast("Please fill in all required fields.", "warning");
    return;
  }

  if (amount < 500) {
    showToast("Minimum withdrawal amount is ₹500.", "warning");
    return;
  }

  if (amount > currentBalance) {
    showToast("Insufficient balance.", "error");
    return;
  }

  // Check referrals unlocked count
  const eligible = await hasThreeUnlockedReferrals(currentUID);
  if (!eligible) {
    showToast("You need at least 3 unlocked referrals to withdraw.", "warning");
    return;
  }

  // Validate payment details
  let data = {
    method,
    mobile,
    amount,
    status: "Pending",
    timestamp: Date.now()
  };

  if (method === "upi") {
    if (!upi) {
      showToast("Please enter UPI ID.", "warning");
      return;
    }
    data.upi = upi;
  } else {
    if (!account || !ifsc) {
      showToast("Please enter bank details.", "warning");
      return;
    }
    data.account = account;
    data.ifsc = ifsc;
  }

  // Deduct balance and push withdrawal request
  try {
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);
    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    showToast("Withdrawal request submitted!", "success");
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    showToast("Error occurred. Try again.", "error");
  }
});

// Load withdrawal history
function loadWithdrawalHistory() {
  historyList.innerHTML = "";
  get(ref(db, `withdrawals/${currentUID}`)).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const entries = Object.values(data).reverse();
      entries.forEach(entry => {
        const li = document.createElement("li");
        li.textContent = `${entry.method.toUpperCase()} ₹${entry.amount} - ${entry.status}`;
        historyList.appendChild(li);
      });
    }
  });
}

// Success effects
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

// Toast creation & display
function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  container.style.position = "fixed";
  container.style.top = "20px";
  container.style.right = "20px";
  container.style.zIndex = "9999";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "10px";
  return container;
}

function showToast(message, type = "info", duration = 3500) {
  const colors = {
    success: "#4BB543",
    error: "#FF4C4C",
    warning: "#ffbb33",
    info: "#209cee"
  };

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.background = colors[type] || colors.info;
  toast.style.color = "#000";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "8px";
  toast.style.minWidth = "250px";
  toast.style.fontWeight = "600";
  toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.4s ease";

  document.getElementById("toast-container").appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  // Animate out & remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.addEventListener("transitionend", () => toast.remove());
  }, duration);
}
