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

const confettiCanvas = document.getElementById("confetti-canvas");
if (confettiCanvas) {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

const spinSound = new Audio('assets/spin.mp3');
const winSound = new Audio('assets/win.mp3');

const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");
const wheelEl = document.getElementById("wheel");

const mysteryBoxBtn = document.getElementById("mystery-box-btn");
const mysteryBoxStatus = document.getElementById("mystery-box-status");

function generateUID(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

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
      spinsLeft: 3,
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
      const updatedBalance = (Number(referrerData.balance) || 0) + 49;

      await update(referrerRef, { balance: updatedBalance });
      await update(userRef, { referralBonusGiven: true });
    }

    previousUnlockedStatus = userData.unlocked;
  });
}

let spinCount = 0;
let totalWin = 0;

window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left!");

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
    let maxWin = data.maxWinAmount ?? 310;
    maxWin = Math.min(maxWin, 310);

    if (spinCount === 1) totalWin = 0;

    const minTotalWin = 300;
    const spinsTotal = 3;

    const remainingSpins = spinsTotal - (spinCount - 1);
    const remainingTargetMin = minTotalWin - totalWin;
    const remainingTargetMax = maxWin - totalWin;

    const minPerSpin = Math.max(10, Math.ceil(remainingTargetMin / remainingSpins));
    const maxPerSpin = Math.max(minPerSpin, Math.floor(remainingTargetMax / remainingSpins));

    let outcome;
    if (spinCount < spinsTotal) {
      outcome = Math.floor(Math.random() * (maxPerSpin - minPerSpin + 1)) + minPerSpin;
    } else {
      outcome = remainingTargetMin;
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

    if (spinCount === spinsTotal) {
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

// 🎁 Mystery Box with Countdown
function setupMysteryBox(userRef, lastClaimTimestamp = null) {
  if (!mysteryBoxBtn || !mysteryBoxStatus) return;

  function updateCountdown() {
    if (!lastClaimTimestamp) {
      mysteryBoxBtn.disabled = false;
      mysteryBoxStatus.innerText = "🎉 Mystery Box is ready to open!";
      return;
    }
    const lastClaimTime = new Date(lastClaimTimestamp).getTime();
    const nextAvailableTime = lastClaimTime + (24 * 60 * 60 * 1000);
    const now = Date.now();
    const diff = nextAvailableTime - now;

    if (diff <= 0) {
      mysteryBoxBtn.disabled = false;
      mysteryBoxStatus.innerText = "🎉 Mystery Box is ready to open!";
    } else {
      mysteryBoxBtn.disabled = true;
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      mysteryBoxStatus.innerText = `⏳ Next Mystery Box in: ${hrs}h ${mins}m ${secs}s`;
    }
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

  mysteryBoxBtn.onclick = async () => {
    if (mysteryBoxBtn.disabled) return;
    mysteryBoxBtn.disabled = true;
    mysteryBoxStatus.innerText = "Opening Mystery Box...";

    const rewardAmount = Math.floor(Math.random() * 10) + 1;

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

    lastClaimTimestamp = new Date().toISOString();

    mysteryBoxStatus.innerText = `🎉 Congrats! You got ₹${rewardAmount}!`;
    balanceEl.innerText = newBalance;

    document.getElementById('box-sound').play();
    confetti({ origin: { y: 0.5 }, particleCount: 200, spread: 90 });
  };
}
