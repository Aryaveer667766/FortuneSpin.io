import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

import confetti from 'https://cdn.skypack.dev/canvas-confetti';

let currentUser, uid;



// 🎨 Confetti Canvas
const confettiCanvas = document.getElementById("confetti-canvas");
if (confettiCanvas) {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

// 🎵 Sounds
const spinSound = new Audio('assets/spin.mp3');
const winSound = new Audio('assets/win.mp3');

// 💸 Elements
const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");

// 🧠 UID Generator
function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `UID#${result}`;
}

// ✅ On Auth Login
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";

  currentUser = user;
  uid = user.uid;

  const userRef = ref(db, `users/${uid}`);
  const userSnap = await get(userRef);

  const urlParams = new URLSearchParams(window.location.search);
  const referralBy = urlParams.get("ref");

  if (!userSnap.exists()) {
    const newUID = generateUID();

    await set(userRef, {
      email: user.email,
      balance: 0,
      unlocked: false,
      uidCode: newUID,
      referralBy: referralBy || "",
      notifications: [],
      spinsLeft: 1
    });

    if (referralBy) {
      const referralRef = ref(db, `referrals/${referralBy}/${uid}`);
      await set(referralRef, true);
    }

    uidEl.innerText = newUID;
    referralEl.value = `${window.location.origin}/?ref=${newUID}`;
    document.getElementById("locked-msg").style.display = "block";
    return;
  }

  const data = userSnap.val();
  uidEl.innerText = data.uidCode;
  referralEl.value = `${window.location.origin}/?ref=${data.uidCode}`;
  balanceEl.innerText = data.balance || 0;

  if (data.unlocked) {
    document.getElementById("spin-section").style.display = "block";
  } else {
    document.getElementById("locked-msg").style.display = "block";
  }

  loadNotifications();
});

// 🎡 SPIN Wheel Logic
window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left!");

  spinSound.play();
  document.getElementById("spin-result").innerText = "Spinning...";

  setTimeout(async () => {
    const outcome = data.assignedWin || Math.floor(Math.random() * 200 + 10); // ₹10–₹210
    winSound.play();
    confetti({ origin: { y: 0.5 }, particleCount: 150, spread: 80 });

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}!`;

    await update(userRef, {
      balance: (data.balance || 0) + outcome,
      spinsLeft: data.spinsLeft - 1
    });

    balanceEl.innerText = (data.balance || 0) + outcome;
  }, 3000);
};
function requestWithdrawal() {
  const uid = auth.currentUser?.uid;
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value);
  const msgEl = document.getElementById("withdraw-msg");

  if (!mobile || !upi || !amount || amount <= 0) {
    msgEl.textContent = "❗ Please fill all required fields correctly.";
    return;
  }

  if (!uid) {
    msgEl.textContent = "❗ User not logged in.";
    return;
  }

  const userRef = ref(db, `users/${uid}`);
  get(userRef).then((snapshot) => {
    const userData = snapshot.val();
    const balance = userData?.balance || 0;

    // Count number of referrals (keys in referrals object)
    const referralObj = userData?.referrals || {};
    const referralCount = Object.keys(referralObj).length;

    if (referralCount < 3) {
      msgEl.textContent = "❗ You must have at least 3 referrals to request withdrawal.";
      return;
    }

    if (balance < amount) {
      msgEl.textContent = "❗ Insufficient balance.";
      return;
    }

    // Deduct balance and log withdrawal
    const withdrawalId = push(ref(db, `withdrawals/${uid}`)).key;
    const withdrawalData = {
      mobile,
      upi,
      ifsc,
      amount,
      status: "Pending",
      timestamp: Date.now()
    };

    const updates = {};
    updates[`users/${uid}/balance`] = balance - amount;
    updates[`withdrawals/${uid}/${withdrawalId}`] = withdrawalData;

    update(ref(db), updates)
      .then(() => {
        msgEl.textContent = "✅ Withdrawal request submitted successfully!";
        document.getElementById("withdraw-form").reset();
      })
      .catch((err) => {
        msgEl.textContent = "❌ Error submitting request.";
        console.error(err);
      });
  });
}


// 🧾 Submit Support Ticket
window.submitTicket = async () => {
  const subject = document.getElementById("ticket-subject").value;
  const msg = document.getElementById("ticket-message").value;
  if (!subject || !msg) return alert("Please fill both subject and message.");

  const ticketRef = ref(db, `supportTickets/${uid}`);
  await push(ticketRef, {
    subject,
    message: msg,
    status: "Open",
    timestamp: new Date().toISOString()
  });

  alert("📩 Ticket submitted!");
  document.getElementById("ticket-subject").value = "";
  document.getElementById("ticket-message").value = "";
};

// 🔔 Real-Time Notifications
function loadNotifications() {
  const notifRef = ref(db, `users/${uid}/notifications`);
  onValue(notifRef, (snapshot) => {
    const data = snapshot.val();
    const container = document.getElementById("notifications");
    container.innerHTML = "";

    if (data) {
      Object.values(data).forEach(msg => {
        const p = document.createElement("p");
        p.innerText = `🔔 ${msg}`;
        container.appendChild(p);
      });
    } else {
      container.innerText = "No messages yet.";
    }
  });
}
