import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref, set, get, update, onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

let currentUser = null;

// 🔐 LOGIN
window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("login-msg");

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = email === "admin@admin.com";
    location.href = isAdmin ? "admin.html" : "index.html";
  } catch (err) {
    msg.innerText = err.message;
  }
};

// 🔐 REGISTER
window.register = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("login-msg");

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    // Get referral ID from URL param (if present)
    const params = new URLSearchParams(window.location.search);
    const referredBy = params.get("ref");

    await set(ref(db, "users/" + uid), {
      uid,
      email,
      balance: 0,
      spinCount: 0,
      referredBy: referredBy || null,
      rewardHistory: [],
      locked: true  // 🔐 user is locked by default
    });

    // Reward referrer ₹99
    if (referredBy) {
      const refSnap = await get(ref(db, "users/" + referredBy));
      if (refSnap.exists()) {
        const oldBal = refSnap.val().balance || 0;
        await update(ref(db, "users/" + referredBy), {
          balance: oldBal + 99
        });
      }
    }

    location.href = "index.html";
  } catch (err) {
    msg.innerText = err.message;
  }
};

// 🔁 AUTH STATE CHECK
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;

    const userRef = ref(db, "users/" + user.uid);
    const snap = await get(userRef);
    const data = snap.val();

    // 🔐 Check lock status
    if (!data || data.locked === true) {
      document.getElementById("locked-msg")?.style?.setProperty("display", "block");
      document.querySelectorAll("section:not(.balance-section)").forEach(sec => sec.style.display = "none");
      return;
    }

    // ✅ Load dashboard
    document.getElementById("user-balance")?.innerText = data.balance || 0;
    document.getElementById("user-uid")?.innerText = data.uid;

    // 🔔 Notifications
    const notiRef = ref(db, "notifications/" + user.uid);
    onValue(notiRef, snap => {
      if (snap.exists()) {
        const msg = snap.val().msg;
        document.getElementById("notifications").innerText = "📢 " + msg;
      }
    });

  } else {
    // Redirect if not logged in
    const page = window.location.pathname;
    if (page.includes("index") || page.includes("admin")) {
      location.href = "login.html";
    }
  }
});

// 🎰 SPIN FUNCTION
window.spinWheel = async function () {
  const wheel = document.getElementById("wheel");
  const result = document.getElementById("spin-result");

  const rewards = [0, 5, 10, 15, 20, 25, 50, 100];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  const index = Math.floor(Math.random() * rewards.length);
  const reward = rewards[index];
  const angle = 3600 + angles[index];

  wheel.style.transform = `rotate(${angle}deg)`;
  result.innerText = "Spinning...";

  setTimeout(async () => {
    result.innerText = `🎉 You won ₹${reward}`;

    const userRef = ref(db, "users/" + currentUser.uid);
    const snap = await get(userRef);
    const prevBal = snap.val().balance || 0;

    await update(userRef, {
      balance: prevBal + reward,
      rewardHistory: [...(snap.val().rewardHistory || []), reward],
      spinCount: (snap.val().spinCount || 0) + 1
    });

    document.getElementById("user-balance").innerText = prevBal + reward;
  }, 4000);
};

// 💸 WITHDRAW REQUEST
window.requestWithdrawal = async function () {
  const amount = parseInt(document.getElementById("withdraw-amount").value);
  const msg = document.getElementById("withdraw-msg");

  if (!amount || amount < 50) {
    msg.innerText = "Minimum ₹50 required.";
    return;
  }

  const userRef = ref(db, "users/" + currentUser.uid);
  const snap = await get(userRef);
  const balance = snap.val().balance;

  if (amount > balance) {
    msg.innerText = "Not enough balance.";
    return;
  }

  const withdrawalRef = ref(db, `withdrawals/${currentUser.uid}_${Date.now()}`);
  await set(withdrawalRef, {
    uid: currentUser.uid,
    email: snap.val().email,
    amount: amount,
    status: "pending",
    timestamp: Date.now()
  });

  msg.innerText = `Request for ₹${amount} sent ✅`;
};
