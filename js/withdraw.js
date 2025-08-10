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

// Toast container for notifications
const toastContainer = document.createElement("div");
toastContainer.style.position = "fixed";
toastContainer.style.top = "20px";
toastContainer.style.right = "20px";
toastContainer.style.zIndex = "9999";
document.body.appendChild(toastContainer);

// Show toast function
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.minWidth = "250px";
  toast.style.marginBottom = "10px";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "8px";
  toast.style.color = "#fff";
  toast.style.fontWeight = "600";
  toast.style.boxShadow = "0 0 12px rgba(0,0,0,0.3)";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "10px";
  toast.style.fontFamily = "'Orbitron', sans-serif";

  if (type === "warning") {
    toast.style.backgroundColor = "#ff9800";
  } else if (type === "error") {
    toast.style.backgroundColor = "#f44336";
  } else if (type === "success") {
    toast.style.backgroundColor = "#4caf50";
  } else {
    toast.style.backgroundColor = "#2196f3";
  }

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
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

// Check unlocked referrals count
async function checkUnlockedReferrals(userUID) {
  const referralsRef = ref(db, `referrals/${userUID}`);
  const referralsSnap = await get(referralsRef);

  if (!referralsSnap.exists()) return 0;

  const referrals = referralsSnap.val();
  let unlockedCount = 0;

  for (const referralUID of Object.keys(referrals)) {
    const userRef = ref(db, `users/${referralUID}`);
    const userSnap = await get(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.val();
      // Check the 'locked' field, must be false to count as unlocked
      if (userData.locked === false) {
        unlockedCount++;
      }
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

  // Check unlocked referrals count before withdrawal
  const unlockedCount = await checkUnlockedReferrals(currentUID);
  if (unlockedCount < 3) {
    showToast("You need at least 3 unlocked referrals to withdraw.", "warning");
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

  // Deduct and store withdrawal request
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
