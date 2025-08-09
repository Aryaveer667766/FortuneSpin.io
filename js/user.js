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
  if (!user) return window.location.href = "index.html";

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

// Track spins & total win for the session
let spinCount = 0;
let totalWin = 0;

// 🎡 SPIN Wheel Logic
window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left!");

  spinCount++;
  spinSound.play();
  document.getElementById("spin-result").innerText = "Spinning...";

  setTimeout(async () => {
    let outcome;

    if (spinCount < 3) {
      // First two spins: keep room for 500 target
      const min = 10;
      const max = 200;
      const remainingSpins = 3 - spinCount;
      const remainingTarget = 500 - totalWin - (remainingSpins * 10); // Reserve min possible later

      outcome = Math.min(
        Math.floor(Math.random() * (max - min + 1) + min),
        remainingTarget > 0 ? remainingTarget : max
      );
    } else {
      // Last spin: close to 500 but not exactly
      let diff = 500 - totalWin;
      if (diff <= 0) {
        outcome = Math.floor(Math.random() * 100 + 10); // If overshot already
      } else {
        outcome = diff - 1; // Avoid exactly 500
      }
    }

    totalWin += outcome;

    winSound.play();
    confetti({ origin: { y: 0.5 }, particleCount: 150, spread: 80 });

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}!`;

    await update(userRef, {
      balance: (data.balance || 0) + outcome,
      spinsLeft: data.spinsLeft - 1
    });

    balanceEl.innerText = (data.balance || 0) + outcome;
    console.log(`Spin ${spinCount}: ₹${outcome} | Total: ₹${totalWin}`);
  }, 3000);
};



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
