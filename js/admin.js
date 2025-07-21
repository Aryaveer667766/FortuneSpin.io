import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  remove,
  get,
  set
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHh9XG4eK2IDYgaUzja8Lk6obU6zxIIwc",
  authDomain: "fortunespin-57b4f.firebaseapp.com",
  databaseURL: "https://fortunespin-57b4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fortunespin-57b4f",
  storageBucket: "fortunespin-57b4f.appspot.com",
  messagingSenderId: "204339176543",
  appId: "1:204339176543:web:b417b7a2574a0e44fbe7ea"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {
  const usersList = document.getElementById("users-list");
  const withdrawalList = document.getElementById("withdrawal-list");
  const supportList = document.getElementById("support-list");
  const referralList = document.getElementById("referral-list");
  const winInput = document.getElementById("win-rate");
  const lossInput = document.getElementById("loss-rate");
  const saveSpinBtn = document.getElementById("save-spin-btn");

  // Real-time User List
  onValue(ref(db, 'users'), snapshot => {
    usersList.innerHTML = "";
    snapshot.forEach(child => {
      const uid = child.key;
      const data = child.val();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${data.name || "No Name"}</strong><br>
        UID: ${uid}<br>
        Balance: ₹<input type="number" value="${data.balance || 0}" id="bal-${uid}" />
        <button onclick="updateBalance('${uid}')">Update</button>
      `;
      usersList.appendChild(li);
    });
  });

  // Real-time Withdrawal Requests
  onValue(ref(db, 'withdrawals'), snapshot => {
    withdrawalList.innerHTML = "";
    snapshot.forEach(userSnap => {
      const uid = userSnap.key;
      userSnap.forEach(reqSnap => {
        const data = reqSnap.val();
        const reqId = reqSnap.key;
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${data.method.toUpperCase()}</strong> ₹${data.amount}<br>
          Mobile: ${data.mobile}<br>
          ${data.method === "upi" ? `UPI: ${data.upi}` : `Account: ${data.account}, IFSC: ${data.ifsc}`}<br>
          <button onclick="approveWithdraw('${uid}','${reqId}',${data.amount})">Approve</button>
          <button onclick="rejectWithdraw('${uid}','${reqId}')">Reject</button>
        `;
        withdrawalList.appendChild(li);
      });
    });
  });

  // Real-time Support Tickets
  onValue(ref(db, 'support'), snapshot => {
    supportList.innerHTML = "";
    snapshot.forEach(child => {
      const uid = child.key;
      child.forEach(ticket => {
        const data = ticket.val();
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${data.subject}</strong><br>
          ${data.message}<br>
          From UID: ${uid}
        `;
        supportList.appendChild(li);
      });
    });
  });

  // Real-time Referral Tree
  onValue(ref(db, 'referrals'), snapshot => {
    referralList.innerHTML = "";
    snapshot.forEach(referrer => {
      const uid = referrer.key;
      const referred = Object.keys(referrer.val()).join(", ");
      const li = document.createElement("li");
      li.innerHTML = `UID: ${uid} referred → ${referred}`;
      referralList.appendChild(li);
    });
  });

  // Load Spin Win/Loss Rates
  get(ref(db, 'spinConfig')).then(snapshot => {
    const config = snapshot.val();
    if (config) {
      winInput.value = config.win || 50;
      lossInput.value = config.loss || 50;
    }
  });

  saveSpinBtn.addEventListener("click", () => {
    const win = parseInt(winInput.value);
    const loss = parseInt(lossInput.value);
    set(ref(db, 'spinConfig'), { win, loss });
    alert("Spin win/loss rate updated.");
  });
});

// ✅ Global functions
window.updateBalance = function (uid) {
  const input = document.getElementById(`bal-${uid}`);
  const val = parseInt(input.value);
  if (!isNaN(val)) {
    update(ref(db, `users/${uid}`), { balance: val });
    alert("Balance updated");
  }
};

window.approveWithdraw = async function (uid, reqId, amt) {
  await update(ref(db, `withdrawals/${uid}/${reqId}`), { status: "Approved" });
  setTimeout(() => {
    remove(ref(db, `withdrawals/${uid}/${reqId}`));
  }, 2000); // Auto remove after 2 seconds
};

window.rejectWithdraw = function (uid, reqId) {
  remove(ref(db, `withdrawals/${uid}/${reqId}`));
};
