import { getDatabase, ref, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { database } from './firebase.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  loadWithdrawals();
  loadSupportTickets();
  loadWinRate();
});

// Load Users
function loadUsers() {
  const usersRef = ref(database, 'users');
  onValue(usersRef, (snapshot) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const uid = childSnapshot.key;
      const data = childSnapshot.val();
      const card = document.createElement('div');
      card.className = 'col';
      card.innerHTML = `
        <div class="card p-3">
          <h5>UID: ${uid}</h5>
          <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
          <p><strong>Balance:</strong> ₹${data.balance || 0}</p>
          <input class="form-control mb-2" type="number" placeholder="New Balance" id="bal-${uid}">
          <button class="btn btn-sm btn-primary" onclick="updateBalance('${uid}')">Update Balance</button>
          <button class="btn btn-sm btn-warning" onclick="addSpin('${uid}')">+1 Spin</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${uid}')">Delete User</button>
        </div>
      `;
      userList.appendChild(card);
    });
  });
}

window.updateBalance = function(uid) {
  const newBal = parseInt(document.getElementById(`bal-${uid}`).value);
  if (!isNaN(newBal)) {
    update(ref(database, `users/${uid}`), { balance: newBal });
    alert('Balance updated!');
  }
};

window.addSpin = function(uid) {
  const userRef = ref(database, `users/${uid}/spins`);
  onValue(userRef, (snapshot) => {
    const current = snapshot.val() || 0;
    update(ref(database, `users/${uid}`), { spins: current + 1 });
    alert('Spin added!');
  }, { onlyOnce: true });
};

window.deleteUser = function(uid) {
  if (confirm(`Are you sure you want to delete user ${uid}?`)) {
    remove(ref(database, `users/${uid}`));
    remove(ref(database, `referrals/${uid}`));
    alert('User deleted.');
  }
};

// Load Withdrawals
function loadWithdrawals() {
  const withdrawRef = ref(database, 'withdrawals');
  onValue(withdrawRef, (snapshot) => {
    const withdrawalList = document.getElementById('withdrawal-list');
    withdrawalList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const wid = childSnapshot.key;
      const data = childSnapshot.val();
      const card = document.createElement('div');
      card.className = 'col';
      card.innerHTML = `
        <div class="card p-3">
          <h5>UID: ${data.uid}</h5>
          <p><strong>Amount:</strong> ₹${data.amount}</p>
          <p><strong>Method:</strong> ${data.method}</p>
          <p><strong>Mobile:</strong> ${data.mobile}</p>
          <p><strong>UPI/Account:</strong> ${data.upiOrAccount}</p>
          ${data.ifsc ? `<p><strong>IFSC:</strong> ${data.ifsc}</p>` : ''}
          <button class="btn btn-success btn-sm" onclick="approveWithdrawal('${wid}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectWithdrawal('${wid}', ${data.amount}, '${data.uid}')">Reject</button>
        </div>
      `;
      withdrawalList.appendChild(card);
    });
  });
}

window.approveWithdrawal = function(wid) {
  remove(ref(database, `withdrawals/${wid}`));
  alert("✅ Withdrawal approved and removed from queue.");
};

window.rejectWithdrawal = function(wid, amount, uid) {
  // refund amount
  const userRef = ref(database, `users/${uid}/balance`);
  onValue(userRef, (snapshot) => {
    const currBal = snapshot.val() || 0;
    update(ref(database, `users/${uid}`), { balance: currBal + amount });
    remove(ref(database, `withdrawals/${wid}`));
    alert("❌ Withdrawal rejected and amount refunded.");
  }, { onlyOnce: true });
};

// Load Support Tickets
function loadSupportTickets() {
  const supportRef = ref(database, 'supportTickets');
  onValue(supportRef, (snapshot) => {
    const supportList = document.getElementById('support-list');
    supportList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const tid = childSnapshot.key;
      const data = childSnapshot.val();
      const card = document.createElement('div');
      card.className = 'col';
      card.innerHTML = `
        <div class="card p-3">
          <h5>UID: ${data.uid}</h5>
          <p><strong>Issue:</strong> ${data.issue}</p>
          <button class="btn btn-danger btn-sm" onclick="deleteTicket('${tid}')">Delete Ticket</button>
        </div>
      `;
      supportList.appendChild(card);
    });
  });
}

window.deleteTicket = function(tid) {
  remove(ref(database, `supportTickets/${tid}`));
  alert('Ticket deleted.');
};

// Load and Update Spin Win Rate
function loadWinRate() {
  const winRef = ref(database, 'config/winRate');
  onValue(winRef, (snapshot) => {
    document.getElementById('winRate').value = snapshot.val() || 50;
  });
}

window.updateWinRate = function() {
  const rate = parseInt(document.getElementById('winRate').value);
  if (!isNaN(rate) && rate >= 0 && rate <= 100) {
    set(ref(database, 'config/winRate'), rate);
    alert('Win rate updated!');
  } else {
    alert('Enter a valid win rate between 0 and 100.');
  }
};
