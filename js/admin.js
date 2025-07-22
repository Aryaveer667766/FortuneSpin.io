import { db } from "./firebase.js";
import {
  ref,
  onValue,
  update,
  remove,
  push,
  set,
  get,
  child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Utility: Format UID for display
const formatUID = (uid) => `UID#${uid.slice(-6)}`;

// DOM elements
const userList = document.getElementById("user-list");
const searchInput = document.getElementById("search-input");
const fakeUserBtn = document.getElementById("generate-fake-user");

function renderUser(uid, userData) {
  const container = document.createElement("div");
  container.className = "user-card border p-3 rounded bg-gray-800 text-white mb-2";

  const name = userData.name || "Unnamed";
  const phone = userData.phone || "N/A";
  const balance = userData.balance || 0;
  const spins = userData.spins || 0;
  const isLocked = userData.locked || false;

  container.innerHTML = `
    <div><strong>${name}</strong> (${phone})</div>
    <div>Balance: ₹${balance} | Spins: ${spins}</div>
    <div>UID: ${formatUID(uid)}</div>
    <div class="mt-2 space-x-2">
      <button class="btn-lock bg-yellow-600 px-2 py-1 rounded" data-uid="${uid}">
        ${isLocked ? "Unlock" : "Lock"}
      </button>
      <button class="btn-add-spin bg-green-600 px-2 py-1 rounded" data-uid="${uid}">+Spin</button>
      <button class="btn-delete bg-red-600 px-2 py-1 rounded" data-uid="${uid}">Delete</button>
    </div>
  `;

  userList.appendChild(container);
}

function loadUsers() {
  onValue(ref(db, "users"), (snapshot) => {
    userList.innerHTML = "";
    const users = snapshot.val();
    if (!users) return;

    const query = searchInput.value.toLowerCase();

    Object.entries(users).forEach(([uid, userData]) => {
      const name = (userData.name || "").toLowerCase();
      const match = name.includes(query) || uid.includes(query) || formatUID(uid).toLowerCase().includes(query);
      if (match) renderUser(uid, userData);
    });
  });
}

// 🔁 Realtime listener
searchInput.addEventListener("input", loadUsers);

// 🔐 Lock/Unlock / 💰 Add spin / ❌ Delete
userList.addEventListener("click", async (e) => {
  const uid = e.target.getAttribute("data-uid");
  if (!uid) return;

  if (e.target.classList.contains("btn-lock")) {
    const userRef = ref(db, "users/" + uid);
    const snap = await get(userRef);
    const isLocked = snap.val()?.locked || false;
    await update(userRef, { locked: !isLocked });
  }

  if (e.target.classList.contains("btn-add-spin")) {
    const spinsRef = ref(db, "users/" + uid + "/spins");
    const snap = await get(spinsRef);
    const currentSpins = snap.val() || 0;
    await update(ref(db, "users/" + uid), { spins: currentSpins + 1 });
  }

  if (e.target.classList.contains("btn-delete")) {
    if (confirm("Delete this user?")) {
      await remove(ref(db, "users/" + uid));
    }
  }
});

// 🎭 Generate Fake User
fakeUserBtn.addEventListener("click", () => {
  const uid = push(ref(db, "users")).key;
  const fakeName = "User" + Math.floor(Math.random() * 10000);
  const fakePhone = "+91" + Math.floor(1000000000 + Math.random() * 9000000000);
  const newUser = {
    name: fakeName,
    phone: fakePhone,
    balance: Math.floor(Math.random() * 1000),
    spins: Math.floor(Math.random() * 10),
    locked: false,
    uid
  };
  set(ref(db, "users/" + uid), newUser);
});

// 🚀 Init
document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
});
