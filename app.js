// Firebase Configuration Array Mapping
const firebaseConfig = {
  apiKey: "AIzaSyCM8xeCYILdA5kUAE6_kZuEkyN_1L3YGII",
  authDomain: "sundarchaki-1a6f6.firebaseapp.com",
  projectId: "sundarchaki-1a6f6",
  storageBucket: "sundarchaki-1a6f6.firebasestorage.app",
  messagingSenderId: "858438670800",
  appId: "1:858438670800:web:72d7cd9c3359866f6441d5",
  measurementId: "G-W777E1W47S"
};

// Start Global Engines
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Local Memory State Stores
let currentUser = null;
let currentProfileRole = 'user';
let isHardcodedAdmin = false;
let globalAdminHardcodedPassword = "N@veed_admin123";
let transactions = [];
let activeMode = 'hybrid';
let activeRange = 'daily';

// Cache UI Elements
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

// UI Panel Switch Router
function switchView(target) {
  Object.keys(views).forEach(key => views[key].classList.add('hidden'));
  if (target === 'app') {
    views.app.classList.remove('hidden');
    views.nav.classList.remove('hidden');
  } else {
    views[target].classList.remove('hidden');
  }
}

// Toggle Auth Screen Subpanels 
document.getElementById('btn-goto-login').addEventListener('click', (e) => {
  toggleAuthTab(e.target, forms.login, forms.signup);
});
document.getElementById('btn-goto-signup').addEventListener('click', (e) => {
  toggleAuthTab(e.target, forms.signup, forms.login);
});

function toggleAuthTab(activeBtn, formToShow, formToHide) {
  document.getElementById('btn-goto-login').className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all';
  document.getElementById('btn-goto-signup').className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all';
  activeBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-green-700 shadow-sm transition-all';
  formToShow.classList.remove('hidden');
  formToHide.classList.add('hidden');
}

// Handle Dynamic Dropdown Toggles for Input Fields
document.getElementById('entry-type').addEventListener('change', (e) => {
  if (e.target.value === 'sale') {
    document.getElementById('form-sale-group').classList.remove('hidden');
    document.getElementById('form-expense-group').classList.add('hidden');
  } else {
    document.getElementById('form-sale-group').classList.add('hidden');
    document.getElementById('form-expense-group').classList.remove('hidden');
  }
});

/* ========================================================
   AUTHENTICATION LOGIC STREAM: SIGNIN & SIGNUP PIPELINES
   ======================================================== */

// Handle Isolated Sign In Processing Block
forms.login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identity = document.getElementById('login-identity').value.trim();
  const pass = document.getElementById('login-pass').value;

  // INTERCEPT CLAUSE: Check local credential constraints for super user overrides
  if (identity === "Admin") {
    // Attempt verification matching against current system store parameters
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
      alert("Invalid custom system administrator credentials.");
      return;
    }
  }

  // Fallback Pipeline: Route verification steps securely via Firebase Core Architecture API
  try {
    const userCredential = await auth.signInWithEmailAndPassword(identity, pass);
    currentUser = userCredential.user;
    await executeSecurityStatusAudit();
  } catch (err) {
    alert(`Authentication Fault: ${err.message}`);
  }
});

// Handle Isolated Registration Pipeline Processing Block
forms.signup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const whatsapp = document.getElementById('signup-whatsapp').value.trim();
  const pass = document.getElementById('signup-pass').value;
  const dp = document.getElementById('signup-dp').value.trim();

  try {
    // Generate Core identity references using global security providers
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = userCredential.user.uid;

    // Disperse profile tracking definitions directly toward Google Sheets microservices
    const response = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'addUser',
        payload: { name, email, whatsapp, dp, uid }
      })
    });
    
    const output = await response.json();
    if (output.success) {
      alert("Registration request logged successfully!");
      switchView('pending');
    }
  } catch (err) {
    alert(`Registration Failure Pipeline Intercept: ${err.message}`);
  }
});

// Audit Access Permission Schemes
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
    alert(`Security Matrix Loop Fault: ${err.message}`);
  }
}

// Handle System Logout Requests
document.getElementById('btn-app-logout').addEventListener('click', async () => {
  if (!isHardcodedAdmin) {
    await auth.signOut();
  }
  isHardcodedAdmin = false;
  currentUser = null;
  transactions = [];
  forms.login.reset();
  forms.signup.reset();
  switchView('auth');
});

/* ========================================================
   PROFILE AND PASSWORD CREDENTIAL UPDATING SYSTEMS
   ======================================================== */
forms.profileUpdate.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById('profile-new-pass').value;
  if (!newPassword || newPassword.length < 6) {
    alert("Password metrics validation fault. Must exceed 5 characters.");
    return;
  }

  try {
    if (isHardcodedAdmin) {
      // Overwrite parameter cells inside settings database blocks mapping admin allocations
      const res = await fetch('/api/sheets', {
        method: 'POST',
        body: JSON.stringify({ action: 'updateAdminPassword', payload: { newPassword } })
      });
      const data = await res.json();
      if (data.success) {
        alert("Super User structural master password changed securely inside spreadsheet matrices.");
        forms.profileUpdate.reset();
      }
    } else {
      // Leverage standard Firebase APIs for updating regular user profile passwords
      await auth.currentUser.updatePassword(newPassword);
      alert("Worker security profile password updated across Firebase verification frameworks successfully.");
      forms.profileUpdate.reset();
    }
  } catch (err) {
    alert(`Credential Update Block Exception: ${err.message}`);
  }
});

/* ========================================================
   DATA PIPELINES & RECALCULATION ANALYTICS LOOPS
   ======================================================== */

// Post Record Transactions Into Sheet Cells
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
      alert("Invalid numeric value mapping definitions.");
      return;
    }
  } else {
    payloadData.expName = document.getElementById('entry-name').value.trim();
    payloadData.expAmt = parseFloat(document.getElementById('entry-amount').value) || 0;
    if (!payloadData.expName || payloadData.expAmt <= 0) {
      alert("Expense documentation inputs are empty or invalid.");
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
      alert("Transaction synchronized with the primary database.");
      document.getElementById('entry-cash').value = '';
      document.getElementById('entry-flour').value = '';
      document.getElementById('entry-name').value = '';
      document.getElementById('entry-amount').value = '';
      await syncDataPipeline();
    }
  } catch (err) {
    alert(`Data Synchronization Exception: ${err.message}`);
  }
});

// Primary Sync Data Thread
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
    console.error("Pipeline Sync Error: ", err);
  }
}

// Global Profit Engine Calculation Block
function executeEngineCalculations() {
  const rateElement = document.getElementById('entry-rate');
  const rate = parseFloat(rateElement ? rateElement.value : 130) || 130;
  const now = new Date();

  // Filter dynamic timestamp entries matching mobile user toggles
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

  // Profit logic engine calculations matching specifications
  const netCashProfit = totalCash - totalExp;
  const netFlourProfit = (totalCash / rate) - (totalExp / rate);

  let outputString = '';
  if (activeMode === 'cash') {
    outputString = `<span class="text-emerald-400">PKR ${netCashProfit.toLocaleString()}</span>`;
  } else if (activeMode === 'flour') {
    outputString = `<span class="text-amber-400">${netFlourProfit.toFixed(2)} KG</span>`;
  } else {
    outputString = `<div class="text-lg flex flex-col gap-1 justify-center items-center">
                     <div>💰 PKR ${netCashProfit.toLocaleString()}</div>
                     <div class="text-xs text-slate-400">and</div>
                     <div>🌾 ${netFlourProfit.toFixed(2)} KG Flour</div>
                   </div>`;
  }

  document.getElementById('profit-output').innerHTML = outputString;
}

// Handle Configuration Metric Engine Click Events
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

// Render Historical Log Entries on Dashboard Rows
function renderLogsUI() {
  const container = document.getElementById('records-list-container');
  container.innerHTML = '';
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-6">No localized transactions logged yet.</p>';
    return;
  }

  transactions.forEach(t => {
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center text-xs";
    
    if (t.type === 'sale') {
      card.innerHTML = `<div>
                          <p class="font-black text-gray-800">📦 Cash Sale [Ref: ${t.id}]</p>
                          <p class="text-gray-400 mt-0.5">${new Date(t.date).toLocaleDateString()}</p>
                        </div>
                        <div class="text-right">
                          <p class="font-extrabold text-green-600">+Rs. ${t.cash}</p>
                          <p class="text-[10px] text-gray-500 font-bold">${t.flour} KG Flour</p>
                        </div>`;
    } else {
      card.innerHTML = `<div>
                          <p class="font-black text-red-700">🛑 Expense: ${t.expName} [Ref: ${t.id}]</p>
                          <p class="text-gray-400 mt-0.5">${new Date(t.date).toLocaleDateString()}</p>
                        </div>
                        <div class="text-right">
                          <p class="font-extrabold text-red-600">-Rs. ${t.expAmt}</p>
                        </div>`;
    }
    container.appendChild(card);
  });
}

document.getElementById('btn-refresh-logs').addEventListener('click', syncDataPipeline);

/* ========================================================
   SUPER USER ACCESS SCHEMES: MANAGEMENT PROCEDURES
   ======================================================== */

// Handle Account Approval Row Layout Rendering
async function syncPendingAdminUsersList() {
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'getPendingUsers' })
    });
    const out = await res.json();
    const container = document.getElementById('pending-users-list');
    container.innerHTML = '';

    const list = out.users || [];
    if (list.length === 0) {
      container.innerHTML = '<p class="text-[11px] text-gray-400 text-center py-2">No pending registration pipelines found.</p>';
      return;
    }

    list.forEach(u => {
      const row = document.createElement('div');
      row.className = "bg-red-50/50 p-3 rounded-xl border border-red-100/50 flex justify-between items-center text-xs";
      row.innerHTML = `<div>
                         <p class="font-bold text-gray-800">${u.name || 'Staff'}</p>
                         <p class="text-[10px] text-gray-500">${u.email}</p>
                       </div>
                       <button class="bg-green-600 text-white font-bold px-3 py-1 rounded-md text-[10px] uppercase tracking-wider shadow-sm" onclick="authorizeTargetStaffUser('${u.email}')">
                         Authorize
                       </button>`;
      container.appendChild(row);
    });
  } catch (err) {
    console.error("Approval list processing failure:", err);
  }
}

// Global scope attachment for inline orchestration actions
window.authorizeTargetStaffUser = async function(email) {
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'approveUser', payload: { email } })
    });
    const status = await res.json();
    if (status.success) {
      alert(`User profile [${email}] configuration metrics successfully flipped to active.`);
      await syncPendingAdminUsersList();
    }
  } catch (err) {
    alert(`Authorization transaction fault: ${err.message}`);
  }
};

// Handle Hard Overwrites
document.getElementById('edit-submit').addEventListener('click', async () => {
  const id = document.getElementById('edit-id').value.trim();
  const val = parseFloat(document.getElementById('edit-val').value) || 0;

  if (!id) {
    alert("Identifier reference query parameter required.");
    return;
  }

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateTransaction', payload: { id, val } })
    });
    const status = await res.json();
    if (status.success) {
      alert("Spreadsheet database cell value overwritten explicitly.");
      document.getElementById('edit-id').value = '';
      document.getElementById('edit-val').value = '';
      await syncDataPipeline();
    } else {
      alert("Target ID transaction index bounds check failed.");
    }
  } catch (err) {
    alert(`Cell execution bypass exception: ${err.message}`);
  }
});

/* ========================================================
   BOTTOM TAB SELECTION NAVIGATION EVENTS MAPPING
   ======================================================== */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetTab = e.currentTarget.getAttribute('data-tab');
    
    // Toggle active state classes
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('text-green-600');
      b.classList.add('text-gray-400');
    });
    e.currentTarget.classList.remove('text-gray-400');
    e.currentTarget.classList.add('text-green-600');

    // Toggle active layout targets
    Object.keys(tabs).forEach(k => tabs[k].classList.add('hidden'));
    tabs[targetTab].classList.remove('hidden');
  });
});

// Check status on document loads
window.addEventListener('DOMContentLoaded', async () => {
  auth.onAuthStateChanged(async (user) => {
    if (user && !isHardcodedAdmin) {
      currentUser = user;
      await executeSecurityStatusAudit();
    } else if (!isHardcodedAdmin) {
      switchView('auth');
    }
  });
});
