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
      if (userData.accountLocked === false) {
        unlockedCount++;
      }
    }
  }
  return unlockedCount;
}

// Toast notification helper
function showToast(text, type = "warning") {
  let existingToast = document.getElementById("toast-notification");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.id = "toast-notification";
  toast.textContent = text;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = type === "warning" ? "#ffcc00" : (type === "error" ? "#ff4444" : "#44ff44");
  toast.style.color = "#000";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
  toast.style.fontWeight = "600";
  toast.style.zIndex = "9999";
  toast.style.fontFamily = "Orbitron, sans-serif";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";

  document.body.appendChild(toast);

  // Fade in
  setTimeout(() => { toast.style.opacity = "1"; }, 100);
  // Fade out & remove after 3.5s
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => { toast.remove(); }, 300);
  }, 3500);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const method = methodSelect.value;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

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

  // Check if user has 3 unlocked referrals
  const unlockedRefCount = await checkUnlockedReferrals(currentUID);
  if (unlockedRefCount < 3) {
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
