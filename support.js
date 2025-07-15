import { auth, db } from './firebase.js';
import {
  ref, push, onValue, update
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Create ticket UI (for user)
onAuthStateChanged(auth, user => {
  if (user && document.body) {
    const container = document.createElement("section");
    container.className = "admin-section";
    container.innerHTML = `
      <h2>🛠️ Support</h2>
      <input type="text" id="support-subject" placeholder="Subject" />
      <textarea id="support-message" placeholder="Describe your issue..."></textarea>
      <button onclick="submitTicket()">Submit Ticket</button>
      <div id="support-replies"></div>
    `;
    document.body.appendChild(container);

    // Load replies
    const ticketRef = ref(db, `support/${user.uid}`);
    onValue(ticketRef, snap => {
      const replies = snap.val();
      const replyBox = document.getElementById("support-replies");
      replyBox.innerHTML = "<h4>Replies:</h4>";
      if (replies) {
        Object.entries(replies).forEach(([key, msg]) => {
          replyBox.innerHTML += `<p>🗨️ ${msg}</p>`;
        });
      } else {
        replyBox.innerHTML += "<p>No replies yet.</p>";
      }
    });
  }
});

// Submit ticket
window.submitTicket = function () {
  const subject = document.getElementById("support-subject").value.trim();
  const message = document.getElementById("support-message").value.trim();
  if (!subject || !message) return alert("Please fill both fields");

  const uid = auth.currentUser.uid;
  const supportRef = ref(db, `support/${uid}`);
  const newMsg = `🆕 ${subject}: ${message}`;

  push(supportRef, newMsg).then(() => {
    alert("Support ticket submitted ✅");
    document.getElementById("support-subject").value = "";
    document.getElementById("support-message").value = "";
  });
};
