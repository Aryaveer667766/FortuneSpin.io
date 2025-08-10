import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, set, push, get, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
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

let currentUID = null;
let currentBalance = 0;
let unlockedReferralCount = 0;

// Toggle payment method UI
methodSelect.addEventListener("change", () => {
  const method = methodSelect.value;
  upiSection.style.display = method === "upi" ? "block" : "none";
  bankSection.style.display = method === "bank" ? "block" : "none";
});

// On auth state changed
onAuthStateChanged(auth, user => {
  if (user) {
    currentUID = user.uid;
    fetchBalance();
    loadWithdrawalHistory();
    listenToUnlockedReferrals();
  } else {
    window.location.href = "index.html";
  }
});

// Fetch balance
function fetchBalance() {
  get(ref(db, `users/${currentUID}/balance`)).then(snapshot => {
    currentBalance = snapshot.exists() ? snapshot.val() : 0;
    balanceEl.textContent = `Balance: ₹${currentBalance}`;
  });
}

// Listen realtime to referrals and count unlocked ones
function listenToUnlockedReferrals() {
  const referralsRef = ref(db, `referrals/${currentUID}`);

  onValue(referralsRef, async (snapshot) => {
    if (!snapshot.exists()) {
      unlockedReferralCount = 0;
      console.log("No referrals found");
      return;
    }

    const referrals = snapshot.val();
    const referredUIDs = Object.keys(referrals);

    let count = 0;
    // Fetch all user data once to optimize reads
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) {
      unlockedReferralCount = 0;
      return;
    }
    const users = usersSnap.val();

    for (const refUID of referredUIDs) {
      if (users[refUID] && users[refUID].unlocked === true) {
        count++;
      }
    }
    unlockedReferralCount = count;
    console.log(`Unlocked referrals: ${unlockedReferralCount}`);
  });
}

// Handle withdraw form submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (unlockedReferralCount < 3) {
    showToast("You need at least 3 unlocked referrals to withdraw.", "warning");
    return;
  }

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

// Play success sound & flying money animation
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

// Toast notification helper
function showToast(message, type = "info") {
  let bgColor = "blue";
  if (type === "success") bgColor = "green";
  else if (type === "error") bgColor = "red";
  else if (type === "warning") bgColor = "orange";

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = bgColor;
  toast.style.color = "white";
  toast.style.padding = "15px 25px";
  toast.style.borderRadius = "10px";
  toast.style.fontWeight = "bold";
  toast.style.zIndex = "9999";
  toast.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 100);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
