import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
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
const jackpotSound = new Audio('assets/jackpot.mp3'); // Add a jackpot sound file

// 💸 Elements
const balanceEl = document.getElementById("user-balance");
const uidEl = document.getElementById("user-uid");
const referralEl = document.getElementById("referral-link");
const wheelEl = document.getElementById("wheel");

// Wheel segments (clockwise)
const wheelSegments = [
  { label: "Try Again", prize: 0 },
  { label: "Small Win", prize: () => Math.floor(Math.random() * 20) + 10 },
  { label: "Medium Win", prize: () => Math.floor(Math.random() * 50) + 30 },
  { label: "Big Win", prize: () => Math.floor(Math.random() * 100) + 60 },
  { label: "Jackpot", prize: 500, rare: true }
];
const segmentAngle = 360 / wheelSegments.length;

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
      const updatedBalance = (Number(referrerData.balance) || 0) + 99;

      await update(referrerRef, { balance: updatedBalance });
      await update(userRef, { referralBonusGiven: true });
    }

    previousUnlockedStatus = userData.unlocked;
  });
}

window.spinWheel = async () => {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val();

  if (!data.unlocked) return alert("🔒 Spin locked. Share your referral link to unlock.");
  if (data.spinsLeft <= 0) return alert("😢 No spins left!");

  spinSound.play();
  document.getElementById("spin-result").innerText = "Spinning...";

  if (wheelEl) {
    wheelEl.style.transition = "transform 4s ease-out";
    let rareJackpot = Math.random() < 0.02; // 2% jackpot chance
    let selectedIndex;
    if (rareJackpot) {
      selectedIndex = wheelSegments.findIndex(s => s.label === "Jackpot");
    } else {
      selectedIndex = Math.floor(Math.random() * wheelSegments.length);
      if (wheelSegments[selectedIndex].label === "Jackpot") selectedIndex = 0; // avoid jackpot unless rare
    }

    const finalAngle = (wheelSegments.length - selectedIndex) * segmentAngle - (segmentAngle / 2);
    const randomTurns = 4 + Math.floor(Math.random() * 2); // 4-5 spins
    const totalRotation = randomTurns * 360 + finalAngle;

    wheelEl.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(async () => {
      const segment = wheelSegments[selectedIndex];
      let prize = typeof segment.prize === "function" ? segment.prize() : segment.prize;

      if (prize > 0) {
        if (segment.label === "Jackpot") {
          jackpotSound.play();
          confetti({ particleCount: 300, spread: 100 });
        } else {
          winSound.play();
          confetti({ particleCount: 150, spread: 80 });
        }
        document.getElementById("spin-result").innerText = `🎉 ${segment.label}! You won ₹${prize}!`;
        await update(userRef, {
          balance: (data.balance || 0) + prize,
          spinsLeft: data.spinsLeft - 1
        });
        balanceEl.innerText = (data.balance || 0) + prize;
      } else {
        document.getElementById("spin-result").innerText = "😢 Try Again!";
        await update(userRef, { spinsLeft: data.spinsLeft - 1 });
      }
    }, 4000);
  }
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
