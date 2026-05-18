// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCM8xeCYILdA5kUAE6_kZuEkyN_1L3YGII",
  authDomain: "sundarchaki-1a6f6.firebaseapp.com",
  projectId: "sundarchaki-1a6f6",
  storageBucket: "sundarchaki-1a6f6.firebasestorage.app",
  messagingSenderId: "858438670800",
  appId: "1:858438670800:web:72d7cd9c3359866f6441d5",
  measurementId: "G-W777E1W47S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// State & DOM
const state = {
  isAuth: false,
  isAdmin: false,
  user: null,
  transactions: [],
  activeTab: 'home',
  activeRange: 'daily',
  activeMode: 'cash'
};

const els = {
  authView: document.getElementById('auth-view'),
  pendingView: document.getElementById('pending-view'),
  mainApp: document.getElementById('main-app'),
  bottomNav: document.getElementById('bottom-nav'),
  tabs: document.querySelectorAll('[id^="tab-"]'),
  navBtns: document.querySelectorAll('.nav-btn'),
  showLogin: document.getElementById('show-login'),
  showRegister: document.getElementById('show-register'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  pendingUsers: document.getElementById('pending-users-list'),
  profitCard: document.getElementById('profit-card')
};

// --- UI TOGGLES ---
function switchAuthView(type) {
  if (type === 'login') {
    els.loginForm.classList.remove('hidden');
    els.registerForm.classList.add('hidden');
    els.showLogin.classList.replace('text-gray-600', 'text-white');
    els.showLogin.classList.replace('bg-transparent', 'bg-green-600');
    els.showRegister.classList.replace('text-white', 'text-gray-600');
    els.showRegister.classList.replace('bg-green-600', 'bg-transparent');
  } else {
    els.loginForm.classList.add('hidden');
    els.registerForm.classList.remove('hidden');
    els.showRegister.classList.replace('text-gray-600', 'text-white');
    els.showRegister.classList.replace('bg-transparent', 'bg-green-600');
    els.showLogin.classList.replace('text-white', 'text-gray-600');
    els.showLogin.classList.replace('bg-green-600', 'bg-transparent');
  }
}
els.showLogin.addEventListener('click', () => switchAuthView('login'));
els.showRegister.addEventListener('click', () => switchAuthView('register'));

function setTab(tab) {
  state.activeTab = tab;
  els.tabs.forEach(t => t.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  els.navBtns.forEach(b => {
    b.classList.remove('text-green-600', 'bg-green-50');
    b.classList.add('text-gray-400');
  });
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if(activeBtn) {
    activeBtn.classList.add('text-green-600');
    activeBtn.classList.remove('text-gray-400');
  }
}
els.navBtns.forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

// --- SHEET API WRAPPER ---
async function callSheets(action, payload) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  return await res.json();
}

// --- AUTH FLOW ---
document.getElementById('forgot-pass').addEventListener('click', async () => {
  const email = prompt("Enter your registered email:");
  if (!email) return;
  try {
    await auth.sendPasswordResetEmail(email);
    alert("Password reset link sent to your email. Check spam if needed.");
  } catch (e) { alert("Error: " + e.message); }
});

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loader = els.loginForm.querySelector('.loader');
  loader.style.display = 'block';
  
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;

  // 1. HARDCODED ADMIN BYPASS
  if (username.toLowerCase() === 'admin') {
    // Check persisted password first
    const sheetRes = await callSheets('getAdminPass', {});
    const storedPass = sheetRes.password;
    const validPass = storedPass || 'N@veed_admin123';
    
    if (pass === validPass) {
      state.isAdmin = true;
      document.getElementById('user-display-name').textContent = 'Admin Sundar';
      document.getElementById('user-display-role').textContent = 'Super Admin';
      document.getElementById('nav-admin').classList.remove('hidden');
      loadApp();
    } else {
      alert("Invalid Admin Password");
    }
  } else {
    // 2. FIREBASE USER LOGIN
    try {
      await auth.signInWithEmailAndPassword(username, pass);
    } catch (err) {
      alert(err.message);
      loader.style.display = 'none';
      return;
    }
  }
});

els.registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loader = els.registerForm.querySelector('.loader');
  loader.style.display = 'block';

  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const phone = document.getElementById('reg-phone').value.trim();
  const dp = document.getElementById('reg-dp').value || '';
  const name = document.getElementById('reg-name').value.trim();

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await callSheets('registerUser', { email, uid: cred.user.uid, phone, dp, name });
    els.authView.classList.add('hidden');
    els.pendingView.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally { loader.style.display = 'none'; }
});

// Firebase State Listener
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  state.user = user;
  const statusData = await callSheets('getUserStatus', { email: user.email });
  
  if (statusData.status === 'active') {
    state.isAdmin = statusData.role === 'admin';
    document.getElementById('user-display-name').textContent = statusData.name || 'User';
    document.getElementById('user-display-role').textContent = statusData.role === 'admin' ? 'Admin' : 'Worker';
    document.getElementById('nav-admin').style.display = state.isAdmin ? 'flex' : 'none';
    document.getElementById('prof-dp').value = statusData.dp || '';
    document.getElementById('prof-phone').value = statusData.phone || '';
    loadApp();
  } else {
    state.isAuth = false;
    els.authView.classList.add('hidden');
    els.pendingView.classList.remove('hidden');
  }
});

document.getElementById('back-to-login').addEventListener('click', () => {
  els.pendingView.classList.add('hidden');
  els.authView.classList.remove('hidden');
  switchAuthView('login');
});

function loadApp() {
  state.isAuth = true;
  els.authView.classList.add('hidden');
  els.pendingView.classList.add('hidden');
  els.mainApp.classList.remove('hidden');
  els.bottomNav.classList.remove('hidden');
  setTab('home');
  document.getElementById('entry-date').valueAsDate = new Date();
  
  // Load Transactions
  callSheets('getTransactions', { uid: state.isAdmin ? 'all' : state.user?.uid })
    .then(res => { state.transactions = res.data || []; calculateProfit(); })
    .catch(() => {});

  // Admin: Load Pending Users
  if (state.isAdmin) loadPendingUsers();
}

// --- ENTRY LOGIC ---
document.querySelectorAll('.entry-type').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.entry-type').forEach(b => {
      b.classList.remove('bg-white', 'text-green-700', 'shadow-sm');
      b.classList.add('text-gray-500');
    });
    btn.classList.add('bg-white', 'text-green-700', 'shadow-sm');
    btn.classList.remove('text-gray-500');
    
    const isExp = btn.dataset.type === 'expense';
    document.getElementById('expense-fields').style.display = isExp ? 'block' : 'none';
  });
});

document.getElementById('save-entry').addEventListener('click', async () => {
  const type = document.querySelector('.entry-type.bg-white').dataset.type;
  const payload = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2,4),
    uid: state.user?.uid || 'admin-session',
    type,
    date: document.getElementById('entry-date').value,
    cash: parseFloat(document.getElementById('entry-cash').value) || 0,
    flour: parseFloat(document.getElementById('entry-flour').value) || 0,
    rate: parseFloat(document.getElementById('entry-rate').value) || 0,
    expName: type === 'expense' ? document.getElementById('entry-exp-name').value : '',
    expAmt: type === 'expense' ? (parseFloat(document.getElementById('entry-exp-amt').value) || 0) : 0
  };
  await callSheets('addTransaction', payload);
  alert('Entry Saved!');
  // Reset inputs but keep date
  document.querySelectorAll('#tab-entry input:not([type="date"])').forEach(i => i.value = '');
  loadApp();
});

// --- REPORTS ENGINE ---
document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.range-btn').forEach(x => x.classList.replace('bg-green-600', 'bg-gray-100') || x.classList.replace('text-white', 'text-gray-600'));
  b.classList.replace('bg-gray-100', 'bg-green-600');
  b.classList.replace('text-gray-600', 'text-white');
  state.activeRange = b.dataset.range;
  calculateProfit();
}));

document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.mode-btn').forEach(x => { x.classList.replace('bg-green-100', 'bg-gray-50'); x.classList.replace('text-green-800', 'text-gray-500'); });
  b.classList.replace('bg-gray-50', 'bg-green-100');
  b.classList.replace('text-gray-500', 'text-green-800');
  state.activeMode = b.dataset.mode;
  calculateProfit();
}));

function calculateProfit() {
  const rate = parseFloat(document.getElementById('report-rate').value);
  if (!rate || rate <= 0) { els.profitCard.innerHTML = '<span class="text-gray-400 text-sm">Enter valid daily rate</span>'; return; }

  const now = new Date();
  const filtered = state.transactions.filter(t => {
    const d = new Date(t.date);
    if (state.activeRange === 'daily') return d.toDateString() === now.toDateString();
    if (state.activeRange === 'weekly') { const start = new Date(); start.setDate(now.getDate() - 7); return d >= start; }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalCash = filtered.reduce((s, t) => s + (t.cash || 0), 0);
  const totalExp = filtered.reduce((s, t) => s + (t.expAmt || 0), 0);
  const totalFlour = filtered.reduce((s, t) => s + (t.flour || 0), 0);

  const netCash = totalCash - totalExp;
  // Prompt Formula: (Total Cash / Rate) - (Total Expenses / Rate)
  const netFlourKg = (totalCash / rate) - (totalExp / rate);

  let html = '';
  if (state.activeMode === 'cash') {
    html = `<div class="text-center"><p class="text-xs text-gray-500">Net Cash Profit</p><p class="text-2xl font-bold text-green-700">PKR ${netCash.toFixed(2)}</p><p class="text-xs text-gray-400 mt-1">Flour Milled: ${totalFlour.toFixed(1)} KG</p></div>`;
  } else if (state.activeMode === 'flour') {
    html = `<div class="text-center"><p class="text-xs text-gray-500">Flour Equivalent</p><p class="text-2xl font-bold text-amber-600">${netFlourKg.toFixed(2)} KG</p></div>`;
  } else {
    html = `<div class="flex flex-col gap-2"><div class="bg-white p-3 rounded-lg"><span class="text-xs text-gray-500 block">Cash Profit</span><span class="text-lg font-bold text-green-700">PKR ${netCash.toFixed(2)}</span></div><div class="bg-white p-3 rounded-lg"><span class="text-xs text-gray-500 block">Flour Equivalent</span><span class="text-lg font-bold text-amber-600">${netFlourKg.toFixed(2)} KG</span></div></div>`;
  }
  els.profitCard.innerHTML = html;
}
document.getElementById('report-rate').addEventListener('input', calculateProfit);

// --- PROFILE & ADMIN UPDATES ---
document.getElementById('save-profile').addEventListener('click', async () => {
  const newPass = document.getElementById('prof-new-pass').value;
  const currPass = document.getElementById('prof-curr-pass').value;
  const dp = document.getElementById('prof-dp').value;
  const phone = document.getElementById('prof-phone').value;

  if (newPass) {
    try {
      await auth.currentUser.updatePassword(newPass);
      alert("Password updated successfully!");
    } catch (e) { alert("Failed to update password. Ensure current password is correct and session is recent."); return; }
  }
  await callSheets('updateProfile', { email: state.user.email, dp, phone });
  alert("Profile updated!");
});

document.getElementById('save-admin-pass').addEventListener('click', async () => {
  const newP = document.getElementById('admin-new-pass').value;
  if (!newP) return alert("Enter new password");
  await callSheets('updateAdminPass', { password: newP });
  alert("Admin password updated in Settings sheet!");
  document.getElementById('admin-new-pass').value = '';
});

async function loadPendingUsers() {
  const res = await callSheets('getPendingUsers', {});
  els.pendingUsers.innerHTML = '';
  if (!res.users.length) { els.pendingUsers.innerHTML = '<p class="text-sm text-green-600 font-medium">All accounts active ✅</p>'; return; }
  
  res.users.forEach(u => {
    els.pendingUsers.insertAdjacentHTML('beforeend', `
      <div class="flex justify-between items-center bg-gray-50 p-2 rounded border">
        <div>
          <p class="text-sm font-bold text-gray-800">${u.name}</p>
          <p class="text-xs text-gray-500">${u.email} | ${u.phone}</p>
        </div>
        <button onclick="approveUser('${u.email}')" class="bg-green-600 text-white px-3 py-1 text-xs font-bold rounded shadow">Activate</button>
      </div>
    `);
  });
}

window.approveUser = async (email) => {
  await callSheets('approveUser', { email });
  alert(`${email} activated!`);
  loadPendingUsers();
};
