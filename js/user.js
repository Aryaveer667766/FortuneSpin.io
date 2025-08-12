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
const wheelEl = document.getElementById("wheel");

// Mystery Box Elements
const mysteryBoxBtn = document.getElementById("mystery-box-btn");
const mysteryBoxStatus = document.getElementById("mystery-box-status");

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
      spinsLeft: 1,
      mysteryBoxLastClaim: null
    });

    if (referralByUid) {
      const referralRef = ref(db, `referrals/${referralByUid}/${uid}`);
      await set(referralRef, true);
    }

    uidEl.innerText = newUID;
    referralEl.value = `https://fortunespin.online/signup?ref=${newUID}`;
    document.getElementById("locked-msg").style.display = "block";

    watchUnlockAndGiveReferralBonus(userRef);
    setupMysteryBox(userRef);
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
  setupMysteryBox(userRef, data.mysteryBoxLastClaim);
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

// Track spins & total win
let spinCount = 0;
let totalWin = 0;

// 🎡 SPIN Wheel Logic
window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left! message refill on whatsapp to refill your spins");

  spinCount++;
  spinSound.play();
  document.getElementById("spin-result").innerText = "Spinning...";

  if (wheelEl) {
    wheelEl.style.transition = "transform 3s ease-out";
    const randomTurns = 3 + Math.floor(Math.random() * 3);
    var randomOffset = Math.floor(Math.random() * 360);
    wheelEl.style.transform = `rotate(${randomTurns * 360 + randomOffset}deg)`;
  }

  setTimeout(async () => {
    let maxWin = data.maxWinAmount ?? null;
    let targetTotal;
    if (maxWin === null) {
      targetTotal = 280 + Math.floor(Math.random() * 22);
    } else {
      targetTotal = Math.min(maxWin, 310);
    }

    if (spinCount === 1) totalWin = 0;

    const minPerSpin = 10;
    const remainingSpins = 3 - (spinCount - 1);
    const remainingTarget = targetTotal - totalWin;

    let outcome;
    if (spinCount < 3) {
      let maxPossible = remainingTarget - minPerSpin * (remainingSpins - 1);
      maxPossible = Math.max(maxPossible, minPerSpin);
      outcome = Math.floor(Math.random() * (maxPossible - minPerSpin + 1)) + minPerSpin;
    } else {
      outcome = remainingTarget;
    }

    totalWin += outcome;

    winSound.play();
    confetti({ origin: { y: 0.5 }, particleCount: 150, spread: 80 });

    document.getElementById("spin-result").innerText = `🎉 You won ₹${outcome}!`;

    const newBalance = (data.balance || 0) + outcome;
    await update(userRef, {
      balance: newBalance,
      spinsLeft: data.spinsLeft - 1
    });

    balanceEl.innerText = newBalance;

    if (spinCount === 3) {
      spinCount = 0;
      totalWin = 0;
    }

    if (wheelEl) {
      setTimeout(() => {
        wheelEl.style.transition = "none";
        wheelEl.style.transform = `rotate(${randomOffset}deg)`;
      }, 200);
    }
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

// 🎁 Mystery Box Logic with Countdown, Glow, Shake
async function setupMysteryBox(userRef, lastClaimTimestamp = null) {
  if (!mysteryBoxBtn || !mysteryBoxStatus) return;

  mysteryBoxBtn.disabled = true;
  mysteryBoxStatus.innerText = "Loading Mystery Box status...";

  let canClaim = false;
  let nextAvailableTime = null;

  if (lastClaimTimestamp) {
    const lastClaimDate = new Date(lastClaimTimestamp);
    nextAvailableTime = new Date(lastClaimDate.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() >= nextAvailableTime) {
      canClaim = true;
    }
  } else {
    canClaim = true;
  }

  if (canClaim) {
    mysteryBoxBtn.disabled = false;
    mysteryBoxStatus.innerText = "🎉 Mystery Box is ready to open! Click the button.";
    mysteryBoxStatus.style.animation = "";
    mysteryBoxBtn.style.animation = "";
  } else {
    mysteryBoxBtn.disabled = true;
    updateCountdown();
  }

  function updateCountdown() {
    const now = new Date();
    const diffMs = nextAvailableTime - now;

    if (diffMs <= 0) {
      mysteryBoxBtn.disabled = false;
      mysteryBoxStatus.innerText = "🎉 Mystery Box is ready to open! Click the button.";
      mysteryBoxStatus.style.animation = "";
      mysteryBoxBtn.style.animation = "";
      return;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    mysteryBoxStatus.innerText = `⏳ Next Mystery Box in: ${hours}h ${minutes}m ${seconds}s`;

    // Glow when under 1 min
    if (diffMs <= 60 * 1000) {
      mysteryBoxStatus.style.animation = "glowPulse 1s infinite";
    } else {
      mysteryBoxStatus.style.animation = "";
    }

    // Shake when under 10 sec
    if (diffMs <= 10 * 1000) {
      mysteryBoxBtn.style.animation = "shakeButton 0.5s infinite";
    } else {
      mysteryBoxBtn.style.animation = "";
    }

    setTimeout(updateCountdown, 1000);
  }

  // Add CSS animations
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes glowPulse {
      0% { color: #ff4d4d; text-shadow: 0 0 5px #ff4d4d, 0 0 10px #ff8080; }
      50% { color: #ffff66; text-shadow: 0 0 10px #ffff66, 0 0 20px #ffff99; }
      100% { color: #4dff4d; text-shadow: 0 0 5px #4dff4d, 0 0 10px #80ff80; }
    }
    @keyframes shakeButton {
      0% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      75% { transform: translateX(-5px); }
      100% { transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);

  mysteryBoxBtn.onclick = async () => {
    mysteryBoxBtn.disabled = true;
    mysteryBoxStatus.innerText = "Opening Mystery Box...";
    mysteryBoxStatus.style.animation = "";
    mysteryBoxBtn.style.animation = "";

    const rewardAmount = Math.floor(Math.random() * 50) + 1;

    const snap = await get(userRef);
    if (!snap.exists()) {
      mysteryBoxStatus.innerText = "Error: User data not found.";
      return;
    }
    const data = snap.val();

    const newBalance = (data.balance || 0) + rewardAmount;

    await update(userRef, {
      balance: newBalance,
      mysteryBoxLastClaim: new Date().toISOString()
    });

    mysteryBoxStatus.innerText = `🎉 Congrats! You got ₹${rewardAmount} added to your balance!`;
    balanceEl.innerText = newBalance;

    document.getElementById('box-sound').play();
    confetti({ origin: { y: 0.5 }, particleCount: 200, spread: 90 });

    if (!data.unlocked) {
      mysteryBoxStatus.innerText += " (Unlock your account to use your balance)";
    } else {
      document.getElementById("spin-section").style.display = "block";
    }
  };
}
