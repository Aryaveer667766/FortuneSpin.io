import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  ref,
  get,
  set,
  push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

let uid;

// 👤 On Auth State Changed
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";
  uid = user.uid;

  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const data = snapshot.val();
    document.getElementById("user-uid").textContent = data.uidCode || "N/A";
    document.getElementById("user-balance").textContent = data.balance || 0;
  } else {
    alert("User data not found!");
  }
});

// 💸 Handle Withdrawal Request
document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const amount = parseInt(document.getElementById("withdraw-amount").value);
  const method = document.querySelector('input[name="withdraw-method"]:checked');
  const mobile = document.getElementById("withdraw-mobile").value.trim();
  const upi = document.getElementById("withdraw-upi").value.trim();
  const account = document.getElementById("withdraw-account").value.trim();
  const ifsc = document.getElementById("withdraw-ifsc").value.trim();

  if (!method) return alert("Please select a withdrawal method.");
  if (!mobile) return alert("Please enter mobile number.");
  if (method.value === "upi" && !upi) return alert("Please enter UPI ID.");
  if (method.value === "bank" && (!account || !ifsc)) return alert("Please enter Account Number and IFSC.");

  if (isNaN(amount) || amount < 500) {
    return alert("Minimum withdrawal amount is ₹500.");
  }

  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    return alert("User not found.");
  }

  const userData = snapshot.val();
  const currentBalance = userData.balance || 0;

  if (amount > currentBalance) {
    return alert("Insufficient balance.");
  }

  // Create withdrawal entry
  const withdrawalData = {
    uid: uid,
    amount: amount,
    mobile: mobile,
    method: method.value,
    upi: upi || "",
    account: account || "",
    ifsc: ifsc || "",
    status: "Pending",
    requestedAt: new Date().toISOString()
  };

  // Push to withdrawal requests
  const withdrawalRef = ref(db, `withdrawals`);
  await push(withdrawalRef, withdrawalData);

  // Deduct balance immediately
  await set(userRef, {
    ...userData,
    balance: currentBalance - amount
  });

  alert("✅ Withdrawal request submitted!");
  document.getElementById("withdraw-form").reset();
  document.getElementById("user-balance").textContent = currentBalance - amount;
});
