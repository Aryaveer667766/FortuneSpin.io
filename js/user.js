// ✅ Import only from firebase.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { ref, get, set, update, onValue, push } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

// DOM Elements
const spinBtn = document.getElementById('spin-btn');
const resultDisplay = document.getElementById('result');
const balanceDisplay = document.getElementById('user-balance');
const referralLink = document.getElementById('referral-link');
const referralInput = document.getElementById('referral-input');
const upiInput = document.getElementById('upi-id');
const amountInput = document.getElementById('withdraw-amount');
const ticketMessage = document.getElementById('ticket-message');
const notificationBox = document.getElementById('notifications');

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
    document.getElementById('user-uid').textContent = user.uid;
    loadUserData(user.uid);
    setupNotificationListener(user.uid);
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
      referralLink.value = `${window.location.origin}/register.html?ref=${uid}`;
      referralInput.value = data.referredBy || '';
      if (data.spinsAvailable && data.spinsAvailable > 0) {
        document.getElementById('spin-section').style.display = 'block';
      } else {
        document.getElementById('locked-msg').style.display = 'block';
      }
    } else {
      set(userRef, {
        balance: 0,
        referrals: 0,
        referredBy: referralInput.value || '',
        uid: uid,
        spinsAvailable: 0
      });
      document.getElementById('locked-msg').style.display = 'block';
    }
  });
}

// SPIN Button Handler
spinBtn?.addEventListener('click', () => {
  if (!currentUser) return;

  spinSound.play();

  const uid = currentUser.uid;
  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  const userRef = ref(db, 'users/' + uid);

  get(userRef).then((snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    const balance = data.balance || 0;
    const spinsLeft = data.spinsAvailable || 0;

    if (spinsLeft <= 0) {
      alert("No spins left!");
      errorSound.play();
      return;
    }

    update(userRef, {
      balance: balance + reward,
      spinsAvailable: spinsLeft - 1
    }).then(() => {
      balanceDisplay.innerText = balance + reward;
      resultDisplay.innerText = `🎉 You won ₹${reward}!`;
      if (reward > 0 && confetti) confetti();
      if (reward > 0 && winSound) winSound.play();
    });
  });
});

// Withdrawal
function requestWithdrawal() {
  if (!currentUser) return;

  const uid = currentUser.uid;
  const upi = upiInput.value.trim();
  const amount = parseInt(amountInput.value.trim());

  if (!upi || isNaN(amount) || amount < 1) {
    alert("Enter valid UPI and amount.");
    return;
  }

  const userRef = ref(db, 'users/' + uid);
  get(userRef).then(async (snapshot) => {
    const data = snapshot.val();
    const referrals = data.referrals || 0;
    const balance = data.balance || 0;

    if (referrals < 3) {
      alert("Minimum 3 referrals required.");
      errorSound.play();
      return;
    }

    if (amount > balance) {
      alert("Insufficient balance.");
      errorSound.play();
      return;
    }

    const withdrawalRef = push(ref(db, 'withdrawals/' + uid));
    await set(withdrawalRef, {
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
}

// Submit Referral
function submitReferral() {
  if (!currentUser) return;

  const referredBy = referralInput.value.trim();
  const uid = currentUser.uid;

  if (!referredBy || referredBy === uid) {
    alert("Invalid referral.");
    return;
  }

  const userRef = ref(db, 'users/' + uid);
  update(userRef, {
    referredBy
  });

  const referrerRef = ref(db, 'users/' + referredBy);
  get(referrerRef).then((snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const count = data.referrals || 0;
      update(referrerRef, {
        referrals: count + 1
      });
      alert("Referral submitted!");
    }
  });
}

// Support Ticket
function submitTicket() {
  if (!currentUser) return;

  const uid = currentUser.uid;
  const message = ticketMessage.value.trim();
  if (!message) return;

  const ticketRef = push(ref(db, 'supportTickets/' + uid));
  set(ticketRef, {
    message,
    timestamp: Date.now()
  });

  ticketMessage.value = '';
  alert("Ticket submitted!");
}

// Notifications
function setupNotificationListener(uid) {
  const notiRef = ref(db, 'notifications/' + uid);
  onValue(notiRef, (snapshot) => {
    notificationBox.innerHTML = '';
    snapshot.forEach((child) => {
      const msg = child.val();
      const div = document.createElement('div');
      div.className = 'notification';
      div.innerText = msg.message;
      notificationBox.appendChild(div);
    });
  });
}

// Expose to global (for button onclick)
window.requestWithdrawal = requestWithdrawal;
window.submitReferral = submitReferral;
window.submitTicket = submitTicket;
