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
const successSound = document.getElementById("withdraw-sound"); // 🔊 Correct ID here

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

// Count unlocked referrals for current user
async function countUnlockedReferrals() {
  const referralsSnap = await get(ref(db, `referrals/${currentUID}`));
  if (!referralsSnap.exists()) return 0;

  const referrals = referralsSnap.val();
  let count = 0;

  // referrals is an object with keys = referredUserUid, values = true
  for (const referredUid of Object.keys(referrals)) {
    const referredUserSnap = await get(ref(db, `users/${referredUid}`));
    if (referredUserSnap.exists()) {
      const referredUserData = referredUserSnap.val();
      if (referredUserData.unlocked) count++;
    }
  }
  return count;
}

// Show toast message
function showToast(message, color = "red") {
  msg.style.color = color;
  msg.textContent = message;
  setTimeout(() => {
    msg.textContent = "";
  }, 5000);
}

// Handle form submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Check unlocked referrals first
  const unlockedCount = await countUnlockedReferrals();
  if (unlockedCount < 3) {
    showToast("You need at least 3 unlocked referrals to withdraw your amount.", "orange");
    return;
  }

  const method = methodSelect.value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());

  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  if (!mobile || isNaN(amount)) {
    showToast("Please fill in all required fields.", "orange");
    return;
  }

  if (amount < 500) {
    showToast("Minimum withdrawal amount is ₹500.", "red");
    return;
  }

  if (amount > currentBalance) {
    showToast("Insufficient balance.", "red");
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
      showToast("Please enter UPI ID.", "red");
      return;
    }
    data.upi = upi;
  } else {
    if (!account || !ifsc) {
      showToast("Please enter bank details.", "red");
      return;
    }
    data.account = account;
    data.ifsc = ifsc;
  }

  // Deduct and store withdrawal request
  try {
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);
    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    showToast("Withdrawal request submitted!", "lime");
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    showToast("Error occurred. Try again.", "red");
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
