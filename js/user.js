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

// 🎨 Canvas Setup
const confettiCanvas = document.getElementById("confetti-canvas");
if (confettiCanvas) {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");

// 🔊 Sounds
const spinSound = new Audio('assets/spin.mp3');
const winSound = new Audio('assets/win.mp3');
const clickSound = new Audio('assets/sounds/click.mp3');

// 🧠 Helper: Generate UID
function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for(let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return `UID#${result}`;
}

// ✅ On Auth
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";

  currentUser = user;
  uid = user.uid;

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);

  if (!snap.exists()) {
    const newUID = generateUID();
    await set(userRef, {
      email: user.email,
      balance: 0,
      unlocked: false,
      uidCode: newUID,
      referralBy: "",
      notifications: [],
      spinsLeft: 1
    });
    uidEl.innerText = newUID;
    referralEl.value = `${window.location.origin}/?ref=${newUID}`;
    document.getElementById("locked-msg").style.display = "block";
    return;
  }

  const data = snap.val();
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

// 🎡 SPIN
window.spinWheel = async () => {
  spinSound.play();

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (data.spinsLeft <= 0) {
    alert("❌ No spins left!");
    return;
  }

  document.getElementById("spin-result").innerText = "Spinning...";

  setTimeout(async () => {
    const outcome = data.assignedWin || Math.floor(Math.random() * 1000); // Admin override fallback
    winSound.play();
    confetti({ particleCount: 100, spread: 70 });

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}!`;

    await update(userRef, {
      balance: (data.balance || 0) + outcome,
      spinsLeft: data.spinsLeft - 1
    });

    balanceEl.innerText = (data.balance || 0) + outcome;
  }, 3000);
};

// 💸 Withdrawal
window.requestWithdrawal = async () => {
  const amount = parseInt(document.getElementById("withdraw-amount").value);
  if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount");

  const userSnap = await get(ref(db, `users/${uid}`));
  const data = userSnap.val();

  if (amount > data.balance) return alert("Insufficient balance");

  const withdrawalRef = ref(db, `withdrawals/${uid}`);
  await push(withdrawalRef, {
    amount,
    status: "Pending",
    date: new Date().toISOString()
  });

  document.getElementById("withdraw-msg").innerText = "✅ Withdrawal requested!";
};

// 🧾 Support Ticket
window.submitTicket = async () => {
  const subject = document.getElementById("ticket-subject").value;
  const msg = document.getElementById("ticket-message").value;
  if (!subject || !msg) return alert("Fill subject and message");

  const ticketRef = ref(db, `tickets/${uid}`);
  await push(ticketRef, {
    subject,
    message: msg,
    status: "Open",
    timestamp: new Date().toISOString()
  });

  alert("📨 Ticket submitted!");
  document.getElementById("ticket-subject").value = "";
  document.getElementById("ticket-message").value = "";
};

// 🔔 Notifications
function loadNotifications() {
  const notifRef = ref(db, `users/${uid}/notifications`);
  onValue(notifRef, (snapshot) => {
    const notifications = snapshot.val();
    const div = document.getElementById("notifications");
    div.innerHTML = "";

    if (notifications) {
      Object.values(notifications).forEach(n => {
        const p = document.createElement("p");
        p.innerText = `🔔 ${n}`;
        div.appendChild(p);
      });
    } else {
      div.innerText = "No messages yet.";
    }
  });
}
