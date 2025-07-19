import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, set, push, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Your Firebase config
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

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

let currentUID = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    fetchUserInfo();
    loadWithdrawalHistory();
  } else {
    window.location.href = "index.html"; // redirect to login
  }
});

function fetchUserInfo() {
  const userRef = ref(db, "users/" + currentUID);
  get(userRef).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      document.getElementById("balance").textContent = data.balance || 0;
      document.getElementById("referral-count").textContent = Object.keys(data.referrals || {}).length;
    }
  
}

window.requestWithdrawal = function () {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());
  const msg = document.getElementById("withdraw-msg");

  if (!mobile || !upi || !amount || isNaN(amount)) {
    msg.textContent = "❗ Please fill all required fields properly.";
    return;
  }

  const userRef = ref(db, "users/" + currentUID);
  get(userRef).then(snapshot => {
    if (!snapshot.exists()) {
      msg.textContent = "User not found.";
      return;
    }

    const userData = snapshot.val();
    const currentBalance = userData.balance || 0;
    const referrals = userData.referrals || {};
    const referralCount = Object.keys(referrals).length;

    if (referralCount < 3) {
      msg.textContent = "⚠️ You need at least 3 referrals to withdraw.";
      return;
    }

    if (amount > currentBalance) {
      msg.textContent = "❌ Insufficient balance.";
      return;
    }

    // Deduct balance and store request
    const newBalance = currentBalance - amount;
    const withdrawData = {
      uid: currentUID,
      mobile,
      upi,
      ifsc,
      amount,
      status: "Pending",
      timestamp: new Date().toISOString()
    };

    const withdrawalRef = push(ref(db, "withdrawals"));
    const updates = {};
    updates["users/" + currentUID + "/balance"] = newBalance;
    updates["users/" + currentUID + "/withdrawals/" + withdrawalRef.key] = withdrawData;
    updates["withdrawals/" + withdrawalRef.key] = withdrawData;

    set(ref(db), null); // Optional: clean state

    set(ref(db), updates).then(() => {
      msg.style.color = "lime";
      msg.textContent = "✅ Withdrawal request submitted!";
      document.getElementById("withdraw-form").reset();
      document.getElementById("balance").textContent = newBalance;

      playSuccess();
      loadWithdrawalHistory();
    });
  });
}

function loadWithdrawalHistory() {
  const list = document.getElementById("history-list");
  const refUserWithdrawals = ref(db, "users/" + currentUID + "/withdrawals");
  onValue(refUserWithdrawals, snapshot => {
    list.innerHTML = "";
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.values(data).reverse().forEach(entry => {
        const li = document.createElement("li");
        li.textContent = `₹${entry.amount} - ${entry.status}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>No history yet.</li>";
    }
  });
}

function playSuccess() {
  const audio = document.getElementById("success-sound");
  audio.play();

  for (let i = 0; i < 15; i++) {
    const money = document.createElement("div");
    money.className = "money-fly";
    money.style.left = Math.random() * 100 + "vw";
    money.style.top = "100vh";
    document.body.appendChild(money);
    setTimeout(() => money.remove(), 2000);
  }
}
