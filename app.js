/**
Sundar Sehat Ata - Production Frontend Application Logic
Full Feature Set (Security Shield Patches, Worker Analytics, Auto-Timestamps & Rounding)
Hotfixes applied: Interceptor locks on Firebase auto-login race conditions, Base64 optimization, Client-Side Compression downscaler.
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
// Standard data post method
async function transmitDataToBackend(actionPayload) {
  const response = await fetch(GOOGLE_APPS_SCRIPT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(actionPayload),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`Network status fault: ${response.status}`);
  return await response.json();
}
// REAL-TIME PROGRESS TRANSMISSION CONTROLLER
function transmitDataWithProgress(actionPayload, onProgressCallback) {
  return new Promise(async (resolve, reject) => {
    let fakeProgress = 0;
    let progressInterval = null;
    try {
      progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + 12, 90);
        onProgressCallback(fakeProgress);
      }, 350);
      const response = await fetch(GOOGLE_APPS_SCRIPT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(actionPayload),
        redirect: 'follow'
      });

      clearInterval(progressInterval);
      progressInterval = null;

      if (!response.ok) {
        reject(new Error(`Server Status Error Node: ${response.status}`));
        return;
      }

      onProgressCallback(100);

      try {
        const data = await response.json();
        resolve(data);
      } catch (parseErr) {
        reject(new Error("Failed to clear server response text context."));
      }
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      reject(new Error("Registration failed. Please check your internet connection and try again."));
    }
  });
}
// DRIVE URL NORMALIZER
function normalizeDriveImageUrl(url) {
  if (!url) return "https://cdn-icons-png.flaticon.com/512/847/847969.png";
  if (url.indexOf('flaticon.com') > -1) return url;
  let fileId = null;
  if (url.indexOf('uc?') > -1 || url.indexOf('&id=') > -1) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match) fileId = match[1];
  }
  if (!fileId && url.indexOf('/file/d/') > -1) {
    const match = url.match(/\/file\/d\/([^/?]+)/);
    if (match) fileId = match[1];
  }
  if (!fileId && url.indexOf('open?id=') > -1) {
    const match = url.match(/open\?id=([^&]+)/);
    if (match) fileId = match[1];
  }
  if (!fileId && url.indexOf('thumbnail?id=') > -1) {
    const match = url.match(/thumbnail\?id=([^&]+)/);
    if (match) fileId = match[1];
  }
  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  return url;
}
// ============================================================
// WHATSAPP RECEIPT DISPATCHER
// ============================================================
function buildMillingReceiptText(data) {
  let targetDate = new Date(); // Automatically use current system timestamp
  const date = targetDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = targetDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  const strategyLabel = data.strategy === 'deduct' ? 'آٹا کٹوتی (Flour Deduct)' : 'نقد ادائیگی (Cash Payment)';
  return [
    `🌾 *Sundar Sehat Ata - گندم پسائی رسید*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `📅 تاریخ: ${date} ⏰ ${time}`,
    `👤 گاہک: ${data.name}`,
    `📞 رابطہ: ${data.phone}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `⚖️ گندم وزن: *${data.wheat} KG*`,
    `💰 ادائیگی طریقہ: ${strategyLabel}`,
    `📉 کٹوتی (10%): *${data.deduction} KG*`,
    `📦 پیشگی وصول: *${data.pickup} KG*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `✅ *آٹا باقی: ${data.flour} KG*`,
    data.cash > 0 ? `💵 *نقد رقم: PKR ${data.cash}*` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    `🛠️ آپریٹر: ${data.operatorName}`,
    `شکریہ! آپ کی خدمت ہماری ذمہ داری ہے 🙏 Developed By Naveed +923481496487`
  ].filter(Boolean).join('\n');
}
function buildSaleReceiptText(data) {
  let targetDate = new Date(); // Automatically use current system timestamp
  const date = targetDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = targetDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return [
    `🌾 *Sundar Sehat Ata - آٹا فروخت رسید*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `📅 تاریخ: ${date} ⏰ ${time}`,
    `👤 گاہک: ${data.name}`,
    `📞 رابطہ: ${data.phone}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `🛍️ آٹا مقدار: *${data.flour} KG*`,
    `💲 قیمت فی KG: PKR ${data.rate}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `💵 *کل رقم: PKR ${data.cash}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `🛠️ آپریٹر: ${data.operatorName}`,
    `شکریہ! آپ کی خدمت ہماری ذمہ داری ہے 🙏`
  ].join('\n');
}
function dispatchWhatsAppReceipt(phone, receiptText) {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '92' + normalized.slice(1);
  } else if (!normalized.startsWith('92')) {
    normalized = '92' + normalized;
  }
  const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(receiptText)}`;
  const a = document.createElement('a');
  a.href = waUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
}
// HIGH-SPEED CLIENT SIDE COMPRESSION DOWN-SCALER LOGIC
function compressAndResizeImage(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error("Image initialization failed."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File stream parsing loop broken."));
    reader.readAsDataURL(file);
  });
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
document.getElementById('signup-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusText = document.getElementById('upload-status-text');
  const submitBtn = forms.signup.querySelector('button[type="submit"]');
  statusText.classList.remove('hidden');
  statusText.className = "text-[10px] text-amber-600 font-bold mt-1";
  statusText.textContent = "⌛ Optimizing and compressing image file data...";
  if (submitBtn) submitBtn.disabled = true;
  try {
    uploadedImageUrl = await compressAndResizeImage(file, 800, 800, 0.7);
    statusText.textContent = "✅ Photo scaled & verified safely for submission transmission!";
    statusText.className = "text-[10px] text-green-600 font-bold mt-1";
  } catch (err) {
    statusText.textContent = "❌ Asset compression matrix execution fault.";
    statusText.className = "text-[10px] text-red-600 font-bold mt-1";
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
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
    document.getElementById('admin-management-features').classList.remove('hidden');
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
// SIGNUP ACTION WITH INTEGRATED STREAMS PROGRESS MAPPING
forms.signup.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!uploadedImageUrl) {
    alert("❌ Please attach a profile image asset block first.");
    return;
  }
  isProcessingRegistration = true;
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const whatsapp = document.getElementById('signup-whatsapp').value.trim();
  const pass = document.getElementById('signup-pass').value;
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const statusText = document.getElementById('upload-status-text');
  const submitBtn = forms.signup.querySelector('button[type="submit"]');
  if (progressContainer && progressBar && statusText) {
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    statusText.classList.remove('hidden');
    statusText.className = "text-[10px] text-emerald-600 font-bold mt-1";
    statusText.textContent = "🚀 Connecting to server data pipeline... 0%";
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Uploading data...";
  }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = userCredential.user.uid;
    const output = await transmitDataWithProgress({ 
      action: 'addUser', 
      payload: { name, email, whatsapp, dp: uploadedImageUrl, uid } 
    }, (percentage) => {
      if (progressBar && statusText) {
        progressBar.style.width = percentage + '%';
        if (percentage < 100) {
          statusText.textContent = `🚀 Uploading profile asset to system: ${percentage}%`;
        } else {
          statusText.className = "text-[10px] text-amber-600 font-bold mt-1 ";
          statusText.textContent = `(Finalizing) 100% Uploaded! Saving image file inside Google Drive...`;
        }
      }
    });

    if (output.success) { 
      alert("✅ Registration complete! Your account is pending Super Admin validation approval."); 
      forms.signup.reset();
      uploadedImageUrl = ""; 
      if (statusText) statusText.classList.add('hidden');
      if (progressContainer) progressContainer.classList.add('hidden');
      
      await auth.signOut();
      currentUser = null;
      currentProfileRole = 'user';
      currentOperatorDisplayName = "Staff Account Node ";

      switchView('pending'); 
    } else { 
      throw new Error(output.error || "Registration error."); 
    }
  } catch (err) {
    alert(`Registration Error: ${err.message}`);
    if (progressContainer) progressContainer.classList.add('hidden');
    if (statusText) {
      statusText.textContent = "❌ File transmission terminated.";
      statusText.className = "text-[10px] text-red-600 font-bold mt-1";
    }
    await auth.signOut();
    currentUser = null;
    switchView('public');
  } finally {
    isProcessingRegistration = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Send Request";
    }
  }
});
// ABSOLUTE SECURITY ACCESS CONTROLLER
async function executeSecurityStatusAudit() {
  if (!currentUser) {
    switchView('public');
    return;
  }
  try {
    const data = await transmitDataToBackend({
      action: 'checkUser',
      payload: { email: currentUser.email }
    });
    if (!data || !data.status || data.status === 'pending' || data.status === 'declined' || data.status === 'not_found') {
      await auth.signOut();
      currentUser = null;
      switchView('pending');
      return; 
    }

    currentProfileRole = data.role || 'user';
    currentOperatorDisplayName = data.name || "Staff Account Node"; 
    document.getElementById('user-avatar-top').src = normalizeDriveImageUrl(data.dp);
    document.getElementById('user-display-role').textContent = `👤 ${currentOperatorDisplayName}`;

    if (currentProfileRole === 'admin') {
      document.getElementById('super-admin-panel').classList.remove('hidden');
      document.getElementById('admin-management-features').classList.remove('hidden');
      document.getElementById('user-own-entries-panel').classList.add('hidden');
    } else {
      document.getElementById('super-admin-panel').classList.add('hidden');
      document.getElementById('admin-management-features').classList.add('hidden');
      document.getElementById('user-own-entries-panel').classList.remove('hidden');
    }

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
// DATA COMMIT: MILLING RUN
document.getElementById('btn-submit-milling').addEventListener('click', async () => {
  if (!currentUser) return alert("Session expired. Please log in again.");
  const name = document.getElementById('mill-cust-name').value.trim();
  const phone = document.getElementById('mill-cust-phone').value.trim();
  const wheat = parseFloat(millInputs.wheat.value) || 0;
  const pickup = parseFloat(millInputs.pickup.value) || 0;
  const rate = parseFloat(millInputs.rate.value) || 120;
  const strategy = millInputs.strategy.value;
  const sendWhatsApp = document.getElementById('chk-whatsapp-milling').checked;
  
  if (!name) return alert("❌ Specify Customer Name.");
  if (!phone || phone.length < 10) return alert("❌ Valid mobile contact number required.");
  if (isNaN(wheat) || wheat <= 0) return alert("❌ Wheat weight must exceed 0 KG.");
  const deduction = parseFloat((wheat * 0.10).toFixed(2));
  const cashVal = strategy === 'cash' ? parseFloat((deduction * rate).toFixed(2)) : 0;
  const finalFlour = parseFloat((strategy === 'deduct' ? (wheat - deduction - pickup) : (wheat - pickup)).toFixed(2));
  const entryTimestamp = new Date().toISOString(); // Automatically uses current system time
  
  const receiptText = sendWhatsApp ? buildMillingReceiptText({
  name, phone, wheat, pickup, strategy,
  deduction, cash: cashVal, flour: finalFlour,
  rate, operatorName: currentOperatorDisplayName
}) : null;

// Open blank window NOW (synchronous, trusted click context) to avoid popup blocker
let waWindow = null;
if (sendWhatsApp && receiptText) {
  waWindow = window.open('about:blank', '_blank');
}

try {
  const btn = document.getElementById('btn-submit-milling');
    btn.disabled = true; btn.innerText = "Saving data run...";
    const status = await transmitDataToBackend({
      action: 'addTransaction',
      payload: { 
        uid: currentUser.uid.trim(), 
        operatorName: currentOperatorDisplayName, 
        type: 'milling', 
        name, phone, wheat, pickup, strategy, deduction, cash: cashVal, flour: finalFlour, rate,
        date: entryTimestamp
      }
    });

    if (status.success) {
      document.getElementById('mill-cust-name').value = '';
      document.getElementById('mill-cust-phone').value = '';
      millInputs.wheat.value = '';
      millInputs.pickup.value = '0';
      runLiveMillingCalculations();
      await syncDataPipeline();

      if (sendWhatsApp && receiptText) {
  dispatchWhatsAppReceipt(phone, receiptText);
} else {
  alert("✅ Milling run updated successfully.");
}
    } else { alert("Error writing entry: " + status.error); }
  } catch (err) { alert(`Sync Failure: ${err.message}`); }
  finally {
    const btn = document.getElementById('btn-submit-milling');
    btn.disabled = false; btn.innerText = "💾 Save Milling Run گندم پسائی محفوظ کریں";
  }
});
// DATA COMMIT: CASH FLOUR SALE
document.getElementById('btn-submit-sale').addEventListener('click', async () => {
  if (!currentUser) return alert("Session expired. Please log in again.");
  const name = document.getElementById('sale-cust-name').value.trim();
  const qty = parseFloat(saleQtyInput.value) || 0;
  const rate = parseFloat(saleRateInput.value) || 120;
  const phone = document.getElementById('sale-cust-phone').value.trim();
  const sendWhatsApp = document.getElementById('chk-whatsapp-sale').checked;
  
  if (!name) return alert("❌ Customer Name required.");
  if (!phone || phone.length < 10) return alert("❌ Valid contact mobile line sequence required.");
  if (isNaN(qty) || qty <= 0) return alert("❌ Sale volume must exceed 0 KG.");
  const cashVal = parseFloat((qty * rate).toFixed(2));
  const entryTimestamp = new Date().toISOString(); // Automatically uses current system time
  
  const receiptText = sendWhatsApp ? buildSaleReceiptText({
    name, phone, flour: qty, rate, cash: cashVal,
    operatorName: currentOperatorDisplayName
  }) : null;
  
  try {
    const btn = document.getElementById('btn-submit-sale');
    btn.disabled = true; btn.innerText = "Logging sale run...";
    const status = await transmitDataToBackend({
      action: 'addTransaction',
      payload: { 
        uid: currentUser.uid.trim(), 
        operatorName: currentOperatorDisplayName, 
        type: 'sale', 
        name, flour: qty, rate, cash: cashVal, phone,
        date: entryTimestamp
      }
    });

    if (status.success) {
      document.getElementById('sale-cust-name').value = '';
      saleQtyInput.value = '';
      document.getElementById('sale-cust-phone').value = '';
      document.getElementById('calc-sale-bill').textContent = "PKR 0";
      await syncDataPipeline();

      if (sendWhatsApp && receiptText) {
        dispatchWhatsAppReceipt(phone, receiptText);
      } else {
        alert("✅ Flour Cash Sale logged!");
      }
    } else { alert("Error saving log: " + status.error); }
  } catch (err) { alert(`Sync Failure: ${err.message}`); }
  finally {
    const btn = document.getElementById('btn-submit-sale');
    btn.disabled = false; btn.innerText = "💾 Record Cash Sale";
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
    return `<div class="p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1 shadow-sm"> <div class="flex justify-between font-bold text-gray-800"> <span>🗓️ ${dateStr}</span> <span class="uppercase text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">${t.type}</span> </div> <p class="text-gray-600"><b>Customer:</b> ${t.name}</p> <div class="grid grid-cols-2 gap-1 pt-1 font-mono text-gray-500"> <div>Flour: ${(parseFloat(t.flour) || 0).toFixed(2)} KG</div> <div>Cash: PKR ${t.cash || 0}</div> </div> </div>`;
  }).join('');
});
// CORE MASTER SYNC CONTROLLER
async function syncDataPipeline() {
  try {
    const out = await transmitDataToBackend({ action: 'getTransactions' });
    const allData = out.data || [];
    globalWorkersList = out.workers || [];
    if (currentProfileRole === 'admin') {
      transactions = allData;
      await syncPendingAdminUsersList();
    } else {
      transactions = allData.filter(t => String(t.uid).trim().toLowerCase() === String(currentUser.uid).trim().toLowerCase());
    }

    executeEngineCalculations();
    renderLogsUI();
    renderWorkerAnalyticsDashboard();
    if (currentProfileRole !== 'admin') {
      renderUserOwnEntriesTable();
    }
  } catch (err) { console.error("Pipeline Sync Fault: ", err); }
}
// ADMINISTRATIVE FILTER SEARCH CONFIGURATION HOOKS
document.getElementById('admin-filter-search').addEventListener('input', renderWorkerAnalyticsDashboard);
document.getElementById('admin-filter-type').addEventListener('change', renderWorkerAnalyticsDashboard);
// WORKER ACCOUNTABILITY NODES WITH DROPDOWN EXPANSION TABLES ENGINE
function renderWorkerAnalyticsDashboard() {
  const workersListContainer = document.getElementById('admin-workers-list');
  if (!workersListContainer) return;
  const searchQuery = document.getElementById('admin-filter-search').value.trim().toLowerCase();
  const filterType = document.getElementById('admin-filter-type').value;
  if (globalWorkersList.length === 0) {
    workersListContainer.innerHTML = `<p class="text-[11px] text-gray-400 bg-gray-50 p-3 rounded-xl border text-center">No operators registered in the cloud ledger.</p>`;
    return;
  }
  // Calculate live overall analytics data matrix across the global system state
  let grandTotalWheat = 0;
  let grandTotalFlour = 0;
  let grandTotalDeduction = 0;
  let grandTotalCash = 0;
  transactions.forEach(t => {
    grandTotalWheat += (parseFloat(t.wheat) || 0);
    grandTotalFlour += (parseFloat(t.flour) || 0);
    grandTotalDeduction += (parseFloat(t.deduction) || 0);
    grandTotalCash += (parseFloat(t.cash) || 0);
  });
  // Inject computed values safely into inventory layout counters
  const adminTotalWheatEl = document.getElementById('admin-total-wheat');
  const adminTotalFlourEl = document.getElementById('admin-total-flour');
  const adminTotalDeductionEl = document.getElementById('admin-total-deduction');
  const adminTotalCashEl = document.getElementById('admin-total-cash');
  if (adminTotalWheatEl) adminTotalWheatEl.textContent = `${grandTotalWheat.toFixed(2)} KG`;
  if (adminTotalFlourEl) adminTotalFlourEl.textContent = `${grandTotalFlour.toFixed(2)} KG`;
  if (adminTotalDeductionEl) adminTotalDeductionEl.textContent = `${grandTotalDeduction.toFixed(2)} KG`;
  if (adminTotalCashEl) adminTotalCashEl.textContent = `PKR ${grandTotalCash.toLocaleString()}`;
  let finalContainerHtml = "";
  let totalMatchRecordsCounter = 0;
  globalWorkersList.forEach((worker, index) => {
    // Filter transactions assigned explicitly to this worker node reference identity
    let workerTxns = transactions.filter(t => String(t.uid).trim().toLowerCase() === String(worker.uid).trim().toLowerCase());
    // Apply global administrative search string filter criteria matrix rules
    if (searchQuery || filterType !== 'all') {
      workerTxns = workerTxns.filter(t => {
        const matchesText = (t.name || '').toLowerCase().includes(searchQuery) || (t.phone || '').toLowerCase().includes(searchQuery);
        const matchesType = (filterType === 'all') || (t.type === filterType);
        return matchesText && matchesType;
      });
    }

    totalMatchRecordsCounter += workerTxns.length;

    // Compile worker-specific analytical parameters
    const totalWorkerCash = workerTxns.reduce((sum, t) => sum + (parseFloat(t.cash) || 0), 0);
    const totalWorkerFlour = workerTxns.reduce((sum, t) => sum + (parseFloat(t.flour) || 0), 0);

    // Build the accordion list entry layout row sequence structure
    finalContainerHtml += `
       <div class="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
         <div class="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 active:bg-gray-200/70 transition-all select-none" onclick="toggleWorkerDropdownTable(${index})">
           <div class="flex items-center gap-3">
             <img src="${normalizeDriveImageUrl(worker.dp)}" class="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30 shadow-sm shrink-0">
             <div>
               <p class="font-black text-gray-900 text-sm">${worker.name}</p>
               <p class="text-[10px] text-gray-400 font-mono tracking-wide mt-0.5">${worker.email}</p>
             </div>
           </div>
           <div class="text-right flex items-center gap-3">
             <div class="text-xs">
               <p class="font-extrabold text-emerald-700">PKR ${totalWorkerCash.toLocaleString()}</p>
               <p class="text-[10px] text-gray-400 font-bold mt-0.5">${totalWorkerFlour.toFixed(2)} KG</p>
             </div>
             <span id="worker-arrow-${index}" class="text-gray-400 text-xs transition-transform duration-200 transform rotate-0">▼</span>
           </div>
         </div>

         <div id="worker-dropdown-${index}" class="hidden border-t border-gray-100 bg-white transition-all overflow-hidden">
           <div class="p-3 scroll-container overflow-x-auto">
            ${workerTxns.length === 0 ? `
               <p class="text-center text-[11px] text-gray-400 py-4 font-medium">No customer matching entries logged by this node.</p>
            ` : `
               <table class="w-full text-[11px] text-left border-collapse min-w-[850px]">
                 <thead>
                   <tr class="bg-emerald-800 text-white font-bold uppercase tracking-wider text-[10px]">
                     <th class="p-2 rounded-l-lg text-center">Sr.#</th>
                     <th class="p-2">Name</th>
                     <th class="p-2">Phone</th>
                     <th class="p-2 text-center">Type</th>
                     <th class="p-2 text-center whitespace-nowrap">Date & Time</th>
                     <th class="p-2 text-right">Wheat (KG)</th>
                     <th class="p-2 text-right">Charges (KG)</th>
                     <th class="p-2 text-right">Final Flour</th>
                     <th class="p-2 text-right">Cash</th>
                     <th class="p-2 rounded-r-lg text-center">Strategy</th>
                   </tr>
                 </thead>
                 <tbody class="divide-y divide-gray-100 font-medium text-gray-700">
                  ${workerTxns.map((t, idx) => {
                    const wheatVal = t.wheat ? parseFloat(t.wheat).toFixed(2) : '-';
                    const chargeVal = t.type === 'milling' ? (parseFloat(t.deduction) || (parseFloat(t.wheat) * 0.10) || 0).toFixed(2) : '-';
                    const flourReturnedVal = t.flour ? parseFloat(t.flour).toFixed(2) : '0.00';
                    const cashVal = t.cash ? parseInt(t.cash).toLocaleString() : '0';
                    const strategyLabel = t.strategy ? t.strategy : (t.type === 'sale' ? 'Direct Sale' : 'Deduct');
                    const dateStr = t.date ? new Date(t.date).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
                    return `
                      <tr class="hover:bg-slate-50/80 transition-colors">
                        <td class="p-2 text-center font-mono font-bold text-gray-400">${idx + 1}</td>
                        <td class="p-2 font-black text-gray-900 capitalize">${t.name}</td>
                        <td class="p-2 font-mono tracking-tight">${t.phone || 'N/A'}</td>
                        <td class="p-2 text-center">
                          <span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full ${t.type === 'milling' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}">${t.type}</span>
                        </td>
                        <td class="p-2 text-center font-mono text-xs whitespace-nowrap">${dateStr}</td>
                        <td class="p-2 text-right font-mono font-bold">${wheatVal}</td>
                        <td class="p-2 text-right font-mono font-bold text-amber-600">${chargeVal === '-' ? '-' : chargeVal + ' KG'}</td>
                        <td class="p-2 text-right font-mono font-bold text-emerald-700">${flourReturnedVal} KG</td>
                        <td class="p-2 text-right font-mono font-bold text-gray-900">Rs. ${cashVal}</td>
                        <td class="p-2 text-center capitalize text-[10px] font-bold ${strategyLabel === 'cash' ? 'text-blue-600' : 'text-gray-500'}">${strategyLabel}</td>
                      </tr>
                    `;
                  }).join('')}
                 </tbody>
               </table>
            `}
           </div>
         </div>
       </div>
    `;
  });
  workersListContainer.innerHTML = finalContainerHtml;
  // Render match diagnostic counts counter view element configuration hooks
  const countDisplay = document.getElementById('admin-filter-results-count');
  if (countDisplay) {
    if (searchQuery || filterType !== 'all') {
      countDisplay.classList.remove('hidden');
      countDisplay.textContent = `⚡ Search Matrix: Located ${totalMatchRecordsCounter} active record logs context.`;
    } else {
      countDisplay.classList.add('hidden');
    }
  }
}
// USER OWN ENTRIES TABLE RENDERER (for regular users in Admin tab)
function renderUserOwnEntriesTable() {
  const container = document.getElementById('user-entries-table-container');
  if (!container) return;
  const searchQuery = (document.getElementById('user-entries-search') || {value:''}).value.trim().toLowerCase();
  const filterType = (document.getElementById('user-entries-filter-type') || {value:'all'}).value;
  const countDisplay = document.getElementById('user-entries-count');
  // Get only this user's entries
  let userTxns = transactions.filter(t =>
    String(t.uid).trim().toLowerCase() === String(currentUser.uid).trim().toLowerCase()
  );
  // Apply search & type filter
  if (searchQuery || filterType !== 'all') {
    userTxns = userTxns.filter(t => {
      const matchesText = (t.name || '').toLowerCase().includes(searchQuery) ||
                          (t.phone || '').toLowerCase().includes(searchQuery);
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesText && matchesType;
    });
  }
  // Update summary totals (based on ALL user entries, not filtered)
  let totalWheat = 0, totalFlour = 0, totalDeduction = 0, totalCash = 0;
  transactions.forEach(t => {
    if (String(t.uid).trim().toLowerCase() !== String(currentUser.uid).trim().toLowerCase()) return;
    totalWheat += (parseFloat(t.wheat) || 0);
    totalFlour += (parseFloat(t.flour) || 0);
    totalDeduction += (parseFloat(t.deduction) || 0);
    totalCash += (parseFloat(t.cash) || 0);
  });
  const wEl = document.getElementById('user-own-total-wheat'); if (wEl) wEl.textContent = `${totalWheat.toFixed(2)} KG`;
  const fEl = document.getElementById('user-own-total-flour'); if (fEl) fEl.textContent = `${totalFlour.toFixed(2)} KG`;
  const dEl = document.getElementById('user-own-total-deduction'); if (dEl) dEl.textContent = `${totalDeduction.toFixed(2)} KG`;
  const cEl = document.getElementById('user-own-total-cash'); if (cEl) cEl.textContent = `PKR ${totalCash.toLocaleString()}`;
  // Update count badge
  if (countDisplay) {
    if (searchQuery || filterType !== 'all') {
      countDisplay.classList.remove('hidden');
      countDisplay.textContent = `⚡ Found ${userTxns.length} matching record${userTxns.length !== 1 ? 's' : ''}`;
    } else { countDisplay.classList.add('hidden'); }
  }
  if (userTxns.length === 0) {
    container.innerHTML = `<p class="text-center text-[11px] text-gray-400 py-8 font-medium">${searchQuery || filterType !== 'all' ? 'No entries match your search.' : 'You have not submitted any entries yet.'}</p>`;
    return;
  }
  const rows = userTxns.map((t, idx) => {
    const wheatVal = t.wheat ? parseFloat(t.wheat).toFixed(2) : '-';
    const chargeVal = t.type === 'milling' ? (parseFloat(t.deduction) || (parseFloat(t.wheat) * 0.10) || 0).toFixed(2) : '-';
    const flourReturnedVal = t.flour ? parseFloat(t.flour).toFixed(2) : '0.00';
    const cashVal = t.cash ? parseInt(t.cash).toLocaleString() : '0';
    const strategyLabel = t.strategy ? t.strategy : (t.type === 'sale' ? 'Direct Sale' : 'Deduct');
    const dateStr = t.date ? new Date(t.date).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
    return `<tr class="hover:bg-slate-50/80 transition-colors">
      <td class="p-2 text-center font-mono font-bold text-gray-400">${idx + 1}</td>
      <td class="p-2 font-black text-gray-900 capitalize">${t.name}</td>
      <td class="p-2 font-mono tracking-tight">${t.phone || 'N/A'}</td>
      <td class="p-2 text-center"><span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full ${t.type === 'milling' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}">${t.type}</span></td>
      <td class="p-2 text-center font-mono text-xs whitespace-nowrap">${dateStr}</td>
      <td class="p-2 text-right font-mono font-bold">${wheatVal}</td>
      <td class="p-2 text-right font-mono font-bold text-amber-600">${chargeVal === '-' ? '-' : chargeVal + ' KG'}</td>
      <td class="p-2 text-right font-mono font-bold text-emerald-700">${flourReturnedVal} KG</td>
      <td class="p-2 text-right font-mono font-bold text-gray-900">Rs. ${cashVal}</td>
      <td class="p-2 text-center capitalize text-[10px] font-bold ${strategyLabel === 'cash' ? 'text-blue-600' : 'text-gray-500'}">${strategyLabel}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table class="w-full text-[11px] text-left border-collapse min-w-[850px]">
    <thead><tr class="bg-emerald-800 text-white font-bold uppercase tracking-wider text-[10px]">
      <th class="p-2 rounded-l-lg text-center">Sr.#</th>
      <th class="p-2">Customer Name</th>
      <th class="p-2">Phone</th>
      <th class="p-2 text-center">Type</th>
      <th class="p-2 text-center whitespace-nowrap">Date & Time</th>
      <th class="p-2 text-right">Wheat (KG)</th>
      <th class="p-2 text-right">Charges (KG)</th>
      <th class="p-2 text-right">Final Flour</th>
      <th class="p-2 text-right">Cash</th>
      <th class="p-2 rounded-r-lg text-center">Strategy</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-100 font-medium text-gray-700">${rows}</tbody>
  </table>`;
}
// Event listeners for user own entries search/filter
document.addEventListener('DOMContentLoaded', () => {
  const userEntriesSearchEl = document.getElementById('user-entries-search');
  const userEntriesFilterEl = document.getElementById('user-entries-filter-type');
  if (userEntriesSearchEl) userEntriesSearchEl.addEventListener('input', renderUserOwnEntriesTable);
  if (userEntriesFilterEl) userEntriesFilterEl.addEventListener('change', renderUserOwnEntriesTable);
});
// DROPDOWN ACCORDION SLIDE SLOT ANIMATOR FUNCTION TARGET HOOK
window.toggleWorkerDropdownTable = function(index) {
  const dropdownPanel = document.getElementById(`worker-dropdown-${index}`);
  const arrowIndicator = document.getElementById(`worker-arrow-${index}`);
  if (!dropdownPanel || !arrowIndicator) return;
  if (dropdownPanel.classList.contains('hidden')) {
    dropdownPanel.classList.remove('hidden');
    arrowIndicator.classList.remove('rotate-0');
    arrowIndicator.classList.add('rotate-180');
    arrowIndicator.textContent = "▲";
  } else {
    dropdownPanel.classList.add('hidden');
    arrowIndicator.classList.remove('rotate-180');
    arrowIndicator.classList.add('rotate-0');
    arrowIndicator.textContent = "▼";
  }
};
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
    if (!t.date) return false;
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
  // Calculate separate profit types based on user criteria splits
  let cashRevenueTotal = 0;
  let flourChargesRevenueTotal = 0; // Tracks deduction weight kept by chaki
  filtered.forEach(t => {
    cashRevenueTotal += (parseFloat(t.cash) || 0);
    if (t.type === 'milling' && t.strategy === 'deduct') {
      flourChargesRevenueTotal += (parseFloat(t.deduction) || (parseFloat(t.wheat) * 0.10) || 0);
    }
  });
  document.getElementById('profit-output').innerHTML = `<div class="text-sm flex flex-col gap-1 items-center"> <div class="text-[10px] uppercase text-emerald-300 tracking-wider font-bold">Range Profit Breakdowns (${activeRange})</div> <div class="mt-2 text-base font-black text-white">💵 Cash Form Earnings: PKR ${cashRevenueTotal.toLocaleString()}</div> <div class="text-xs text-emerald-100 font-medium">🌾 Flour Charges Form: ${flourChargesRevenueTotal.toFixed(2)} KG Retained</div> </div>`;
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
    if (!t.name || (!t.cash && !t.flour && !t.wheat)) return;
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center text-xs active:bg-gray-100 cursor-pointer transition-all hover:border-emerald-200 mb-2";
    card.addEventListener('click', () => displaySpecificRecordDetails(t));
    let dateStr = "N/A"; if (t.date) { const d = new Date(t.date); if (!isNaN(d.getTime())) dateStr = d.toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } 

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
  currentSelectedRecord = t;
  const body = document.getElementById('modal-content-body');
  let dateStr = "N/A"; if (t.date) { const d = new Date(t.date); if (!isNaN(d.getTime())) dateStr = d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  const standardizedDeduction = typeof t.deduction === 'number' ? t.deduction.toFixed(2) : parseFloat(t.deduction || 0).toFixed(2);
  const standardizedFlour = typeof t.flour === 'number' ? t.flour.toFixed(2) : parseFloat(t.flour || 0).toFixed(2);
  const standardizedWheat = typeof t.wheat === 'number' ? t.wheat.toFixed(2) : parseFloat(t.wheat || 0).toFixed(2);
  let layoutFields = `<div class="bg-slate-50 p-3 rounded-xl border space-y-1.5 font-mono"> <div><b>Invoiced Date/Time:</b> ${dateStr}</div> <div><b>Log ID Item:</b> ${t.id || 'N/A'}</div> <div><b>Operator Node:</b> ${t.operatorName || 'Staff Account Node'}</div> </div> <div class="space-y-2 pt-2"> <div class="flex justify-between border-b pb-1"><span>Customer Account:</span><span class="font-bold text-gray-900">${t.name}</span></div> <div class="flex justify-between border-b pb-1"><span>Contact Line:</span><span class="font-semibold">${t.phone || 'N/A'}</span></div> <div class="flex justify-between border-b pb-1"><span>Transaction Category:</span><span class="uppercase font-black text-emerald-700">${t.type === 'milling' ? 'MILLING' : 'SALE'}</span></div>`;
  if (t.type === 'milling') {
    layoutFields += `<div class="flex justify-between border-b pb-1"><span>Wheat Weight:</span><span class="font-bold">${standardizedWheat} KG</span></div> <div class="flex justify-between border-b pb-1"><span>Strategy:</span><span class="capitalize text-blue-700 font-bold">${t.strategy || 'Deduct'}</span></div> <div class="flex justify-between border-b pb-1"><span class="text-red-600 font-medium">Flour Charges (10%):</span><span class="text-red-600 font-bold">${standardizedDeduction} KG</span></div> <div class="flex justify-between border-b pb-1"><span>Advance Collected:</span><span>${t.pickup || 0} KG</span></div>`;
  }
  layoutFields += `<div class="flex justify-between border-b pb-1"><span>Active Pricing Rate:</span><span>PKR ${t.rate || 120} / KG</span></div> <div class="flex justify-between border-b pb-1"><span>Final Flour Returned:</span><span class="font-bold text-amber-700">${standardizedFlour} KG</span></div> <div class="flex justify-between pt-2 text-sm font-black text-green-700"><span>Net Cash Revenue:</span><span>PKR ${t.cash || 0}</span></div> </div>`;
  body.innerHTML = layoutFields;
  views.detailsModal.classList.remove('hidden');
}
// DATA AMENDMENT RENDER INTERCEPTORS
document.getElementById('btn-delete-record').addEventListener('click', async () => {
  if (!currentSelectedRecord) return;
  if (currentProfileRole !== 'admin' && currentSelectedRecord.uid !== currentUser.uid) return alert("Security Guard: Access denied.");
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
  if (currentProfileRole !== 'admin' && currentSelectedRecord.uid !== currentUser.uid) return alert("Security Guard: Access denied.");
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
    const container = document.getElementById('pending-users-list'); 
    if (!container) return; 
    container.innerHTML = '';
    const out = await transmitDataToBackend({ action: 'getPendingUsers' }); 
    const list = out.users || [];
    if (list.length === 0) { container.innerHTML = '<p class="text-[11px] text-gray-400 text-center py-2">No pending workers.</p>'; return; }
    list.forEach(u => {
      const row = document.createElement('div'); 
      row.className = "bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 text-left mb-2";
      row.innerHTML = `<div class="flex items-start gap-3"> <img src="${normalizeDriveImageUrl(u.dp)}" class="w-10 h-10 rounded-full border object-cover shrink-0"> <div class="min-w-0 flex-1"> <p class="font-bold text-gray-800 text-sm truncate">${u.name || 'Staff'}</p> <p class="text-[11px] text-gray-600 font-mono break-all"><b>Email:</b> ${u.email}</p> </div> </div> <div class="flex gap-2"> <button class="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg text-xs" onclick="processAdminDecision('${u.email}', 'approveUser')">Approve</button> <button class="flex-1 bg-red-50 text-red-700 font-bold py-2 rounded-lg text-xs" onclick="processAdminDecision('${u.email}', 'declineUser')">Decline</button> </div>`;
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
    if (isProcessingRegistration) return;
    if (user && !isHardcodedAdmin) { 
      currentUser = user; 
      await executeSecurityStatusAudit(); 
    } else if (!isHardcodedAdmin) { 
      switchView('public'); 
    }
  });
});
