import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  onValue,
  update,
  push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { app } from "./firebase.js"; // make sure firebase.js exports app

const auth = getAuth(app);
const db = getDatabase(app);

const upiField = document.getElementById("upi-field");
const bankFields = document.getElementById("bank-fields");
const paymentType = document.getElementById("payment-type");

// Toggle between UPI / Bank
paymentType.addEventListener("change", () => {
  if (paymentType.value === "upi") {
    upiField.style.display = "block";
    bankFields.style.display = "none";
  } else {
    upiField.style.display = "none";
    bankFields.style.display = "block";
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const uid = user.uid;
  const userRef = ref(db, "users/" + uid);

  get(userRef).then((snapshot) => {
    const data = snapshot.val();
    const balance = data?.balance || 0;
    const referrals = data?.referrals || {};
    const referralCount = Object.keys(referrals).length;

    document.getElementById("user-balance").textContent = balance;
    document.getElementById("referral-count").textContent = referralCount;
  });

  // Show history
  const historyRef = ref(db, "withdrawals");
  onValue(historyRef, (snap) => {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    const data = snap.val();
    for (const key in data) {
      if (data[key].uid === uid) {
        const item = document.createElement("li");
        item.textContent = `₹${data[key].amount} • ${data[key].status} • ${new Date(data[key].timestamp).toLocaleString()}`;
        list.appendChild(item);
      }
    }
  });

  // Handle withdrawal submit
  document.getElementById("withdraw-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const msgEl = document.getElementById("withdraw-msg");

    const mobile = document.getElementById("withdraw-mobile").value.trim();
    const amount = parseFloat(document.getElementById("withdraw-amount").value.trim());
    const method = paymentType.value;

    const upi = document.getElementById("withdraw-upi").value.trim();
    const account = document.getElementById("withdraw-account").value.trim();
    const ifsc = document.getElementById("withdraw-ifsc").value.trim();

    if (!mobile || isNaN(amount) || amount <= 0 || (method === "upi" && !upi) || (method === "bank" && (!account || !ifsc))) {
      msgEl.textContent = "❌ Please fill all fields correctly.";
      return;
    }

    get(userRef).then((snapshot) => {
      const data = snapshot.val();
      const balance = data?.balance || 0;
      const referrals = data?.referrals || {};

      if (balance < amount) {
        msgEl.textContent = "❌ Not enough balance.";
        return;
      }

      if (Object.keys(referrals).length < 3) {
        msgEl.textContent = "⚠️ You need at least 3 referrals to withdraw.";
        return;
      }

      const withdrawalData = {
        uid,
        name: data?.name || "User",
        mobile,
        upiOrAccount: method === "upi" ? upi : account,
        ifsc: method === "bank" ? ifsc : "N/A",
        method,
        amount,
        status: "Pending",
        timestamp: new Date().toISOString()
      };

      const updates = {};
      updates["users/" + uid + "/balance"] = balance - amount;
      updates["withdrawals/" + uid + "_" + Date.now()] = withdrawalData;

      update(ref(db), updates).then(() => {
        msgEl.textContent = "✅ Withdrawal request submitted!";
        document.getElementById("withdraw-form").reset();
      }).catch(() => {
        msgEl.textContent = "❌ Something went wrong. Try again.";
      });
    });
  });
});
