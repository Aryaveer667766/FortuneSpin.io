import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  set,
  get,
  update
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Login
window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const loginMsg = document.getElementById("login-msg");

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    loginMsg.innerText = "Login successful!";
    location.href = (email === "admin@admin.com") ? "admin.html" : "index.html";
  } catch (error) {
    loginMsg.innerText = error.message;
  }
};

// Register
window.register = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const loginMsg = document.getElementById("login-msg");

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    await set(ref(db, "users/" + uid), {
      email: email,
      uid: uid,
      balance: 0,
      referrals: [],
      rewardHistory: [],
      spinCount: 0
    });
    loginMsg.innerText = "Registered successfully!";
    location.href = "index.html";
  } catch (error) {
    loginMsg.innerText = error.message;
  }
};

// Spin Logic
let currentUser = null;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snapshot = await get(ref(db, "users/" + user.uid));
    if (snapshot.exists()) {
      document.getElementById("user-balance").innerText = snapshot.val().balance;
    }
  } else {
    if (location.pathname.includes("index")) location.href = "login.html";
  }
});

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
    result.innerText = `You won ₹${reward}! 🎉`;

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
