import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  update,
  push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUID = "";
let currentUserRef = null;

// ⏳ On Login State Change
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    currentUserRef = ref(db, "users/" + currentUID);

    document.getElementById("user-uid").textContent = currentUID;
    fetchUserData();
    listenToNotifications();
    checkSpinLock();
    trackWithdrawalStatus();
    generateReferralLink();
  } else {
    window.location.href = "index.html";
  }
});

// 📊 Fetch User Data
function fetchUserData() {
  onValue(currentUserRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("user-balance").textContent = data.balance || 0;
    }
  });
}

// 🧷 Check if Spin is Locked
function checkSpinLock() {
  get(currentUserRef).then((snapshot) => {
    const userData = snapshot.val();
    const isLocked = userData?.locked;
    document.getElementById("locked-msg").style.display = isLocked ? "block" : "none";
    document.getElementById("spin-section").style.display = isLocked ? "none" : "block";
  });
}

// 🧾 Submit Support Ticket
window.submitTicket = function () {
  const subject = document.getElementById("ticket-subject").value.trim();
  const message = document.getElementById("ticket-message").value.trim();
  if (!subject || !message) return alert("Please fill both fields.");

  const ticketRef = push(ref(db, `tickets/${currentUID}`));
  set(ticketRef, {
    subject,
    message,
    timestamp: Date.now()
  }).then(() => {
    alert("Ticket submitted!");
    document.getElementById("ticket-subject").value = "";
    document.getElementById("ticket-message").value = "";
  });
};

// 🔔 Notifications
function listenToNotifications() {
  const notiRef = ref(db, "notifications/" + currentUID);
  onValue(notiRef, (snapshot) => {
    const notis = snapshot.val();
    const box = document.getElementById("notifications");
    box.innerHTML = "";
    if (notis) {
      Object.values(notis).reverse().forEach(n => {
        const div = document.createElement("div");
        div.textContent = "🔔 " + n;
        box.appendChild(div);
      });
    } else {
      box.textContent = "No messages yet.";
    }
  });
}

// 🔗 Referral Link
function generateReferralLink() {
  const link = `${window.location.origin}/signup.html?ref=${currentUID}`;
  document.getElementById("referral-link").value = link;
}

// 💸 Withdrawal Request
window.requestWithdrawal = function () {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseFloat(document.getElementById("withdraw-amount").value.trim());
  const msg = document.getElementById("withdraw-msg");

  if (!mobile || !upi || !amount || amount <= 0) {
    msg.textContent = "❌ Fill all required fields.";
    return;
  }

  get(ref(db, `users/${currentUID}`)).then((snap) => {
    const user = snap.val();
    const balance = parseFloat(user.balance || 0);
    const referrals = user.referrals ? Object.keys(user.referrals).length : 0;

    if (referrals < 3) {
      msg.textContent = "❌ Minimum 3 referrals required to withdraw.";
      return;
    }

    if (amount > balance) {
      msg.textContent = "❌ Insufficient balance.";
      return;
    }

    // Deduct Balance and Store Request
    const withdrawalData = {
      uid: currentUID,
      mobile,
      upi,
      ifsc,
      amount,
      timestamp: Date.now(),
      status: "Pending"
    };

    const newRef = push(ref(db, "withdrawals"));
    set(newRef, withdrawalData);
    update(currentUserRef, {
      balance: balance - amount
    });

    msg.textContent = "✅ Withdrawal request submitted.";
    trackWithdrawalStatus(); // Refresh status
  });
};

// 📦 Track Withdrawal Status
function trackWithdrawalStatus() {
  const statusBox = document.getElementById("withdraw-status-box");
  const statusText = document.getElementById("withdraw-status");

  const withdrawalsRef = ref(db, "withdrawals");
  onValue(withdrawalsRef, (snapshot) => {
    let latest = null;

    snapshot.forEach(child => {
      const data = child.val();
      if (data.uid === currentUID) {
        if (!latest || data.timestamp > latest.timestamp) {
          latest = data;
        }
      }
    });

    if (latest) {
      statusBox.style.display = "block";
      statusText.textContent = latest.status || "Pending";
    } else {
      statusBox.style.display = "none";
    }
  });
}
