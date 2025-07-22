import { db } from "./firebase.js";
import {
  ref,
  onValue,
  remove,
  update,
  set,
  push,
  get
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const userList = document.getElementById("userList");
const searchInput = document.getElementById("searchInput");

const formatUID = (uid) => `UID#${uid.slice(-6)}`;

function renderUser(uid, data) {
  const card = document.createElement("div");
  card.className = "user-card";

  const formattedUID = formatUID(uid);
  const isLocked = data.locked ? true : false;

  card.innerHTML = `
    <strong>${data.name || "Unnamed User"}</strong><br>
    <span>${formattedUID}</span><br>
    Balance: ₹${data.balance || 0}<br>
    Spins: ${data.spins || 0}<br>
    <button onclick="deleteUser('${uid}')">🗑️ Delete</button>
    <button onclick="addSpins('${uid}', 5)">➕ Add 5 Spins</button>
    <button onclick="toggleLock('${uid}', ${isLocked})">${isLocked ? "🔓 Unlock" : "🔒 Lock"}</button>
  `;
  return card;
}

function loadUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    const users = snapshot.val() || {};
    userList.innerHTML = "";

    Object.keys(users).forEach((uid) => {
      const data = users[uid];
      const card = renderUser(uid, data);
      userList.appendChild(card);
    });
  });
}

function deleteUser(uid) {
  if (confirm("Are you sure you want to delete this user?")) {
    remove(ref(db, "users/" + uid));
  }
}

function addSpins(uid, amount) {
  const userRef = ref(db, "users/" + uid);
  get(userRef).then((snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const currentSpins = data.spins || 0;
      update(userRef, { spins: currentSpins + amount });
    }
  });
}

function toggleLock(uid, isLocked) {
  const userRef = ref(db, "users/" + uid);
  update(userRef, { locked: !isLocked });
}

// 🔍 Search Function
searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const cards = document.querySelectorAll(".user-card");

  cards.forEach((card) => {
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(term) ? "block" : "none";
  });
});

// 🎭 Fake User Generator
function generateFakeUser() {
  const uid = `FAKE${Date.now()}`;
  set(ref(db, "users/" + uid), {
    name: "FakeUser_" + Math.floor(Math.random() * 1000),
    balance: Math.floor(Math.random() * 1000),
    spins: Math.floor(Math.random() * 10),
    locked: false
  });
}

window.deleteUser = deleteUser;
window.addSpins = addSpins;
window.toggleLock = toggleLock;
window.generateFakeUser = generateFakeUser;

loadUsers();
