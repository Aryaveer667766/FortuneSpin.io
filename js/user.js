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

const confettiCanvas = document.getElementById("confetti-canvas");
confettiCanvas.width = window.innerWidth;
confettiCanvas.height = window.innerHeight;

const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");

const spinSound = new Audio('assets/spin.mp3');
const winSound = new Audio('assets/win.mp3');
const clickSound = new Audio('assets/sounds/click.mp3');

let currentUser, uid;

// Generate UID
function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return `UID#${result}`;
}

// 🔔 Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
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
    loadWithdrawals();
  } else {
    window.location.href = "login.html";
  }
});

// 🎡 Spin
window.spinWheel = async () => {
  spinSound.play();

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (data.spinsLeft <= 0) {
    alert("No spins left!");
    return;
  }

  document.getElementById("spin-result").innerText = "Spinning...";

  setTimeout(async () => {
    const outcome = data.assignedWin || Math.floor(Math.random() * 1000);
    winSound.play();
    confetti({ particleCount: 100, spread: 70 });

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}`;

    await update(userRef, {
      balance: (data.balance || 0) + outcome,
      spinsLeft: data.spinsLeft - 1
    });

    balanceEl.innerText = (data.balance || 0) + outcome;
  }, 3000);
};

// 💸 Withdraw Logic
window.requestWithdrawal = async () => {
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();
  const amount = parseInt(document.getElementById("withdraw-amount").value.trim());

  if (!mobile || isNaN(amount) || amount <= 0 || (!upi && !account)) {
    alert("Please fill all required fields properly.");
    return;
  }

  if (account && !ifsc) {
    alert("IFSC is required for bank withdrawals.");
    return;
  }

  const snap = await get(ref(db, `users/${uid}`));
  const data = snap.val();

  if (amount > data.balance) {
    alert("Insufficient balance.");
    return;
  }

  // Check referral count
  const referralsSnap = await get(ref(db, `referrals/${data.uidCode}`));
  const referralList = referralsSnap.exists() ? Object.values(referralsSnap.val()) : [];

  if (referralList.length < 3) {
    alert("❌ You must have at least 3 referrals to withdraw.");
    return;
  }

  const withdrawalData = {
    mobile,
    upi,
    account,
    ifsc,
    amount,
    status: "Pending",
    date: new Date().toISOString()
  };

  await push(ref(db, `withdrawals/${uid}`), withdrawalData);
  document.getElementById("withdraw-msg").innerText = "✅ Withdrawal Requested! You can track it below.";
  document.getElementById("withdraw-form").reset();

  // Deduct amount immediately
  await update(ref(db, `users/${uid}`), {
    balance: data.balance - amount
  });

  balanceEl.innerText = data.balance - amount;
  loadWithdrawals();
};

// 📊 Track Withdrawals
function loadWithdrawals() {
  const list = document.getElementById("withdraw-history");
  const refPath = ref(db, `withdrawals/${uid}`);

  onValue(refPath, (snap) => {
    list.innerHTML = "";
    if (snap.exists()) {
      Object.values(snap.val()).forEach(w => {
        const item = document.createElement("div");
        item.className = "withdraw-item";
        item.innerHTML = `<p>₹${w.amount} — ${w.status}</p><small>${new Date(w.date).toLocaleString()}</small>`;
        list.appendChild(item);
      });
    } else {
      list.innerHTML = "<p>No withdrawals yet.</p>";
    }
  });
}

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

  alert("Ticket submitted!");
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
