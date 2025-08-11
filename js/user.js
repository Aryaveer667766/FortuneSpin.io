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
const wheelEl = document.getElementById("wheel"); // 🎡 Wheel image element

// 🧠 UID Generator
function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ✅ On Auth Login
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index.html";

  currentUser = user;
  uid = user.uid;

  const userRef = ref(db, `users/${uid}`);
  const userSnap = await get(userRef);

  const urlParams = new URLSearchParams(window.location.search);
  const referralByCode = urlParams.get("ref");

  if (!userSnap.exists()) {
    const newUID = generateUID();

    let referralByUid = "";
    if (referralByCode) {
      const usersSnap = await get(ref(db, 'users'));
      if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const [key, val] of Object.entries(users)) {
          if (val.uidCode === referralByCode) {
            referralByUid = key;
            break;
          }
        }
      }
    }

    await set(userRef, {
      email: user.email,
      balance: 0,
      unlocked: false,
      uidCode: newUID,
      referralBy: referralByCode || "",
      referralBonusGiven: false,
      notifications: [],
      spinsLeft: 1
    });

    if (referralByUid) {
      const referralRef = ref(db, `referrals/${referralByUid}/${uid}`);
      await set(referralRef, true);
    }

    uidEl.innerText = newUID;
    referralEl.value = `https://fortunespin.online/signup?ref=${newUID}`;
    document.getElementById("locked-msg").style.display = "block";

    watchUnlockAndGiveReferralBonus(userRef);
    return;
  }

  const data = userSnap.val();
  uidEl.innerText = data.uidCode;
  referralEl.value = `https://fortunespin.online/signup?ref=${data.uidCode}`;
  balanceEl.innerText = data.balance || 0;

  if (data.unlocked) {
    document.getElementById("spin-section").style.display = "block";
  } else {
    document.getElementById("locked-msg").style.display = "block";
  }

  loadNotifications();
  watchUnlockAndGiveReferralBonus(userRef);
});

function watchUnlockAndGiveReferralBonus(userRef) {
  let previousUnlockedStatus = null;

  onValue(userRef, async (snapshot) => {
    if (!snapshot.exists()) return;
    const userData = snapshot.val();

    if (previousUnlockedStatus === null) {
      previousUnlockedStatus = userData.unlocked;
      return;
    }

    if (
      previousUnlockedStatus === false &&
      userData.unlocked === true &&
      userData.referralBy &&
      !userData.referralBonusGiven
    ) {
      const referrerUidCode = userData.referralBy;
      const usersSnap = await get(ref(db, 'users'));
      if (!usersSnap.exists()) return;

      const users = usersSnap.val();
      let referrerKey = null;
      for (const [key, val] of Object.entries(users)) {
        if (val.uidCode === referrerUidCode) {
          referrerKey = key;
          break;
        }
      }

      if (!referrerKey) return;

      const referrerRef = ref(db, `users/${referrerKey}`);
      const referrerSnap = await get(referrerRef);
      if (!referrerSnap.exists()) return;

      const referrerData = referrerSnap.val();
      const currentBalance = Number(referrerData.balance) || 0;
      const updatedBalance = currentBalance + 99;

      await update(referrerRef, { balance: updatedBalance });
      await update(userRef, { referralBonusGiven: true });

      console.log(`Referral bonus ₹99 added to user ${referrerKey} for unlocking user ${uid}.`);
    }

    previousUnlockedStatus = userData.unlocked;
  });
}

// Wheel Segments
const wheelSegments = [
  { label: "Try Again", amount: 0 },
  { label: "Small Prize", amount: 20 },
  { label: "Medium Prize", amount: 50 },
  { label: "Jackpot", amount: 200 }, // rare
  { label: "Bonus", amount: 100 },
  { label: "Lucky Spin", amount: 150 }
];
const segmentAngle = 360 / wheelSegments.length;

// Track spins & total win
let spinCount = 0;
let totalWin = 0;

// 🎡 SPIN Wheel Logic
window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left! Message us on WhatsApp to refill.");

  spinCount++;
  spinSound.play();
  document.getElementById("spin-result").innerText = "Spinning...";

  // Make jackpot rare by limiting its probability
  let jackpotChance = Math.random();
  let randomOffset;
  if (jackpotChance < 0.05) {
    // land in jackpot segment range
    const jackpotIndex = wheelSegments.findIndex(s => s.label === "Jackpot");
    const jackpotStart = jackpotIndex * segmentAngle;
    randomOffset = jackpotStart + Math.random() * segmentAngle;
  } else {
    // any other segment except jackpot
    let possibleOffsets = [];
    wheelSegments.forEach((seg, idx) => {
      if (seg.label !== "Jackpot") {
        const start = idx * segmentAngle;
        possibleOffsets.push(start + Math.random() * segmentAngle);
      }
    });
    randomOffset = possibleOffsets[Math.floor(Math.random() * possibleOffsets.length)];
  }

  const randomTurns = 3 + Math.floor(Math.random() * 3);
  const finalRotation = randomTurns * 360 + randomOffset;

  wheelEl.style.transition = "transform 3s ease-out";
  wheelEl.style.transform = `rotate(${finalRotation}deg)`;

  setTimeout(async () => {
    // Determine landed segment
    const normalizedRotation = (360 - (finalRotation % 360)) % 360;
    const segmentIndex = Math.floor(normalizedRotation / segmentAngle);
    const landedSegment = wheelSegments[segmentIndex];

    let outcomeAmount = landedSegment.amount;

    // Apply maxWin cap
    if (outcomeAmount > 0 && typeof data.maxWinAmount === "number") {
      outcomeAmount = Math.min(outcomeAmount, data.maxWinAmount);
    }

    // Show result
    if (outcomeAmount > 0) {
      winSound.play();
      confetti({ origin: { y: 0.5 }, particleCount: 150, spread: 80 });
      document.getElementById("spin-result").innerText = `🎉 ${landedSegment.label}! You won ₹${outcomeAmount}`;
      const newBalance = (data.balance || 0) + outcomeAmount;
      await update(userRef, { balance: newBalance, spinsLeft: data.spinsLeft - 1 });
      balanceEl.innerText = newBalance;
    } else {
      document.getElementById("spin-result").innerText = `😢 ${landedSegment.label}`;
      await update(userRef, { spinsLeft: data.spinsLeft - 1 });
    }

    // Reset wheel position after short delay
    setTimeout(() => {
      wheelEl.style.transition = "none";
      wheelEl.style.transform = `rotate(${normalizedRotation}deg)`;
    }, 200);
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
