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
const storage = firebase.storage();

let currentUser = null;
let currentProfileRole = 'user';
let isHardcodedAdmin = false;
let globalAdminHardcodedPassword = "N@veed_admin123";
let transactions = [];
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

// Navigation Events Configuration
document.getElementById('btn-show-auth').addEventListener('click', () => views.auth.classList.remove('hidden'));
document.getElementById('btn-close-auth').addEventListener('click', () => views.auth.classList.add('hidden'));
document.getElementById('btn-goto-login').addEventListener('click', () => toggleAuthTabs(true));
document.getElementById('btn-goto-signup').addEventListener('click', () => toggleAuthTabs(false));

function toggleAuthTabs(showLogin) {
  if(showLogin) {
    forms.login.classList.remove('hidden');
    forms.signup.classList.add('hidden');
  } else {
    forms.login.classList.add('hidden');
    forms.signup.classList.remove('hidden');
  }
}

document.getElementById('form-tab-milling').addEventListener('click', () => {
  document.getElementById('milling-form-container').classList.remove('hidden');
  document.getElementById('sales-form-container').classList.add('hidden');
});

document.getElementById('form-tab-sales').addEventListener('click', () => {
  document.getElementById('sales-form-container').classList.remove('hidden');
  document.getElementById('milling-form-container').classList.add('hidden');
});

// Auth Submit Pipelines
forms.login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identity = document.getElementById('login-identity').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (identity === "Admin" && pass === globalAdminHardcodedPassword) {
    isHardcodedAdmin = true;
    currentProfileRole = 'admin';
    currentUser = { email: 'admin@system.local', uid: 'SYSTEM_ADMIN' };
    document.getElementById('user-avatar-top').src = "https://cdn-icons-png.flaticon.com/512/2206/2206368.png";
    document.getElementById('user-display-role').textContent = "🛡️ Super Admin";
    document.getElementById('super-admin-panel').classList.remove('hidden');
    switchView('app');
    return;
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(identity, pass);
    currentUser = userCredential.user;
    switchView('app');
  } catch (err) {
    alert(err.message);
  }
});

// Native Password Reset Activation Loop
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

// Core Dynamic Calculations Logic Loop (4kg/Mund Rule Execution)
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

  const deduction = wheat * 0.10; // 4kg over 40kg translates to 10% weight drop
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

// Public Customer Tracking lookup directory method
document.getElementById('btn-public-search').addEventListener('click', () => {
  const phone = document.getElementById('public-search-phone').value.trim();
  const resDiv = document.getElementById('public-search-results');
  if(!phone) return alert("Please input a valid phone number mapping reference.");

  resDiv.classList.remove('hidden');
  resDiv.innerHTML = `<div class="p-4 bg-emerald-50 border rounded-xl text-xs text-emerald-800">No active tracking files found for query. Dashboard submission synchronizes records.</div>`;
});

// Fixed Bottom Main Navigation System
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget.getAttribute('data-tab');
    Object.keys(tabs).forEach(k => tabs[k].classList.add('hidden'));
    tabs[target].classList.remove('hidden');
  });
});

// Persistent Login State Observer Initialization
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    switchView('app');
  } else if (!isHardcodedAdmin) {
    switchView('public');
  }
});
