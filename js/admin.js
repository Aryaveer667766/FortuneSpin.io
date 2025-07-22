import { db } from "./firebase.js";
import {
  ref,
  onValue,
  set,
  update,
  remove,
  push,
  child,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// DOM Loaded
document.addEventListener("DOMContentLoaded", () => {
  const userList = document.getElementById("user-list");
  const searchInput = document.getElementById("search");
  const fakeUserBtn = document.getElementById("generate-fake-user");

  const renderUID = (uid) => `UID#${uid.slice(-6)}`;

  function loadUsers() {
    onValue(ref(db, "users"), (snapshot) => {
      userList.innerHTML = "";
      const users = snapshot.val();
      if (!users) return;

      Object.entries(users).forEach(([uid, data]) => {
        const visibleUID = renderUID(uid);
        const isLocked = data.accountLocked === true;
        const div = document.createElement("div");
        div.className = "user-card";
        div.innerHTML = `
          <p><strong>${data.name || "No Name"}</strong> (${visibleUID})</p>
          <p>📞 ${data.phone || "N/A"}</p>
          <p>💰 Balance: ₹${data.balance || 0}</p>
          <p>🎯 Spins: ${data.spins || 0}</p>
          <p>Status: ${isLocked ? "🔒 Locked" : "🔓 Active"}</p>
          <button onclick="editBalance('${uid}')">Edit Balance</button>
          <button onclick="addSpins('${uid}')">Add Spins</button>
          <button onclick="toggleLock('${uid}', ${isLocked})">
            ${isLocked ? "Unlock" : "Lock"}
          </button>
          <button onclick="deleteUser('${uid}')">❌ Delete</button>
        `;
        userList.appendChild(div);
      });
    });
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll(".user-card");
    cards.forEach((card) => {
      card.style.display = card.textContent.toLowerCase().includes(query)
        ? "block"
        : "none";
    });
  });

  window.editBalance = (uid) => {
    const newBalance = prompt("Enter new balance:");
    if (newBalance !== null) {
      update(ref(db, "users/" + uid), {
        balance: parseInt(newBalance),
      });
    }
  };

  window.addSpins = (uid) => {
    const moreSpins = prompt("Add how many spins?");
    if (moreSpins !== null) {
      const spinRef = ref(db, "users/" + uid + "/spins");
      onValue(spinRef, (snap) => {
        const current = snap.val() || 0;
        set(spinRef, current + parseInt(moreSpins));
      }, { onlyOnce: true });
    }
  };

  window.toggleLock = (uid, isCurrentlyLocked) => {
    update(ref(db, "users/" + uid), {
      accountLocked: !isCurrentlyLocked,
    });
  };

  window.deleteUser = (uid) => {
    if (confirm("Are you sure you want to delete this user?")) {
      remove(ref(db, "users/" + uid));
    }
  };

  fakeUserBtn.addEventListener("click", () => {
    const newUID = push(child(ref(db), "users")).key;
    const fakeData = {
      name: "FakeUser" + Math.floor(Math.random() * 1000),
      phone: "+91" + Math.floor(1000000000 + Math.random() * 8999999999),
      balance: Math.floor(Math.random() * 1000),
      spins: Math.floor(Math.random() * 10),
      fake: true,
    };
    set(ref(db, "users/" + newUID), fakeData);
  });

  loadUsers();
});
