import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, set, push, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHh9XG4eK2IDYgaUzja8Lk6obU6zxIIwc",
  authDomain: "fortunespin-57b4f.firebaseapp.com",
  databaseURL: "https://fortunespin-57b4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fortunespin-57b4f",
  storageBucket: "fortunespin-57b4f.appspot.com",
  messagingSenderId: "204339176543",
  appId: "1:204339176543:web:b417b7a2574a0e44fbe7ea"
};

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

// Check if user has at least 3 unlocked referrals (locked === false)
async function hasThreeUnlockedReferrals(uid) {
  const referralsSnap = await get(ref(db, `referrals/${uid}`));
  if (!referralsSnap.exists()) return false;

  const referredUids = Object.keys(referralsSnap.val());
  let unlockedCount = 0;

  for (const referredUid of referredUids) {
    const userSnap = await get(ref(db, `users/${referredUid}/locked`));
    if (userSnap.exists() && userSnap.val() === false) {
      unlockedCount++;
      if (unlockedCount >= 3) return true; // Found 3 unlocked referrals early exit
    }
  }
  return false; // Less than 3 unlocked referrals
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
    showMessage("Please fill in all required fields.", "orange");
    return;
  }

  if (amount < 500) {
    showMessage("Minimum withdrawal amount is ₹500.", "red");
    return;
  }

  if (amount > currentBalance) {
    showMessage("Insufficient balance.", "red");
    return;
  }

  // **Check 3 unlocked referrals here**
  const eligible = await hasThreeUnlockedReferrals(currentUID);
  if (!eligible) {
    showMessage("❗ You need at least 3 unlocked referrals to withdraw.", "orange");
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
      showMessage("Please enter UPI ID.", "red");
      return;
    }
    data.upi = upi;
  } else {
    if (!account || !ifsc) {
      showMessage("Please enter bank details.", "red");
      return;
    }
    data.account = account;
    data.ifsc = ifsc;
  }

  try {
    const newRef = push(ref(db, `withdrawals/${currentUID}`));
    await set(newRef, data);
    await set(ref(db, `users/${currentUID}/balance`), currentBalance - amount);

    showMessage("Withdrawal request submitted!", "lime");
    playEffects();
    form.reset();
    fetchBalance();
    loadWithdrawalHistory();
  } catch (error) {
    console.error("Error submitting withdrawal:", error);
    showMessage("Error occurred. Try again.", "red");
  }
});

function showMessage(text, color) {
  msg.textContent = text;
  msg.style.color = color;
}

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
