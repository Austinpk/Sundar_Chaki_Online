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
  public: document.getElementById('public-landing-view'),
  auth: document.getElementById('auth-view'),
  pending: document.getElementById('pending-view'),
  app: document.getElementById('app-view'),
  nav: document.getElementById('bottom-nav')
};

const forms = {
  login: document.getElementById('login-form'),
  signup: document.getElementById('signup-form')
};

const tabs = {
  home: document.getElementById('tab-home'),
  reports: document.getElementById('tab-reports'),
  expenses: document.getElementById('tab-expenses')
};

// Clean View Switcher Logic
function switchView(target) {
  views.auth.classList.add('hidden');
  if (target === 'public') {
    views.public.classList.remove('hidden');
    views.app.classList.add('hidden');
    views.nav.classList.add('hidden');
    views.pending.classList.add('hidden');
  } else if (target === 'pending') {
    views.public.classList.add('hidden');
    views.app.classList.add('hidden');
    views.nav.classList.add('hidden');
    views.pending.classList.remove('hidden');
  } else if (target === 'app') {
    views.public.classList.add('hidden');
    views.pending.classList.add('hidden');
    views.app.classList.remove('hidden');
    views.nav.classList.remove('hidden');
  }
}

// Layout Modal Navigation Listeners
document.getElementById('btn-show-auth').addEventListener('click', () => views.auth.classList.remove('hidden'));
document.getElementById('btn-close-auth').addEventListener('click', () => views.auth.classList.add('hidden'));
document.getElementById('btn-goto-login').addEventListener('click', () => toggleAuthTabs(true));
document.getElementById('btn-goto-signup').addEventListener('click', () => toggleAuthTabs(false));

function toggleAuthTabs(showLogin) {
  if(showLogin) {
    forms.login.classList.remove('hidden');
    forms.signup.classList.add('hidden');
    document.getElementById('btn-goto-login').className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-green-700 shadow-sm transition-all';
    document.getElementById('btn-goto-signup').className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 transition-all';
  } else {
    forms.login.classList.add('hidden');
    forms.signup.classList.remove('hidden');
    document.getElementById('btn-goto-login').className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 transition-all';
    document.getElementById('btn-goto-signup').className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-green-700 shadow-sm transition-all';
  }
}

// Workspace Input Sub-Form Alternator
document.getElementById('form-tab-milling').addEventListener('click', (e) => {
  document.getElementById('milling-form-container').classList.remove('hidden');
  document.getElementById('sales-form-container').classList.add('hidden');
  document.getElementById('form-tab-sales').className = 'flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-all';
  e.target.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white transition-all shadow-sm';
});

document.getElementById('form-tab-sales').addEventListener('click', (e) => {
  document.getElementById('sales-form-container').classList.remove('hidden');
  document.getElementById('milling-form-container').classList.add('hidden');
  document.getElementById('form-tab-milling').className = 'flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-all';
  e.target.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white transition-all shadow-sm';
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
    statusText.className = "text-[10px] text-green-600 font-bold mt-1";
  } catch (err) {
    statusText.textContent = "❌ Upload failed: " + err.message;
    statusText.className = "text-[10px] text-red-600 font-bold mt-1";
  }
});

// Authenticated Login Handler
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

// Forgot Password Feature Hook
document.getElementById('btn-forgot-password').addEventListener('click', async () => {
  const emailInput = document.getElementById('login-identity').value.trim();
  if (!emailInput || !emailInput.includes('@')) {
    alert("Please enter your email address in the identity field above first.");
    return;
  }
  try {
    await auth.sendPasswordResetEmail(emailInput);
    alert("Password reset email sent successfully! Please check your inbox.");
  } catch (err) {
    alert(err.message);
  }
});

// Registration Action Submission
forms.signup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const whatsapp = document.getElementById('signup-whatsapp').value.trim();
  const pass = document.getElementById('signup-pass').value;
  const webLinkUrl = document.getElementById('signup-dp').value.trim();

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

// Verification Security Audit Gate
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

// App Clean System Logout Routine
const executeAppLogoutAction = async () => {
  if (!isHardcodedAdmin) await auth.signOut();
  isHardcodedAdmin = false;
  currentUser = null;
  transactions = [];
  uploadedImageUrl = "";
  forms.login.reset();
  forms.signup.reset();
  switchView('public');
};

document.getElementById('btn-app-logout').addEventListener('click', executeAppLogoutAction);
document.getElementById('btn-pending-logout').addEventListener('click', executeAppLogoutAction);

// Live Wheat Grinding Interactive Math Pipeline
const millInputs = {
  wheat: document.getElementById('mill-wheat-weight'),
  pickup: document.getElementById('mill-advance-pickup'),
  rate: document.getElementById('mill-flour-rate'),
  strategy: document.getElementById('mill-fee-strategy')
};

function runLiveMillingCalculations() {
  const wheat = parseFloat(millInputs.wheat.value) || 0;
  const pickup = parseFloat(millInputs.pickup.value) || 0;
  const rate = parseFloat(millInputs.rate.value) || 120;
  const strategy = millInputs.strategy.value;

  const deduction = wheat * 0.10; // 4kg per Mund translates exactly to 10% weight drop
  const cashEquivalent = deduction * rate;

  let balance = 0;
  if(strategy === 'deduct') {
    balance = wheat - deduction - pickup;
  } else {
    balance = wheat - pickup;
  }

  document.getElementById('calc-deduction').textContent = `${deduction.toFixed(2)} KG`;
  document.getElementById('calc-cash-equivalent').textContent = `PKR ${Math.round(cashEquivalent)}`;
  document.getElementById('calc-final-balance').textContent = `${balance.toFixed(2)} KG`;
}

Object.values(millInputs).forEach(inp => inp.addEventListener('input', runLiveMillingCalculations));
millInputs.strategy.addEventListener('change', runLiveMillingCalculations);

// DATA TRANSMISSION PIPELINES (SAVE ENTRIES TO SHEETS ENGINE)
document.getElementById('btn-submit-milling').addEventListener('click', async () => {
  const name = document.getElementById('mill-cust-name').value.trim();
  const phone = document.getElementById('mill-cust-phone').value.trim();
  const wheat = parseFloat(millInputs.wheat.value) || 0;
  const pickup = parseFloat(millInputs.pickup.value) || 0;
  const rate = parseFloat(millInputs.rate.value) || 120;
  const strategy = millInputs.strategy.value;

  if (!name || wheat <= 0) return alert("Please fill out customer name and wheat weights.");

  const deduction = wheat * 0.10;
  const cashVal = strategy === 'cash' ? (deduction * rate) : 0;
  const finalFlour = strategy === 'deduct' ? (wheat - deduction - pickup) : (wheat - pickup);

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'addTransaction',
        payload: { uid: currentUser.uid, type: 'milling', name, phone, wheat, pickup, strategy, cash: cashVal, flour: finalFlour, rate }
      })
    });
    const status = await res.json();
    if (status.success) {
      alert("Milling entry saved successfully!");
      document.getElementById('mill-cust-name').value = '';
      document.getElementById('mill-cust-phone').value = '';
      millInputs.wheat.value = '';
      millInputs.pickup.value = '0';
      await syncDataPipeline();
    }
  } catch (err) {
    alert(`Sync Fault: ${err.message}`);
  }
});

document.getElementById('btn-submit-sale').addEventListener('click', async () => {
  const name = document.getElementById('sale-cust-name').value.trim();
  const qty = parseFloat(document.getElementById('sale-flour-qty').value) || 0;
  const rate = parseFloat(document.getElementById('sale-flour-rate').value) || 120;
  const phone = document.getElementById('sale-cust-phone').value.trim();

  if (qty <= 0) return alert("Please complete data parameters.");

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'addTransaction',
        payload: { uid: currentUser.uid, type: 'sale', name: name || 'Cash Customer', flour: qty, rate, cash: (qty * rate), phone }
      })
    });
    const status = await res.json();
    if (status.success) {
      alert("Flour cash sale recorded!");
      document.getElementById('sale-cust-name').value = '';
      document.getElementById('sale-flour-qty').value = '';
      document.getElementById('sale-cust-phone').value = '';
      await syncDataPipeline();
    }
  } catch (err) {
    alert(`Sync Fault: ${err.message}`);
  }
});

// Public Customer Tracking Directory Lookups
document.getElementById('btn-public-search').addEventListener('click', () => {
  const phone = document.getElementById('public-search-phone').value.trim();
  const resDiv = document.getElementById('public-search-results');
  if(!phone) return alert("Please input a valid phone number mapping reference.");

  resDiv.classList.remove('hidden');
  
  // Scrapes local copy of synced data for real-time customer transparency matches
  const matches = transactions.filter(t => t.phone === phone);
  if (matches.length === 0) {
    resDiv.innerHTML = `<div class="p-4 bg-orange-50 border rounded-xl text-xs text-orange-800 font-semibold">No transactions active for ${phone} right now.</div>`;
    return;
  }

  resDiv.innerHTML = matches.map(t => `
    <div class="p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1 shadow-sm">
      <div class="flex justify-between font-bold text-gray-800">
        <span>🗓️ ${new Date(t.date).toLocaleDateString()}</span>
        <span class="uppercase text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">${t.type}</span>
      </div>
      <p class="text-gray-600"><b>Customer Account:</b> ${t.name}</p>
      <div class="grid grid-cols-2 gap-1 pt-1 text-gray-500 font-mono text-[11px]">
        <div>Flour Bal: ${t.flour || 0} KG</div>
        <div>Collected Cash: PKR ${t.cash || 0}</div>
      </div>
    </div>
  `).join('');
});

// Sheet Synchronization Engine Channels
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
  const rate = 120;
  const now = new Date();

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    if (activeRange === 'daily') return d.toDateString() === now.toDateString();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  let totalCash = filtered.reduce((sum, t) => sum + (t.cash || 0), 0);
  let totalFlour = filtered.reduce((sum, t) => sum + (t.flour || 0), 0);

  let outputString = `
    <div class="text-sm flex flex-col gap-1 items-center">
      <div>💰 Total Cash: PKR ${totalCash.toLocaleString()}</div>
      <div class="text-[10px] text-slate-400">and</div>
      <div>🌾 Total Booked: ${totalFlour.toFixed(2)} KG Flour</div>
    </div>`;
  
  document.getElementById('profit-output').innerHTML = outputString;
}

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
    card.innerHTML = `
      <div>
        <p class="font-black text-gray-800 capitalize">📦 ${t.type} [${t.name || 'Ledger'}]</p>
        <p class="text-gray-400 text-[10px]">${new Date(t.date).toLocaleDateString()}</p>
      </div>
      <div class="text-right">
        <p class="font-extrabold text-green-600">Rs. ${t.cash || 0}</p>
        <p class="text-[10px] text-gray-400">${t.flour || 0} KG</p>
      </div>`;
    container.appendChild(card);
  });
}

document.getElementById('btn-refresh-logs').addEventListener('click', syncDataPipeline);

// Super-Admin Security Control Operations View Layer
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
  if (!confirm(`Execute ${actionType} action for ${email}?`)) return;

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: actionType, payload: { email } })
    });
    const status = await res.json();
    if (status.success) {
      alert('Action completed successfully!');
      await syncPendingAdminUsersList();
    } else {
      alert('Action error: ' + (status.error || 'Execution rejected.'));
    }
  } catch (err) {
    alert(`Gateway Connection Failure: ${err.message}`);
  }
};

// Bottom Main Navigation Routing Interface Click Setup
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

// Initialization Handler
window.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    if (user && !isHardcodedAdmin) {
      currentUser = user;
      await executeSecurityStatusAudit();
    } else if (!isHardcodedAdmin) {
      switchView('public');
    }
  });
});
