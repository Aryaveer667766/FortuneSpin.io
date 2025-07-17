import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  push
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCHh9XG4eK2IDYgaUzja8Lk6obU6zxIIwc",
  authDomain: "fortunespin-57b4f.firebaseapp.com",
  databaseURL: "https://fortunespin-57b4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fortunespin-57b4f",
  storageBucket: "fortunespin-57b4f.appspot.com",
  messagingSenderId: "204339176543",
  appId: "1:204339176543:web:b417b7a2574a0e44fbe7ea",
  measurementId: "G-VT1N70H3HK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const spinSound = new Audio("assets/spin.mp3");

// Confetti canvas
const confettiCanvas = document.getElementById("confetti-canvas");
const confetti = confettiCanvas ? confettiCanvas.getContext("2d") : null;

function showConfetti() {
  if (confettiCanvas) {
    confettiCanvas.style.display = "block";
    setTimeout(() => {
      confettiCanvas.style.display = "none";
    }, 3000);
  }
}

// Elements
const balanceDisplay = document.getElementById("balance");
const referralLink = document.getElementById("referral-link");
const referralCount = document.getElementById("referral-count");
const withdrawForm = document.getElementById("withdraw-form");
const ticketForm = document.getElementById("ticket-form");
const notificationBox = document.getElementById("notification-box");
const spinButton = document.getElementById("spin-btn");
const wheel = document.getElementById("wheel");
const logoutBtn = document.getElementById("logout");

let currentUID = null;

// Spinner logic
const prizes = [10, 20, 30, 50, 100, 0, 5, 0]; // customize as needed

function spinWheel(callback) {
  const degree = Math.floor(Math.random() * 360 + 720); // spin multiple times
  const prizeIndex = Math.floor(Math.random() * prizes.length);
  const won = prizes[prizeIndex];

  wheel.style.transition = "transform 4s ease-out";
  wheel.style.transform = `rotate(${degree}deg)`;

  spinSound.play();
  setTimeout(() => {
    callback(won);
    showConfetti();
  }, 4000);
}

// Handle balance update
function updateBalance(uid, amount) {
  const userRef = ref(db, `users/${uid}`);
  get(userRef).then((snapshot) => {
    if (snapshot.exists()) {
      const current = snapshot.val().balance || 0;
      update(userRef, { balance: current + amount });
    }
  });
}

// Load data on auth
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    const userRef = ref(db, `users/${currentUID}`);
    get(userRef).then((snapshot) => {
      if (!snapshot.exists()) {
        set(userRef, {
          balance: 0,
          referrals: [],
          notifications: []
        });
      } else {
        const data = snapshot.val();
        if (balanceDisplay) balanceDisplay.innerText = data.balance ?? 0;
        if (referralLink) referralLink.innerText = `${location.origin}?ref=${currentUID}`;
        if (referralCount) referralCount.innerText = (data.referrals ?? []).length;
      }
    });

    // Real-time balance update
    onValue(ref(db, `users/${currentUID}/balance`), (snap) => {
      if (balanceDisplay) balanceDisplay.innerText = snap.val();
    });

    // Real-time notifications
    onValue(ref(db, `users/${currentUID}/notifications`), (snap) => {
      const notes = snap.val();
      if (notes && notificationBox) {
        notificationBox.innerHTML = Object.values(notes).map(n => `<p>${n}</p>`).join("");
      }
    });
  } else {
    window.location.href = "index.html";
  }
});

// SPIN EVENT
spinButton?.addEventListener("click", () => {
  spinWheel((reward) => {
    updateBalance(currentUID, reward);
    alert(`You won ₹${reward}!`);
  });
});

// Withdraw
withdrawForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(withdrawForm);
  const upi = formData.get("upi");
  const amount = Number(formData.get("amount"));

  const userRef = ref(db, `users/${currentUID}`);
  get(userRef).then((snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const referrals = data.referrals ?? [];
      const balance = data.balance ?? 0;

      if (referrals.length < 3) {
        alert("You need at least 3 referrals to withdraw.");
        return;
      }

      if (balance < amount) {
        alert("Insufficient balance.");
        return;
      }

      const withdrawRef = ref(db, `withdrawals/${currentUID}`);
      const newRef = push(withdrawRef);
      set(newRef, {
        upi,
        amount,
        status: "Pending",
        timestamp: Date.now()
      });

      update(userRef, { balance: balance - amount });

      alert("Withdrawal requested successfully!");
      withdrawForm.reset();
    }
  });
});

// Support ticket
ticketForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(ticketForm);
  const message = formData.get("message");

  const ticketRef = ref(db, `tickets/${currentUID}`);
  const newRef = push(ticketRef);
  set(newRef, {
    message,
    timestamp: Date.now(),
    status: "Pending"
  });

  alert("Support ticket submitted.");
  ticketForm.reset();
});

// Logout
logoutBtn?.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});
