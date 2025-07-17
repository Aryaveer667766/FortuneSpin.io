import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  onValue,
  push,
  child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Sound Effects
const spinSound = document.getElementById("spin-sound");
const winSound = document.getElementById("win-sound");
const errorSound = document.getElementById("error-sound");

// Confetti
const confettiCanvas = document.getElementById("confetti-canvas");
const confetti = confettiCanvas.confetti || window.confetti.create(confettiCanvas, {
  resize: true,
  useWorker: true
});

// Globals
let currentUserUID = null;
let currentUserData = null;

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUID = user.uid;
    document.getElementById("user-uid").textContent = currentUserUID;
    await loadUserData();
  } else {
    window.location.href = "index.html";
  }
});

// Load User Data
async function loadUserData() {
  const snapshot = await get(ref(db, "users/" + currentUserUID));
  if (snapshot.exists()) {
    currentUserData = snapshot.val();
    updateUI(currentUserData);
    listenForNotifications();
  }
}

// Update UI
function updateUI(data) {
  document.getElementById("balance").textContent = data.balance || 0;
  document.getElementById("referral-link").value = `${window.location.origin}/?ref=${currentUserUID}`;
}

// Spin Logic
window.spinWheel = async function () {
  if (!currentUserUID) return;

  const spinBtn = document.getElementById("spin-btn");
  spinBtn.disabled = true;

  spinSound.play();

  const wheel = document.getElementById("spin-wheel");
  const deg = Math.floor(Math.random() * 360 + 1800);
  wheel.style.transition = "transform 4s ease-out";
  wheel.style.transform = `rotate(${deg}deg)`;

  setTimeout(async () => {
    const prize = Math.floor(Math.random() * 10 + 1); // Random prize
    winSound.play();
    confetti({ particleCount: 200, spread: 100 });
    alert("You won ₹" + prize + "!");

    // Update balance
    const userRef = ref(db, "users/" + currentUserUID);
    await update(userRef, {
      balance: (currentUserData.balance || 0) + prize
    });

    await loadUserData();
    spinBtn.disabled = false;
  }, 4500);
};

// Copy Referral Link
window.copyReferralLink = function () {
  const link = document.getElementById("referral-link");
  navigator.clipboard.writeText(link.value)
    .then(() => alert("Referral link copied!"));
};

// Submit Withdrawal
window.requestWithdrawal = async function () {
  const amount = parseInt(document.getElementById("withdraw-amount").value);
  const upi = document.getElementById("upi-id").value.trim();

  if (!amount || amount <= 0 || !upi) {
    alert("Enter valid amount and UPI ID.");
    errorSound.play();
    return;
  }

  // Referral check
  const referrals = currentUserData.referrals || {};
  if (Object.keys(referrals).length < 3) {
    alert("You need at least 3 referrals to withdraw.");
    errorSound.play();
    return;
  }

  // Balance check
  if (currentUserData.balance < amount) {
    alert("Insufficient balance.");
    errorSound.play();
    return;
  }

  const withdrawalRef = ref(db, `withdrawals/${currentUserUID}`);
  const newRequest = push(withdrawalRef);
  await set(newRequest, {
    amount,
    upi,
    status: "Pending",
    timestamp: Date.now()
  });

  await update(ref(db, "users/" + currentUserUID), {
    balance: currentUserData.balance - amount
  });

  alert("Withdrawal request submitted!");
  winSound.play();
  await loadUserData();
};

// Submit Support Ticket
window.submitSupportTicket = async function () {
  const issue = document.getElementById("support-text").value.trim();
  if (!issue) {
    alert("Please enter a message.");
    return;
  }

  const ticketRef = ref(db, `supportTickets/${currentUserUID}`);
  const newTicket = push(ticketRef);
  await set(newTicket, {
    message: issue,
    timestamp: Date.now()
  });

  alert("Support ticket submitted!");
  document.getElementById("support-text").value = "";
};

// Notification Listener
function listenForNotifications() {
  const notifRef = ref(db, `notifications/${currentUserUID}`);
  onValue(notifRef, (snapshot) => {
    const data = snapshot.val();
    const list = document.getElementById("notifications-list");
    list.innerHTML = "";

    if (data) {
      Object.values(data).forEach(notif => {
        const li = document.createElement("li");
        li.textContent = notif.message;
        list.appendChild(li);
      });
    }
  });
}

// Logout
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

// WhatsApp Contact
window.openWhatsApp = function () {
  const message = `Hi, my UID is ${currentUserUID}`;
  const url = `https://wa.me/6283194274244?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};
