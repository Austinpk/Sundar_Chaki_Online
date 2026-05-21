/**
 * Sundar Sehat Ata - Production Frontend Application Logic
 * Full Feature Set (Security Shield Patches, Worker Analytics, Custom Dates & Rounding)
 * Hotfixes applied: Interceptor locks on Firebase auto-login race conditions, Base64 validation.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCM8xeCYILdA5kUAE6_kZuEkyN_1L3YGII",
  authDomain: "sundarchaki-1a6f6.firebaseapp.com",
  projectId: "sundarchaki-1a6f6",
  storageBucket: "sundarchaki-1a6f6.firebasestorage.app",
  messagingSenderId: "858438670800",
  appId: "1:858438670800:web:72d7cd9c3359866f6441d5",
  measurementId: "G-W777E1W47S"
};

// Initialize Firebase SDK Modules
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Production API Web App Target Mapping Reference
const GOOGLE_APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbwBiFhBQVSc8vAWDCYnN2cpWMR2l3ylHnaP2GO_jyTcbUggsGo8xQz025dX6vFZM0c9/exec";

let currentUser = null;
let currentProfileRole = 'user';
let currentOperatorDisplayName = "Staff Account Node"; 
let isHardcodedAdmin = false;
let globalAdminHardcodedPassword = "N@veed_admin123";
let transactions = [];
let globalWorkersList = [];
let activeRange = 'daily'; 
let uploadedImageUrl = ""; 
let currentSelectedRecord = null; 

// CRITICAL SECURITY LOCK: Prevents background auth listeners from triggering during signup state runs
let isProcessingRegistration = false;

const views = {
  public: document.getElementById('public-landing-view'),
  auth: document.getElementById('auth-view'),
  pending: document.getElementById('pending-view'),
  app: document.getElementById('app-view'),
  nav: document.getElementById('bottom-nav'),
  detailsModal: document.getElementById('details-modal')
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

async function transmitDataToBackend(actionPayload) {
  const response = await fetch(GOOGLE_APPS_SCRIPT_API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(actionPayload)
  });
  if (!response.ok) throw new Error(`Network status fault: ${response.status}`);
  return await response.json();
}

function switchView(target) {
  if (!views.auth || !views.public || !views.app || !views.nav || !views.pending) {
    console.error("DOM view components initialization mapping failure.");
    return;
  }
  
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

document.getElementById('btn-show-auth').addEventListener('click', () => views.auth.classList.remove('hidden'));
document.getElementById('btn-close-auth').addEventListener('click', () => views.auth.classList.add('hidden'));
document.getElementById('btn-goto-login').addEventListener('click', () => toggleAuthTabs(true));
document.getElementById('btn-goto-signup').addEventListener('click', () => toggleAuthTabs(false));
document.getElementById('btn-close-modal').addEventListener('click', () => views.detailsModal.classList.add('hidden'));

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

// LOCAL FILE TO BASE64 PARSER STRIPPER (UPDATED WITH BUTTON LOCKDOWN)
document.getElementById('signup-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const statusText = document.getElementById('upload-status-text');
  const signupBtn = forms.signup.querySelector('button[type="submit"]') || document.getElementById('btn-submit-signup');
  
  statusText.classList.remove('hidden');
  statusText.className = "text-[10px] text-amber-600 font-bold mt-1";
  statusText.textContent = "⌛ Processing profile photo structure...";
  
  if (signupBtn) signupBtn.disabled = true; // Lock button immediately

  const reader = new FileReader();
  reader.onload = function (event) {
    uploadedImageUrl = event.target.result; 
    statusText.textContent = "✅ Image asset verified and locked in!";
    statusText.className = "text-[10px] text-green-600 font-bold mt-1";
    if (signupBtn) signupBtn.disabled = false; // Unlock button safely
  };
  reader.onerror = function (err) {
    statusText.textContent = "❌ Asset processing fault occurred locally.";
    statusText.className = "text-[10px] text-red-600 font-bold mt-1";
    if (signupBtn) signupBtn.disabled = false;
  };
  reader.readAsDataURL(file);
});

// LOGIN ACTION RUNNER
forms.login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identity = document.getElementById('login-identity').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (identity === "Admin" && pass === globalAdminHardcodedPassword) {
    isHardcodedAdmin = true;
    currentProfileRole = 'admin';
    currentOperatorDisplayName = "Super Admin";
    currentUser = { email: 'admin@system.local', uid: 'SYSTEM_SUPER_ADMIN_OVERRIDE' };
    document.getElementById('user-avatar-top').src = "https://cdn-icons-png.flaticon.com/512/2206/2206368.png";
    document.getElementById('user-display-role').textContent = "🛡️ Super Admin";
    document.getElementById('super-admin-panel').classList.remove('hidden');
    switchView('app');
    await syncDataPipeline();
    return;
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(identity, pass);
    currentUser = userCredential.user;
    await executeSecurityStatusAudit();
  } catch (err) { alert(`Authentication Fault: ${err.message}`); }
});

document.getElementById('btn-forgot-password').addEventListener('click', async () => {
  const emailInput = document.getElementById('login-identity').value.trim();
  if (!emailInput || !emailInput.includes('@')) return alert("Enter your email address layout context.");
  try {
    await auth.sendPasswordResetEmail(emailInput);
    alert("Reset link dispatched.");
  } catch (err) { alert(err.message); }
});

// SIGNUP ACTION WITH EXPLICIT RACE-CONDITION SAFETY INTERCEPTOR
forms.signup.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!uploadedImageUrl) {
    alert("❌ Please select and wait for your profile picture to process before registering.");
    return;
  }
  
  // Activate Interceptor Lock immediately to disable onAuthStateChanged from jumping the gun
  isProcessingRegistration = true;

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const whatsapp = document.getElementById('signup-whatsapp').value.trim();
  const pass = document.getElementById('signup-pass').value;

  try {
    // Firebase generates account and immediately logs user onto client engine state context
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = userCredential.user.uid;
    
    // Handshake structure down to Apps Script data arrays
    const output = await transmitDataToBackend({ 
      action: 'addUser', 
      payload: { name, email, whatsapp, dp: uploadedImageUrl, uid } 
    });
    
    if (output.success) { 
      alert("✅ Registration complete! Your account is pending Super Admin validation approval."); 
      forms.signup.reset();
      uploadedImageUrl = ""; 
      const statusText = document.getElementById('upload-status-text');
      if (statusText) statusText.classList.add('hidden');
      
      // Cleanly evict session block data context from memory cache arrays
      await auth.signOut();
      currentUser = null;
      currentProfileRole = 'user';
      currentOperatorDisplayName = "Staff Account Node";

      // Toggle directly down into approval viewport loop state cleanly
      switchView('pending'); 
    } else { 
      throw new Error(output.error || "Registration error."); 
    }
  } catch (err) { 
    alert(`Registration Error: ${err.message}`); 
    // Release configuration state lock if error bounds are triggered
    await auth.signOut();
    currentUser = null;
    switchView('public');
  } finally {
    // Release state configuration lock parameter safely
    isProcessingRegistration = false;
  }
});

// ABSOLUTE SECURITY ACCESS CONTROLLER
async function executeSecurityStatusAudit() {
  // Hard stop exit condition if user object missing completely
  if (!currentUser) {
    switchView('public');
    return;
  }
  
  try {
    const data = await transmitDataToBackend({ 
      action: 'checkUser', 
      payload: { email: currentUser.email } 
    });
    
    // CRITICAL ACCESS GUARD: Instantly dump tracking parameters if database arrays report state parameters as missing/not active
    if (!data || !data.status || data.status === 'pending' || data.status === 'declined' || data.status === 'not_found') {
      await auth.signOut();
      currentUser = null;
      switchView('pending');
      return; 
    }

    currentProfileRole = data.role || 'user';
    currentOperatorDisplayName = data.name || "Staff Account Node"; 
    document.getElementById('user-avatar-top').src = data.dp || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    document.getElementById('user-display-role').textContent = `👤 ${currentOperatorDisplayName}`;
    
    if (currentProfileRole === 'admin') document.getElementById('super-admin-panel').classList.remove('hidden');
    else document.getElementById('super-admin-panel').classList.add('hidden');

    switchView('app');
    await syncDataPipeline();
  } catch (err) { 
    await auth.signOut();
    currentUser = null;
    switchView('pending');
    alert(`Access Restriction: ${err.message}`); 
  }
}

const executeAppLogoutAction = async () => {
  if (!isHardcodedAdmin) await auth.signOut();
  isHardcodedAdmin = false;
  currentUser = null;
  transactions = [];
  uploadedImageUrl = "";
  currentOperatorDisplayName = "Staff Account Node";
  forms.login.reset();
  forms.signup.reset();
  switchView('public');
};
document.getElementById('btn-app-logout').addEventListener('click', executeAppLogoutAction);
document.getElementById('btn-pending-logout').addEventListener('click', executeAppLogoutAction);

// FORM COMPUTATION INTERACTIVE ENGINE: MILLING
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

  const deduction = parseFloat((wheat * 0.10).toFixed(2)); 
  const cashEquivalent = deduction * rate;
  const balance = strategy === 'deduct' ? (wheat - deduction - pickup) : (wheat - pickup);

  document.getElementById('calc-deduction').textContent = `${deduction.toFixed(2)} KG`;
  document.getElementById('calc-cash-equivalent').textContent = `PKR ${Math.round(cashEquivalent)}`;
  document.getElementById('calc-final-balance').textContent = `${balance.toFixed(2)} KG`;
}
Object.values(millInputs).forEach(inp => inp.addEventListener('input', runLiveMillingCalculations));
millInputs.strategy.addEventListener('change', runLiveMillingCalculations);

// FORM COMPUTATION INTERACTIVE ENGINE: CASH SALES
const saleQtyInput = document.getElementById('sale-flour-qty');
const saleRateInput = document.getElementById('sale-flour-rate');

function runLiveSaleCalculations() {
  const qty = parseFloat(saleQtyInput.value) || 0;
  const rate = parseFloat(saleRateInput.value) || 120;
  document.getElementById('calc-sale-bill').textContent = `PKR ${(qty * rate).toLocaleString()}`;
}
saleQtyInput.addEventListener('input', runLiveSaleCalculations);
saleRateInput.addEventListener('input', runLiveSaleCalculations);

// DATA COMMIT: MILLING RUN (UPDATED WITH EXPLICIT NULL-SAFEGUARDS)
document.getElementById('btn-submit-milling').addEventListener('click', async () => {
  if (!currentUser || !currentUser.uid) return alert("❌ Session expired or profile state invalid. Please log in again.");
  const name = document.getElementById('mill-cust-name').value.trim();
  const phone = document.getElementById('mill-cust-phone').value.trim();
  const wheat = parseFloat(millInputs.wheat.value) || 0;
  const pickup = parseFloat(millInputs.pickup.value) || 0;
  const rate = parseFloat(millInputs.rate.value) || 120;
  const strategy = millInputs.strategy.value;

  if (!name) return alert("❌ Specify Customer Name.");
  if (!phone || phone.length < 10) return alert("❌ Valid mobile contact number required.");
  if (isNaN(wheat) || wheat <= 0) return alert("❌ Wheat weight must exceed 0 KG.");

  const deduction = parseFloat((wheat * 0.10).toFixed(2));
  const cashVal = strategy === 'cash' ? parseFloat((deduction * rate).toFixed(2)) : 0;
  const finalFlour = parseFloat((strategy === 'deduct' ? (wheat - deduction - pickup) : (wheat - pickup)).toFixed(2));

  try {
    const btn = document.getElementById('btn-submit-milling');
    btn.disabled = true; btn.innerText = "Saving data run...";

    const status = await transmitDataToBackend({
      action: 'addTransaction',
      payload: { 
        uid: currentUser.uid.trim(), 
        operatorName: currentOperatorDisplayName, 
        type: 'milling', 
        name, phone, wheat, pickup, strategy, deduction, cash: cashVal, flour: finalFlour, rate 
      }
    });

    if (status.success) {
      alert("✅ Milling run updated successfully.");
      document.getElementById('mill-cust-name').value = '';
      document.getElementById('mill-cust-phone').value = '';
      millInputs.wheat.value = '';
      millInputs.pickup.value = '0';
      await syncDataPipeline();
    } else { alert("Error writing entry: " + status.error); }
  } catch (err) { alert(`Sync Failure: ${err.message}`); }
  finally {
    const btn = document.getElementById('btn-submit-milling');
    if (btn) { btn.disabled = false; btn.innerText = "💾 Save Milling Run"; }
  }
});

// DATA COMMIT: CASH FLOUR SALE (UPDATED WITH EXPLICIT NULL-SAFEGUARDS)
document.getElementById('btn-submit-sale').addEventListener('click', async () => {
  if (!currentUser || !currentUser.uid) return alert("❌ Session expired or profile state invalid. Please log in again.");
  const name = document.getElementById('sale-cust-name').value.trim();
  const qty = parseFloat(saleQtyInput.value) || 0;
  const rate = parseFloat(saleRateInput.value) || 120;
  const phone = document.getElementById('sale-cust-phone').value.trim();

  if (!name) return alert("❌ Customer Name required.");
  if (!phone || phone.length < 10) return alert("❌ Valid contact mobile line sequence required.");
  if (isNaN(qty) || qty <= 0) return alert("❌ Sale volume must exceed 0 KG.");

  try {
    const btn = document.getElementById('btn-submit-sale');
    btn.disabled = true; btn.innerText = "Logging sale run...";

    const status = await transmitDataToBackend({
      action: 'addTransaction',
      payload: { 
        uid: currentUser.uid.trim(), 
        operatorName: currentOperatorDisplayName, 
        type: 'sale', 
        name, flour: qty, rate, cash: parseFloat((qty * rate).toFixed(2)), phone 
      }
    });

    if (status.success) {
      alert("✅ Flour Cash Sale logged!");
      document.getElementById('sale-cust-name').value = '';
      saleQtyInput.value = '';
      document.getElementById('sale-cust-phone').value = '';
      document.getElementById('calc-sale-bill').textContent = "PKR 0";
      await syncDataPipeline();
    } else { alert("Error saving log: " + status.error); }
  } catch (err) { alert(`Sync Failure: ${err.message}`); }
  finally {
    const btn = document.getElementById('btn-submit-sale');
    if (btn) { btn.disabled = false; btn.innerText = "💾 Record Cash Sale"; }
  }
});

// PUBLIC SEARCH PANEL ENGINE
document.getElementById('btn-public-search').addEventListener('click', () => {
  const phone = document.getElementById('public-search-phone').value.trim();
  const resDiv = document.getElementById('public-search-results');
  if(!phone) return alert("Input phone tracking line.");
  resDiv.classList.remove('hidden');

  const matches = transactions.filter(t => t.phone === phone || t.phone === "'" + phone);
  if (matches.length === 0) {
    resDiv.innerHTML = `<div class="p-4 bg-orange-50 border rounded-xl text-xs text-orange-800 font-semibold">No transactions found matching this reference.</div>`;
    return;
  }
  resDiv.innerHTML = matches.map(t => {
    let dateStr = "N/A"; if (t.date) { const d = new Date(t.date); if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString(); }
    return `
      <div class="p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1 shadow-sm">
        <div class="flex justify-between font-bold text-gray-800">
          <span>🗓️ ${dateStr}</span>
          <span class="uppercase text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">${t.type}</span>
        </div>
        <p class="text-gray-600"><b>Customer:</b> ${t.name}</p>
        <div class="grid grid-cols-2 gap-1 pt-1 font-mono text-gray-500">
          <div>Flour: ${(parseFloat(t.flour) || 0).toFixed(2)} KG</div>
          <div>Cash: PKR ${t.cash || 0}</div>
        </div>
      </div>`;
  }).join('');
});

// CORE MASTER SYNC CONTROLLER (WITH INSTANT NULL PIPELINE PROTECTIONS)
async function syncDataPipeline() {
  try {
    const out = await transmitDataToBackend({ action: 'getTransactions' });
    const allData = out.data || [];
    globalWorkersList = out.workers || [];
    
    if (currentProfileRole === 'admin') {
      transactions = allData;
      await syncPendingAdminUsersList();
      renderWorkerAnalyticsDashboard();
    } else {
      // Strict Null Shielding: Stops reading from a null user if state shifted in the background
      if (!currentUser || !currentUser.uid) {
        console.warn("Pipeline synchronization halted: No active authenticated user profile context.");
        return;
      }
      transactions = allData.filter(t => 
        t && t.uid && String(t.uid).trim().toLowerCase() === String(currentUser.uid).trim().toLowerCase()
      );
    }
    
    executeEngineCalculations();
    renderLogsUI();
  } catch (err) { console.error("Pipeline Sync Fault: ", err); }
}

// SUPER ADMIN INTELLIGENCE ANALYTICS METRIC DISPLAY ENGINE
function renderWorkerAnalyticsDashboard() {
  const adminPanel = document.getElementById('super-admin-panel');
  if (!adminPanel) return;

  let insightsContainer = document.getElementById('admin-worker-intelligence-matrix');
  if (!insightsContainer) {
    insightsContainer = document.createElement('div');
    insightsContainer.id = 'admin-worker-intelligence-matrix';
    insightsContainer.className = 'mt-6 space-y-3';
    adminPanel.appendChild(insightsContainer);
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let outputHtml = `<h3 class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">⚙️ Worker Operations & Performance Tracker</h3>`;
  
  if (globalWorkersList.length === 0) {
    outputHtml += `<p class="text-[11px] text-gray-400 bg-gray-50 p-3 rounded-xl border">No registered data streams available.</p>`;
    insightsContainer.innerHTML = outputHtml;
    return;
  }

  globalWorkersList.forEach(worker => {
    const workerTxns = transactions.filter(t => t && t.uid && String(t.uid).trim().toLowerCase() === String(worker.uid).trim().toLowerCase());
    const totalCustomers = new Set(workerTxns.map(t => t.phone)).size;
    
    const weeklyTxns = workerTxns.filter(t => new Date(t.date) >= oneWeekAgo);
    const weeklyCash = weeklyTxns.reduce((sum, t) => sum + (parseFloat(t.cash) || 0), 0);
    const weeklyFlour = weeklyTxns.reduce((sum, t) => sum + (parseFloat(t.flour) || 0), 0);

    outputHtml += `
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-2xl border border-slate-700 shadow-sm space-y-2 cursor-pointer active:scale-[0.99] transition-all" onclick="alert('Worker Name: ${worker.name}\\nTotal Unique Customers Managed: ${totalCustomers}\\n7-Day Revenue Feed: PKR ${weeklyCash.toLocaleString()}\\n7-Day Handled Flour: ${weeklyFlour.toFixed(2)} KG')">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="${worker.dp || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" class="w-8 h-8 rounded-full object-cover border border-emerald-500">
            <div>
              <p class="font-bold text-xs">${worker.name}</p>
              <p class="text-[10px] text-slate-400 font-mono">${worker.email}</p>
            </div>
          </div>
          <span class="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Active Staff</span>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700 text-center font-mono text-[10px]">
          <div>
            <p class="text-slate-400 text-[9px] uppercase font-sans">Customers</p>
            <p class="font-bold text-amber-400">${totalCustomers} Logged</p>
          </div>
          <div>
            <p class="text-slate-400 text-[9px] uppercase font-sans">Weekly Cash</p>
            <p class="font-bold text-green-400">Rs. ${weeklyCash.toLocaleString()}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[9px] uppercase font-sans">Weekly Flour</p>
            <p class="font-bold text-blue-400">${weeklyFlour.toFixed(1)} KG</p>
          </div>
        </div>
      </div>`;
  });

  insightsContainer.innerHTML = outputHtml;
}

// DATE RANGE PARSING CONTROLLER
document.querySelectorAll('.report-range-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.report-range-btn').forEach(b => {
      b.className = 'report-range-btn py-1 text-[11px] font-bold text-slate-300 hover:text-white transition-all';
    });
    e.currentTarget.className = 'report-range-btn py-1 text-[11px] font-bold rounded-lg transition-all bg-emerald-600 text-white shadow-sm';
    activeRange = e.currentTarget.getAttribute('data-range');
    if(activeRange === 'custom') document.getElementById('custom-date-container').classList.remove('hidden');
    else document.getElementById('custom-date-container').classList.add('hidden');
    executeEngineCalculations();
  });
});

document.getElementById('custom-date-start').addEventListener('change', executeEngineCalculations);
document.getElementById('custom-date-end').addEventListener('change', executeEngineCalculations);

function executeEngineCalculations() {
  const now = new Date();
  const filtered = transactions.filter(t => {
    if (!t || !t.date) return false;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return false; 
    if (activeRange === 'daily') return d.toDateString() === now.toDateString();
    if (activeRange === 'weekly') { const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7); return d >= oneWeekAgo; }
    if (activeRange === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (activeRange === 'custom') {
      const customStartVal = document.getElementById('custom-date-start').value;
      const customEndVal = document.getElementById('custom-date-end').value;
      if(!customStartVal || !customEndVal) return true; 
      const cStart = new Date(customStartVal); cStart.setHours(0,0,0,0);
      const cEnd = new Date(customEndVal); cEnd.setHours(23,59,59,999);
      return d >= cStart && d <= cEnd;
    }
    return true;
  });

  let totalCash = filtered.reduce((sum, t) => sum + (parseFloat(t.cash) || 0), 0);
  let totalFlour = filtered.reduce((sum, t) => sum + (parseFloat(t.flour) || 0), 0);

  document.getElementById('profit-output').innerHTML = `
    <div class="text-sm flex flex-col gap-1 items-center">
      <div class="text-[10px] uppercase text-emerald-300 tracking-wider font-bold">Range Totals (${activeRange})</div>
      <div class="text-xl font-black">💰 PKR ${totalCash.toLocaleString()}</div>
      <div class="text-xs text-emerald-100 font-medium">🌾 ${totalFlour.toFixed(2)} KG Flour Booked</div>
    </div>`;
}

// RENDER RECENT ACTIVITY LEDGER ENTRIES
function renderLogsUI() {
  const container = document.getElementById('records-list-container');
  container.innerHTML = '';
  if (transactions.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No data tracks matching current index.</p>';
    return;
  }

  transactions.forEach((t) => {
    if (!t || !t.name || (!t.cash && !t.flour && !t.wheat)) return;
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center text-xs active:bg-gray-100 cursor-pointer transition-all hover:border-emerald-200 mb-2";
    card.addEventListener('click', () => displaySpecificRecordDetails(t));

    let dateStr = "N/A"; if (t.date) { const d = new Date(t.date); if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString(); }

    card.innerHTML = `
      <div class="space-y-0.5">
        <p class="font-black text-gray-900 text-sm capitalize">👤 ${t.name}</p>
        <p class="text-[10px] text-slate-500 font-medium">🛠️ Operator: <span class="font-bold text-emerald-700">${t.operatorName || 'Staff Account Node'}</span></p>
        <p class="text-gray-400 text-[10px]">${dateStr} • <span class="uppercase font-bold text-[9px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded">${t.type}</span></p>
      </div>
      <div class="text-right">
        <p class="font-black text-emerald-600 text-sm">Rs. ${t.cash || 0}</p>
        <p class="text-[10px] text-gray-400 font-bold">${(parseFloat(t.flour) || 0).toFixed(2)} KG</p>
      </div>`;
    container.appendChild(card);
  });
}

function displaySpecificRecordDetails(t) {
  if (!t) return;
  currentSelectedRecord = t;
  const body = document.getElementById('modal-content-body');
  let dateStr = "N/A"; if (t.date) { const d = new Date(t.date); if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString(); }

  const standardizedDeduction = typeof t.deduction === 'number' ? t.deduction.toFixed(2) : parseFloat(t.deduction || 0).toFixed(2);
  const standardizedFlour = typeof t.flour === 'number' ? t.flour.toFixed(2) : parseFloat(t.flour || 0).toFixed(2);
  const standardizedWheat = typeof t.wheat === 'number' ? t.wheat.toFixed(2) : parseFloat(t.wheat || 0).toFixed(2);

  let layoutFields = `
    <div class="bg-slate-50 p-3 rounded-xl border space-y-1.5 font-mono">
      <div><b>Invoiced Date:</b> ${dateStr}</div>
      <div><b>Log ID Item:</b> ${t.id || 'N/A'}</div>
      <div><b>Operator Node:</b> ${t.operatorName || 'Staff Account Node'}</div>
    </div>
    <div class="space-y-2 pt-2">
      <div class="flex justify-between border-b pb-1"><span>Customer Account:</span><span class="font-bold text-gray-900">${t.name}</span></div>
      <div class="flex justify-between border-b pb-1"><span>Contact Line:</span><span class="font-semibold">${t.phone || 'N/A'}</span></div>
      <div class="flex justify-between border-b pb-1"><span>Transaction Category:</span><span class="uppercase font-black text-emerald-700">${t.type === 'milling' ? 'MILLING' : 'SALE'}</span></div>
  `;

  if (t.type === 'milling') {
    layoutFields += `
      <div class="flex justify-between border-b pb-1"><span>Wheat Weight:</span><span class="font-bold">${standardizedWheat} KG</span></div>
      <div class="flex justify-between border-b pb-1"><span>Strategy:</span><span class="capitalize text-blue-700 font-bold">${t.strategy || 'Deduct'}</span></div>
      <div class="flex justify-between border-b pb-1"><span class="text-red-600 font-medium">Deduction Run:</span><span class="text-red-600 font-bold">${standardizedDeduction} KG</span></div>
      <div class="flex justify-between border-b pb-1"><span>Advance Collected:</span><span>${t.pickup || 0} KG</span></div>
    `;
  }

  layoutFields += `
      <div class="flex justify-between border-b pb-1"><span>Active Pricing Rate:</span><span>PKR ${t.rate || 120} / KG</span></div>
      <div class="flex justify-between border-b pb-1"><span>Flour Balance Out:</span><span class="font-bold text-amber-700">${standardizedFlour} KG</span></div>
      <div class="flex justify-between pt-2 text-sm font-black text-green-700"><span>Net Cash Revenue:</span><span>PKR ${t.cash || 0}</span></div>
    </div>`;
  body.innerHTML = layoutFields;
  views.detailsModal.classList.remove('hidden');
}

// DATA AMENDMENT RENDER INTERCEPTORS
document.getElementById('btn-delete-record').addEventListener('click', async () => {
  if (!currentSelectedRecord) return;
  if (currentProfileRole !== 'admin' && currentUser && currentSelectedRecord.uid !== currentUser.uid) return alert("Security Guard: Access denied.");
  if (!confirm(`Permanently drop record?`)) return;
  try {
    document.getElementById('btn-delete-record').disabled = true;
    const status = await transmitDataToBackend({ action: 'deleteTransaction', payload: { id: currentSelectedRecord.id } });
    if (status.success) { alert("Record Dropped."); views.detailsModal.classList.add('hidden'); await syncDataPipeline(); }
  } catch (err) { alert(err.message); }
  finally { document.getElementById('btn-delete-record').disabled = false; }
});

document.getElementById('btn-edit-record').addEventListener('click', async () => {
  if (!currentSelectedRecord) return;
  if (currentProfileRole !== 'admin' && currentUser && currentSelectedRecord.uid !== currentUser.uid) return alert("Security Guard: Access denied.");
  const newName = prompt("Modify Customer Name:", currentSelectedRecord.name); if (!newName) return;
  const newPhone = prompt("Modify Phone Reference:", currentSelectedRecord.phone); if (!newPhone) return;
  try {
    const status = await transmitDataToBackend({ action: 'editTransaction', payload: { id: currentSelectedRecord.id, name: newName.trim(), phone: newPhone.trim() } });
    if (status.success) { alert("Updated."); views.detailsModal.classList.add('hidden'); await syncDataPipeline(); }
  } catch (err) { alert(err.message); }
});

document.getElementById('btn-refresh-logs').addEventListener('click', syncDataPipeline);

// WORKER PROFILE APPROVAL DISPATCH ENGINE
async function syncPendingAdminUsersList() {
  try {
    const container = document.getElementById('pending-users-list'); if (!container) return; container.innerHTML = '';
    const out = await transmitDataToBackend({ action: 'getPendingUsers' }); const list = out.users || [];
    if (list.length === 0) { container.innerHTML = '<p class="text-[11px] text-gray-400 text-center py-2">No pending workers.</p>'; return; }
    list.forEach(u => {
      const row = document.createElement('div'); row.className = "bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 text-left mb-2";
      row.innerHTML = `
        <div class="flex items-start gap-3">
          <img src="${u.dp || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" class="w-10 h-10 rounded-full border object-cover shrink-0">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-gray-800 text-sm truncate">${u.name || 'Staff'}</p>
            <p class="text-[11px] text-gray-600 font-mono break-all"><b>Email:</b> ${u.email}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg text-xs" onclick="processAdminDecision('${u.email}', 'approveUser')">Approve</button>
          <button class="flex-1 bg-red-50 text-red-700 font-bold py-2 rounded-lg text-xs" onclick="processAdminDecision('${u.email}', 'declineUser')">Decline</button>
        </div>`;
      container.appendChild(row);
    });
  } catch (err) { console.error(err); }
}

window.processAdminDecision = async function(email, actionType) {
  if (!confirm(`Execute action?`)) return;
  try {
    const data = await transmitDataToBackend({ action: actionType, payload: { email } });
    if (data.success) { alert('Completed!'); await syncDataPipeline(); }
  } catch (err) { alert(`Error: ${err.message}`); }
};

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetTab = e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('text-green-600'); b.classList.add('text-gray-400'); });
    e.currentTarget.classList.remove('text-gray-400'); e.currentTarget.classList.add('text-green-600');
    Object.keys(tabs).forEach(k => tabs[k].classList.add('hidden'));
    tabs[targetTab].classList.remove('hidden');
  });
});

// GLOBAL STATE OVERSEER
window.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    // SECURITY PATCH LAYER: If state registration is currently active, bypass background loops completely
    if (isProcessingRegistration) return;

    if (user && !isHardcodedAdmin) { 
      currentUser = user; 
      await executeSecurityStatusAudit(); 
    } else if (!isHardcodedAdmin) { 
      switchView('public'); 
    }
  });
});
