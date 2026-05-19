const firebaseConfig = {
  apiKey: "AIzaSyCM8xeCYILdA5kUAE6_kZuEkyN_1L3YGII",
  authDomain: "sundarchaki-1a6f6.firebaseapp.com",
  projectId: "sundarchaki-1a6f6",
  storageBucket: "sundarchaki-1a6f6.firebasestorage.app",
  messagingSenderId: "858438670800",
  appId: "1:858438670800:web:72d7cd9c3359866f6441d5",
  measurementId: "G-W777E1W47S"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const storage = firebase.storage(); // Active Cloud Storage Module

let currentUser = null;
let currentProfileRole = 'user';
let isHardcodedAdmin = false;
let globalAdminHardcodedPassword = "N@veed_admin123";
let transactions = [];
let activeMode = 'hybrid';
let activeRange = 'daily';
let uploadedImageUrl = "";

const views = {
  auth: document.getElementById('auth-view'),
  pending: document.getElementById('pending-view'),
  app: document.getElementById('app-view'),
  nav: document.getElementById('bottom-nav')
};

const forms = {
  login: document.getElementById('login-form'),
  signup: document.getElementById('signup-form'),
  profileUpdate: document.getElementById('profile-update-form')
};

const tabs = {
  home: document.getElementById('tab-home'),
  reports: document.getElementById('tab-reports'),
  expenses: document.getElementById('tab-expenses')
};

function switchView(target) {
  Object.keys(views).forEach(key => views[key].classList.add('hidden'));
  if (target === 'app') {
    views.app.classList.remove('hidden');
    views.nav.classList.remove('hidden');
  } else {
    views[target].classList.remove('hidden');
  }
}

document.getElementById('btn-goto-login').addEventListener('click', (e) => toggleAuthTab(e.target, forms.login, forms.signup));
document.getElementById('btn-goto-signup').addEventListener('click', (e) => toggleAuthTab(e.target, forms.signup, forms.login));

function toggleAuthTab(activeBtn, formToShow, formToHide) {
  document.getElementById('btn-goto-login').className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all';
  document.getElementById('btn-goto-signup').className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all';
  activeBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-green-700 shadow-sm transition-all';
  formToShow.classList.remove('hidden');
  formToHide.classList.add('hidden');
}

document.getElementById('entry-type').addEventListener('change', (e) => {
  if (e.target.value === 'sale') {
    document.getElementById('form-sale-group').classList.remove('hidden');
    document.getElementById('form-expense-group').classList.add('hidden');
  } else {
    document.getElementById('form-sale-group').classList.add('hidden');
    document.getElementById('form-expense-group').classList.remove('hidden');
  }
});

// LISTEN FOR DEVICE HARDWARE FILE UPLOADS
document.getElementById('signup-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const statusText = document.getElementById('upload-status-text');
  statusText.classList.remove('hidden');
  statusText.textContent = "Uploading asset to storage...";

  try {
    const storageRef = storage.ref('avatars/' + Date.now() + '_' + file.name);
    const uploadTask = await storageRef.put(file);
    uploadedImageUrl = await uploadTask.ref.getDownloadURL();
    
    statusText.textContent = "✅ Image uploaded and verified successfully!";
    statusText.className = "text-[11px] text-green-600 font-bold mt-1";
  } catch (err) {
    statusText.textContent = "❌ Upload failed: " + err.message;
    statusText.className = "text-[11px] text-red-600 font-bold mt-1";
  }
});

forms.login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identity = document.getElementById('login-identity').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (identity === "Admin") {
    let matched = false;
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        body: JSON.stringify({ action: 'getAdminPassword', payload: { fallback: globalAdminHardcodedPassword } })
      });
      const data = await res.json();
      if (data.password && pass === data.password) matched = true;
    } catch (err) {
      if (pass === globalAdminHardcodedPassword) matched = true;
    }

    if (matched) {
      isHardcodedAdmin = true;
      currentProfileRole = 'admin';
      currentUser = { email: 'admin@system.local', uid: 'SYSTEM_SUPER_ADMIN_OVERRIDE' };
      
      document.getElementById('user-avatar-top').src = "https://cdn-icons-png.flaticon.com/512/2206/2206368.png";
      document.getElementById('user-display-role').textContent = "🛡️ Super Admin";
      document.getElementById('super-admin-panel').classList.remove('hidden');
      
      switchView('app');
      await syncDataPipeline();
      return;
    } else {
      alert("Invalid admin password.");
      return;
    }
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(identity, pass);
    currentUser = userCredential.user;
    await executeSecurityStatusAudit();
  } catch (err) {
    alert(`Authentication Fault: ${err.message}`);
  }
});

forms.signup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const whatsapp = document.getElementById('signup-whatsapp').value.trim();
  const pass = document.getElementById('signup-pass').value;
  const webLinkUrl = document.getElementById('signup-dp').value.trim();

  // Pick the file upload string URL first, fall back to pasted web link string value
  const finalProfileImage = uploadedImageUrl || webLinkUrl || "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = userCredential.user.uid;

    const response = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'addUser',
        payload: { name, email, whatsapp, dp: finalProfileImage, uid }
      })
    });
    
    const output = await response.json();
    if (output.success) {
      alert("Account requested successfully!");
      switchView('pending');
    }
  } catch (err) {
    alert(`Registration Error: ${err.message}`);
  }
});

async function executeSecurityStatusAudit() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'checkUser', payload: { email: currentUser.email } })
    });
    const data = await res.json();
    
    if (!data.status || data.status === 'pending') {
      switchView('pending');
      return;
    }

    currentProfileRole = data.role || 'user';
    document.getElementById('user-avatar-top').src = data.dp || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    document.getElementById('user-display-role').textContent = currentProfileRole === 'admin' ? "🛡️ System Admin" : "Staff Account";

    if (currentProfileRole === 'admin') {
      document.getElementById('super-admin-panel').classList.remove('hidden');
    } else {
      document.getElementById('super-admin-panel').classList.add('hidden');
    }

    switchView('app');
    await syncDataPipeline();
  } catch (err) {
    alert(`Security Verification Fault: ${err.message}`);
  }
}

document.getElementById('btn-app-logout').addEventListener('click', async () => {
  if (!isHardcodedAdmin) await auth.signOut();
  isHardcodedAdmin = false;
  currentUser = null;
  transactions = [];
  uploadedImageUrl = "";
  forms.login.reset();
  forms.signup.reset();
  switchView('auth');
});

forms.profileUpdate.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById('profile-new-pass').value;
  if (!newPassword || newPassword.length < 6) {
    alert("Password must be at least 6 characters long.");
    return;
  }

  try {
    if (isHardcodedAdmin) {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        body: JSON.stringify({ action: 'updateAdminPassword', payload: { newPassword } })
      });
      const data = await res.json();
      if (data.success) {
        alert("Admin system master password updated successfully.");
        forms.profileUpdate.reset();
      }
    } else {
      await auth.currentUser.updatePassword(newPassword);
      alert("Password updated across frameworks successfully.");
      forms.profileUpdate.reset();
    }
  } catch (err) {
    alert(`Update Error: ${err.message}`);
  }
});

document.getElementById('submit-entry').addEventListener('click', async () => {
  const type = document.getElementById('entry-type').value;
  const rate = parseFloat(document.getElementById('entry-rate').value) || 0;
  
  let payloadData = {
    uid: currentUser.uid,
    type: type,
    rate: rate,
    cash: 0,
    flour: 0,
    expName: '',
    expAmt: 0
  };

  if (type === 'sale') {
    payloadData.cash = parseFloat(document.getElementById('entry-cash').value) || 0;
    payloadData.flour = parseFloat(document.getElementById('entry-flour').value) || 0;
    if (payloadData.cash <= 0 && payloadData.flour <= 0) {
      alert("Please check numeric layout entries.");
      return;
    }
  } else {
    payloadData.expName = document.getElementById('entry-name').value.trim();
    payloadData.expAmt = parseFloat(document.getElementById('entry-amount').value) || 0;
    if (!payloadData.expName || payloadData.expAmt <= 0) {
      alert("Expense entries are invalid.");
      return;
    }
  }

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'addTransaction', payload: payloadData })
    });
    const status = await res.json();
    if (status.success) {
      alert("Transaction saved.");
      document.getElementById('entry-cash').value = '';
      document.getElementById('entry-flour').value = '';
      document.getElementById('entry-name').value = '';
      document.getElementById('entry-amount').value = '';
      await syncDataPipeline();
    }
  } catch (err) {
    alert(`Sync Fault: ${err.message}`);
  }
});

async function syncDataPipeline() {
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'getTransactions' })
    });
    const out = await res.json();
    transactions = out.data || [];
    
    executeEngineCalculations();
    renderLogsUI();

    if (currentProfileRole === 'admin') {
      await syncPendingAdminUsersList();
    }
  } catch (err) {
    console.error("Sync Error: ", err);
  }
}

function executeEngineCalculations() {
  const rate = parseFloat(document.getElementById('entry-rate').value) || 130;
  const now = new Date();

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    if (activeRange === 'daily') return d.toDateString() === now.toDateString();
    if (activeRange === 'weekly') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      return d >= start;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  let totalCash = filtered.reduce((sum, t) => sum + (t.cash || 0), 0);
  let totalExp = filtered.reduce((sum, t) => sum + (t.expAmt || 0), 0);
  let totalFlour = filtered.reduce((sum, t) => sum + (t.flour || 0), 0);

  const netCashProfit = totalCash - totalExp;
  const netFlourProfit = (totalCash / rate) - (totalExp / rate);

  let outputString = '';
  if (activeMode === 'cash') {
    outputString = `<span class="text-emerald-500">PKR ${netCashProfit.toLocaleString()}</span>`;
  } else if (activeMode === 'flour') {
    outputString = `<span class="text-amber-500">${netFlourProfit.toFixed(2)} KG</span>`;
  } else {
    outputString = `<div class="text-sm flex flex-col gap-1 items-center">
                      <div>💰 PKR ${netCashProfit.toLocaleString()}</div>
                      <div class="text-[10px] text-slate-400">and</div>
                      <div>🌾 ${netFlourProfit.toFixed(2)} KG Flour</div>
                    </div>`;
  }
  document.getElementById('profit-output').innerHTML = outputString;
}

document.getElementById('engine-mode-select').addEventListener('change', (e) => {
  activeMode = e.target.value;
  executeEngineCalculations();
});

document.querySelectorAll('.range-toggle-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.range-toggle-btn').forEach(b => {
      b.className = 'range-toggle-btn text-xs font-bold py-1.5 rounded-lg transition-all text-slate-400';
    });
    e.target.className = 'range-toggle-btn text-xs font-bold py-1.5 rounded-lg transition-all bg-white text-slate-900 shadow';
    activeRange = e.target.getAttribute('data-range');
    executeEngineCalculations();
  });
});

function renderLogsUI() {
  const container = document.getElementById('records-list-container');
  container.innerHTML = '';
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No records logged yet.</p>';
    return;
  }

  transactions.forEach(t => {
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center text-xs";
    if (t.type === 'sale') {
      card.innerHTML = `<div><p class="font-black text-gray-800">📦 Sale [ID: ${t.id}]</p><p class="text-gray-400 text-[10px]">${new Date(t.date).toLocaleDateString()}</p></div>
                        <div class="text-right"><p class="font-extrabold text-green-600">+Rs. ${t.cash}</p><p class="text-[10px] text-gray-400">${t.flour} KG</p></div>`;
    } else {
      card.innerHTML = `<div><p class="font-black text-red-700">🛑 Expense: ${t.expName}</p><p class="text-gray-400 text-[10px]">${new Date(t.date).toLocaleDateString()}</p></div>
                        <div class="text-right"><p class="font-extrabold text-red-600">-Rs. ${t.expAmt}</p></div>`;
    }
    container.appendChild(card);
  });
}

document.getElementById('btn-refresh-logs').addEventListener('click', syncDataPipeline);

/* ========================================================
   UPDATED: SYSTEM ADMINISTRATION & DUAL CONTROL ACTIONS LAYER
   ======================================================== */
async function syncPendingAdminUsersList() {
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'getPendingUsers' })
    });
    const out = await res.json();
    const container = document.getElementById('pending-users-list');
    if (!container) return;
    container.innerHTML = '';

    const list = out.users || [];
    if (list.length === 0) {
      container.innerHTML = '<p class="text-[11px] text-gray-400 text-center py-2">No pending worker accounts.</p>';
      return;
    }

    // Email address formatting check matching RFC standard rules
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    list.forEach(u => {
      const isEmailValid = emailRegex.test(u.email);
      const row = document.createElement('div');
      row.className = "bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 text-left mb-2";
      
      row.innerHTML = `
        <div class="flex items-start gap-3">
          <img src="${u.dp || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" class="w-10 h-10 rounded-full border object-cover shrink-0">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="font-bold text-gray-800 text-sm truncate">${u.name || 'Staff'}</p>
              ${isEmailValid 
                ? '<span class="px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded-full">✓ Valid Email</span>' 
                : '<span class="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded-full animate-pulse">⚠ Invalid Syntax</span>'
              }
            </div>
            <p class="text-[11px] text-gray-600 font-mono mt-0.5 break-all"><b>Email:</b> ${u.email}</p>
            <p class="text-[11px] text-gray-500"><b>WhatsApp:</b> ${u.whatsapp || 'N/A'}</p>
            <p class="text-[9px] text-gray-400 font-mono truncate"><b>UID:</b> ${u.uid || 'N/A'}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-sm" onclick="processAdminDecision('${u.email}', 'approveUser')">Approve</button>
          <button class="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 rounded-lg text-xs transition-all border border-red-200" onclick="processAdminDecision('${u.email}', 'declineUser')">Decline</button>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error("Failed loading user approvals panel list:", err);
  }
}

window.processAdminDecision = async function(email, actionType) {
  const messagePrompt = actionType === 'approveUser' 
    ? `Authorize account verification for ${email}?` 
    : `Decline and wipe registration log records for ${email}?`;

  if (!confirm(messagePrompt)) return;

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: actionType, payload: { email } })
    });
    const status = await res.json();
    if (status.success) {
      alert(actionType === 'approveUser' ? 'Account activated successfully!' : 'Registration request declined and purged.');
      await syncPendingAdminUsersList();
    } else {
      alert('Action error: ' + (status.error || 'Server rejected context execution parameters.'));
    }
  } catch (err) {
    alert(`Gateway Connection Failure: ${err.message}`);
  }
};

document.getElementById('edit-submit').addEventListener('click', async () => {
  const id = document.getElementById('edit-id').value.trim();
  const val = parseFloat(document.getElementById('edit-val').value) || 0;
  if (!id) return alert("Record ID required.");

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateTransaction', payload: { id, val } })
    });
    const status = await res.json();
    if (status.success) {
      alert("Ledger cell overridden.");
      document.getElementById('edit-id').value = '';
      document.getElementById('edit-val').value = '';
      await syncDataPipeline();
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
});

// FIXED NAVIGATION TAB REGISTRATION ROUTING INTERFACE
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetTab = e.currentTarget.getAttribute('data-tab');
    
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('text-green-600');
      b.classList.add('text-gray-400');
    });
    e.currentTarget.classList.remove('text-gray-400');
    e.currentTarget.classList.add('text-green-600');

    Object.keys(tabs).forEach(k => tabs[k].classList.add('hidden'));
    tabs[targetTab].classList.remove('hidden');
  });
});

window.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    if (user && !isHardcodedAdmin) {
      currentUser = user;
      await executeSecurityStatusAudit();
    } else if (!isHardcodedAdmin) {
      switchView('auth');
    }
  });
});
