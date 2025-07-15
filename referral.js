import { auth } from './firebase.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (user) {
    const uid = user.uid;
    const referralLink = `${location.origin}/login.html?ref=${uid}`;

    // Create a box in index.html to show it
    const el = document.createElement("div");
    el.innerHTML = `
      <section class="admin-section">
        <h2>🌐 Your Referral Link</h2>
        <input id="ref-link" value="${referralLink}" readonly />
        <button onclick="copyReferral()">Copy Link</button>
      </section>
    `;
    document.body.appendChild(el);
  }
});

// 📋 Copy Link Function
window.copyReferral = function () {
  const refInput = document.getElementById("ref-link");
  refInput.select();
  document.execCommand("copy");
  alert("Referral link copied!");
};
