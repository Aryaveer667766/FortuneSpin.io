import { app, auth, db } from './firebase.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  push
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

const auth = getAuth(app);
const db = getDatabase(app);

// DOM Elements
const spinBtn = document.getElementById('spin-btn');
const resultDisplay = document.getElementById('result');
const balanceDisplay = document.getElementById('balance');
const referralLink = document.getElementById('referral-link');
const referralInput = document.getElementById('referral-input');
const withdrawalForm = document.getElementById('withdrawal-form');
const upiInput = document.getElementById('upi-id');
const amountInput = document.getElementById('amount');
const ticketForm = document.getElementById('ticket-form');
const ticketMessage = document.getElementById('ticket-message');
const notificationBox = document.getElementById('notification-box');

// Confetti Setup
const confettiCanvas = document.getElementById('confetti-canvas');
let confetti;
if (window.confetti && confettiCanvas) {
  confetti = window.confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true
  });
}

// Audio
const spinSound = document.getElementById('spin-sound');
const winSound = document.getElementById('win-sound');
const errorSound = document.getElementById('error-sound');

// SPIN Rewards Options
const rewards = [0, 5, 10, 20, 50];

// User Init
let currentUser;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    const uid = user.uid;
    loadUserData(uid);
    setupNotificationListener(uid);
  } else {
    window.location.href = 'index.html';
  }
});

// Load User Info
function loadUserData(uid) {
  const userRef = ref(db, 'users/' + uid);
  get(userRef).then((snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      balanceDisplay.innerText = data.balance || 0;
      referralLink.innerText = `${window.location.origin}/register.html?ref=${uid}`;
      referralInput.value = data.referredBy || '';
    } else {
      set(userRef, {
        balance: 0,
        referrals: 0,
        referredBy: referralInput.value || '',
        uid: uid
      });
    }
  });
}

// SPIN Button Handler
spinBtn.addEventListener('click', () => {
  if (!currentUser) return;
  const uid = currentUser.uid;

  spinSound.play();

  // Simulate spin
  const reward = rewards[Math.floor(Math.random() * rewards.length)];

  update(ref(db, 'users/' + uid), {
    balance: parseInt(balanceDisplay.innerText) + reward
  }).then(() => {
    balanceDisplay.innerText = parseInt(balanceDisplay.innerText) + reward;
    resultDisplay.innerText = `You won ₹${reward}!`;

    if (reward > 0 && confetti) confetti();
    if (reward > 0 && winSound) winSound.play();
  });
});

// Withdrawal Form
withdrawalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const uid = currentUser.uid;
  const upi = upiInput.value.trim();
  const amount = parseInt(amountInput.value.trim());

  if (!upi || isNaN(amount) || amount < 1) {
    alert("Enter valid UPI and amount.");
    return;
  }

  const userRef = ref(db, 'users/' + uid);
  const snapshot = await get(userRef);
  const data = snapshot.val();

  const referrals = data.referrals || 0;
  const balance = data.balance || 0;

  if (referrals < 3) {
    alert("You need at least 3 referrals to withdraw.");
    errorSound.play();
    return;
  }

  if (amount > balance) {
    alert("Insufficient balance.");
    errorSound.play();
    return;
  }

  const withdrawalRef = ref(db, 'withdrawals/' + uid);
  const newReq = push(withdrawalRef);
  await set(newReq, {
    upi,
    amount,
    status: 'Pending',
    timestamp: Date.now()
  });

  await update(userRef, {
    balance: balance - amount
  });

  balanceDisplay.innerText = balance - amount;
  alert("Withdrawal request submitted.");
});

// Support Ticket
ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const uid = currentUser.uid;
  const message = ticketMessage.value.trim();

  if (!message) return;

  const ticketRef = ref(db, 'supportTickets/' + uid);
  const newTicket = push(ticketRef);
  await set(newTicket, {
    message,
    timestamp: Date.now()
  });

  ticketMessage.value = '';
  alert("Ticket submitted!");
});

// Notification Listener
function setupNotificationListener(uid) {
  const notiRef = ref(db, 'notifications/' + uid);
  onValue(notiRef, (snapshot) => {
    notificationBox.innerHTML = '';
    snapshot.forEach((child) => {
      const data = child.val();
      const div = document.createElement('div');
      div.className = 'notification';
      div.innerText = data.message;
      notificationBox.appendChild(div);
    });
  });
}
