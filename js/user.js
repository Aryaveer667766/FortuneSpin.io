import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  ref,
  get,
  set,
  update,
  onValue,
  push
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

// Elements
const spinBtn = document.getElementById('spinBtn');
const logoutBtn = document.getElementById('logoutBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const confettiCanvas = document.getElementById('confettiCanvas');
const notificationDiv = document.getElementById('notification');
const balanceDisplay = document.getElementById('balance');
const upiInput = document.getElementById('upiInput');
const amountInput = document.getElementById('amountInput');
const ticketForm = document.getElementById('ticketForm');

let currentUser, uid, userData;

// ✅ Confetti setup
const confetti = new JSConfetti({ canvas: confettiCanvas });

// ✅ Auth state check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    uid = user.uid;
    currentUser = user;
    await fetchUserData();
    listenForNotifications();
  } else {
    window.location.href = 'login.html';
  }
});

// ✅ Fetch user data
async function fetchUserData() {
  const snapshot = await get(ref(db, 'users/' + uid));
  userData = snapshot.val();
  if (!userData) {
    alert("User data not found!");
    return;
  }
  balanceDisplay.textContent = userData.balance || 0;
}

// ✅ Spin button logic
spinBtn.addEventListener('click', async () => {
  spinBtn.disabled = true;

  // Play spin sound
  const audio = new Audio('assets/spin.mp3');
  audio.play();

  const result = Math.random() < 0.5 ? 10 : 0; // 50% chance to win 10
  setTimeout(async () => {
    if (result > 0) {
      await update(ref(db, 'users/' + uid), {
        balance: (userData.balance || 0) + result
      });
      confetti.addConfetti();
      alert('🎉 You won ₹' + result);
    } else {
      alert('Better luck next time!');
    }
    await fetchUserData();
    spinBtn.disabled = false;
  }, 3000);
});

// ✅ Withdraw logic
withdrawBtn.addEventListener('click', async () => {
  const upi = upiInput.value.trim();
  const amount = parseInt(amountInput.value.trim());

  if (!upi || isNaN(amount) || amount <= 0) {
    alert("Enter valid UPI and amount");
    return;
  }

  if ((userData.balance || 0) < amount) {
    alert("Insufficient balance");
    return;
  }

  // ✅ Check referral count
  const refSnapshot = await get(ref(db, 'referrals/' + uid));
  const referralData = refSnapshot.val();
  const referralCount = referralData ? Object.keys(referralData).length : 0;

  if (referralCount < 3) {
    alert("You need at least 3 referrals to withdraw");
    return;
  }

  const withdrawRef = push(ref(db, 'withdrawals'));
  await set(withdrawRef, {
    uid: uid,
    upi: upi,
    amount: amount,
    status: 'Pending',
    time: Date.now()
  });

  await update(ref(db, 'users/' + uid), {
    balance: (userData.balance || 0) - amount
  });

  alert("Withdrawal request submitted!");
  await fetchUserData();
});

// ✅ Support Ticket Submit
ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = ticketForm.elements['message'].value.trim();
  if (!msg) return alert("Enter a message");

  const ticketRef = push(ref(db, 'supportTickets'));
  await set(ticketRef, {
    uid: uid,
    message: msg,
    status: 'Open',
    time: Date.now()
  });

  alert("Ticket submitted!");
  ticketForm.reset();
});

// ✅ Notifications Listener
function listenForNotifications() {
  const notifRef = ref(db, 'notifications/' + uid);
  onValue(notifRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.message) {
      notificationDiv.textContent = "🔔 " + data.message;
      notificationDiv.classList.add("show");
      setTimeout(() => {
        notificationDiv.classList.remove("show");
        set(ref(db, 'notifications/' + uid), {}); // Clear after display
      }, 5000);
    }
  });
}

// ✅ Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});
