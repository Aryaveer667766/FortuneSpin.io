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

// Count unlocked referrals
async function countUnlockedReferrals(uid) {
  const usersRef = ref(db, 'users');
  const usersSnap = await get(usersRef);

  if (!usersSnap.exists()) {
    return 0;
  }

  const users = usersSnap.val();
  let unlockedCount = 0;

  for (const [key, userData] of Object.entries(users)) {
    if (userData.referralBy === uid && userData.accountLocked === false) {
      unlockedCount++;
    }
  }

  return unlockedCount;
}

// Handle form submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const method = methodSelect.value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());

  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  if (!mobile || isNaN(amount)) {
    showToast("⚠️ Please fill in all required fields.");
    return;
  }

  if (amount < 500) {
    showToast("⚠️ Minimum withdrawal amount is ₹500.");
    return;
  }

  if (amount > currentBalance) {
    showToast("⚠️ Insufficient balance.");
    return;
  }

  // Check unlocked referrals
  const unlockedRefCount = await countUnlockedReferrals(currentUID);
  if (unlockedRefCount < 3) {
    showToast(`⚠️ You need 3 unlocked referrals to withdraw. Currently: ${unlockedRefCount}`);
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
      showToast("⚠️ Please enter UPI ID.");
      return;
    }
    data.upi = upi;
  } else {
    if (!account || !ifsc) {
      showToast("⚠️ Please enter bank details.");
      return;
    }
    data.account = account;
    data.ifsc = ifsc;
  }

  try {
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);
    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    showToast("✅ Withdrawal request submitted!");
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    showToast("❌ Error occurred. Try again.");
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

// Toast notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.backgroundColor = "#ffcc00";
  toast.style.color = "#000";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "5px";
  toast.style.fontWeight = "bold";
  toast.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  toast.style.zIndex = 9999;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
