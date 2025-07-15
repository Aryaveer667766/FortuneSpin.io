import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  set
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const loginMsg = document.getElementById("login-msg");

window.register = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    loginMsg.innerText = "Login successful!";
    location.href = (email === "admin@admin.com") ? "admin.html" : "index.html";
  } catch (error) {
    loginMsg.innerText = error.message;
  }
};
