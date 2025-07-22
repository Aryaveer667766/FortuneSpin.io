import { app, auth, db } from './firebase.js';
import {
  ref,
  onValue,
  update,
  remove,
  set,
  get,
  child,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

document.addEventListener('DOMContentLoaded', () => {
  const userList = document.getElementById('user-list');
  const withdrawalList = document.getElementById('withdrawal-list');
  const ticketList = document.getElementById('ticket-list');
  const spinControlForm = document.getElementById('spin-control-form');
  const searchInput = document.getElementById('search-input');

  const usersRef = ref(db, 'users');
  const withdrawalsRef = ref(db, 'withdrawals');
  const ticketsRef = ref(db, 'supportTickets');

  // Real-time User List
  onValue(usersRef, (snapshot) => {
    userList.innerHTML = '';
    snapshot.forEach((childSnap) => {
      const uid = childSnap.key;
      const user = childSnap.val();
      const shortUID = 'UID#' + uid.slice(-6);
      const isLocked = user.locked || false;

      const div = document.createElement('div');
      div.className = 'user-card';
      div.innerHTML = `
        <h4>${user.name || 'Unnamed'} <span class="uid">${shortUID}</span></h4>
        <p>Balance: ₹${user.balance || 0}</p>
        <p>Spins: ${user.spins || 0}</p>
        <p>Status: <strong style="color:${isLocked ? 'red' : 'green'}">${isLocked ? 'Locked' : 'Active'}</strong></p>
        <input type="number" placeholder="New Balance" id="bal-${uid}" />
        <button onclick="updateBalance('${uid}')">Update Balance</button>
        <input type="number" placeholder="Add Spins" id="spin-${uid}" />
        <button onclick="addSpins('${uid}')">Add Spins</button>
        <button onclick="toggleLock('${uid}', ${isLocked})">${isLocked ? 'Unlock' : 'Lock'}</button>
        <button onclick="deleteUser('${uid}')">Delete User</button>
        <button onclick="viewReferralTree('${uid}')">View Referral Tree</button>
      `;
      userList.appendChild(div);
    });
  });

  // Real-time Withdrawals
  onValue(withdrawalsRef, (snapshot) => {
    withdrawalList.innerHTML = '';
    snapshot.forEach((childSnap) => {
      const id = childSnap.key;
      const data = childSnap.val();
      const div = document.createElement('div');
      div.className = 'withdrawal-card';
      div.innerHTML = `
        <h4>${data.name || 'User'} - ₹${data.amount}</h4>
        <p>Method: ${data.method}</p>
        <p>Phone: ${data.phone}</p>
        <p>UPI/Account: ${data.upi || data.account || ''}</p>
        <p>IFSC: ${data.ifsc || '-'}</p>
        <button onclick="approveWithdrawal('${id}')">Approve</button>
        <button onclick="rejectWithdrawal('${id}')">Reject</button>
      `;
      withdrawalList.appendChild(div);
    });
  });

  // Real-time Support Tickets
  onValue(ticketsRef, (snapshot) => {
    ticketList.innerHTML = '';
    snapshot.forEach((childSnap) => {
      const ticket = childSnap.val();
      const div = document.createElement('div');
      div.className = 'ticket-card';
      div.innerHTML = `
        <h4>${ticket.subject}</h4>
        <p>${ticket.message}</p>
        <p><em>From UID: ${childSnap.key}</em></p>
      `;
      ticketList.appendChild(div);
    });
  });

  // Spin Control Form
  if (spinControlForm) {
    spinControlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const winRate = document.getElementById('win-rate').value;
      const loseRate = document.getElementById('lose-rate').value;
      set(ref(db, 'settings/spinControl'), {
        winRate: parseFloat(winRate),
        loseRate: parseFloat(loseRate),
      });
      alert('Spin control updated!');
    });
  }

  // Search
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const users = document.querySelectorAll('.user-card');
    users.forEach((card) => {
      const name = card.querySelector('h4')?.textContent.toLowerCase();
      const uidText = card.querySelector('.uid')?.textContent.toLowerCase();
      if (name.includes(query) || uidText.includes(query)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// Global Functions
window.updateBalance = async (uid) => {
  const input = document.getElementById(`bal-${uid}`);
  const newBal = parseFloat(input.value);
  if (!isNaN(newBal)) {
    await update(ref(db, 'users/' + uid), { balance: newBal });
    alert('Balance updated');
  }
};

window.addSpins = async (uid) => {
  const input = document.getElementById(`spin-${uid}`);
  const spinCount = parseInt(input.value);
  if (!isNaN(spinCount)) {
    const userRef = ref(db, 'users/' + uid);
    const snap = await get(userRef);
    const currentSpins = snap.val().spins || 0;
    await update(userRef, { spins: currentSpins + spinCount });
    alert('Spins added');
  }
};

window.toggleLock = async (uid, currentlyLocked) => {
  await update(ref(db, 'users/' + uid), { locked: !currentlyLocked });
  alert(currentlyLocked ? 'User unlocked' : 'User locked');
};

window.deleteUser = async (uid) => {
  if (confirm('Are you sure you want to delete this user?')) {
    await remove(ref(db, 'users/' + uid));
    alert('User deleted');
  }
};

window.approveWithdrawal = async (id) => {
  await update(ref(db, 'withdrawals/' + id), { status: 'Approved' });
  setTimeout(() => remove(ref(db, 'withdrawals/' + id)), 1000);
  alert('Withdrawal approved');
};

window.rejectWithdrawal = async (id) => {
  await update(ref(db, 'withdrawals/' + id), { status: 'Rejected' });
  setTimeout(() => remove(ref(db, 'withdrawals/' + id)), 1000);
  alert('Withdrawal rejected');
};

window.viewReferralTree = async (uid) => {
  const treeRef = ref(db, `referrals/${uid}`);
  const snap = await get(treeRef);
  if (!snap.exists()) {
    alert('No referrals found');
    return;
  }
  const referred = Object.keys(snap.val());
  alert(`Direct referrals (${referred.length}):\n` + referred.map(id => '• ' + id).join('\n'));
};
