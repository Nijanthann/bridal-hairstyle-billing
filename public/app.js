// Bridal Billing Studio - Application Logic
const API_BASE = window.location.origin;

// State
let currentUser = null;
let currentToken = localStorage.getItem('bridal_billing_token') || localStorage.getItem('zoho_bridal_token');
let currentTab = 'dashboard';
let currentFilter = 'ALL';
let searchDebounceTimeout = null;
let currentEditingInvoiceId = null;
let activePaymentInvoice = null;
let qrcodeInstance = null;

// Default services structure for invoice builder
let services = [
  { desc: "Bridal Hairstyling", qty: "1", rate: "12000" },
  { desc: "Hair Trial", qty: "1", rate: "3000" },
  { desc: "Bridesmaid Hairstyling", qty: "2", rate: "2500" },
  { desc: "Travel Charges", qty: "1", rate: "1500" }
];

// Helper: Format Currency (INR)
function formatCurrency(val) {
  return "₹" + Number(val || 0).toLocaleString("en-IN");
}

// Helper: Show Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-stone-900 text-white' : (type === 'error' ? 'bg-red-600 text-white' : 'bg-gold-700 text-white');
  const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info');

  toast.className = `toast px-4 py-3 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 ${bg}`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Authenticated Fetch Wrapper
async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (currentToken) {
    options.headers['Authorization'] = `Bearer ${currentToken}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, options);
  if (response.status === 401) {
    handleLogout();
    throw new Error('Session expired. Please log in.');
  }
  return response;
}

// ================= AUTHENTICATION =================

async function checkAuth() {
  if (!currentToken) {
    openAuthModal('login');
    return;
  }
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) throw new Error();
    const data = await res.json();
    setCurrentUser(data.user);
    closeAuthModal();
    initApp();
  } catch (err) {
    currentToken = null;
    localStorage.removeItem('bridal_billing_token');
    localStorage.removeItem('zoho_bridal_token');
    openAuthModal('login');
  }
}

function setCurrentUser(user) {
  currentUser = user;
  
  // Update Topbar
  const brandName = user.business_name || 'Bridal Billing';
  document.getElementById('topbar-brand-name').innerText = brandName;
  document.getElementById('topbar-tagline').innerText = user.tagline || 'Hairstyling & Invoice Studio';
  document.getElementById('user-display-name').innerText = user.name.split(' ')[0] || user.username;
  document.getElementById('user-business-display').innerText = brandName;
  document.getElementById('user-avatar-initials').innerText = (user.name[0] || user.username[0] || 'U').toUpperCase();
  document.getElementById('dd-user-name').innerText = user.name;
  document.getElementById('dd-user-email').innerText = user.email;

  // Update banner
  if (document.getElementById('banner-user-name')) document.getElementById('banner-user-name').innerText = user.name;
  if (document.getElementById('banner-business-name')) document.getElementById('banner-business-name').innerText = brandName;
  document.getElementById('dash-welcome').innerText = `Welcome back, ${user.name.split(' ')[0]} 👋`;

  // Pre-fill Invoice Editor inputs with user profile defaults
  syncUserProfileToForm();
}

function syncUserProfileToForm() {
  if (!currentUser) return;
  const stylistInput = document.getElementById('in_stylist');
  const taglineInput = document.getElementById('in_tagline');
  const phoneInput = document.getElementById('in_studio_phone');
  const emailInput = document.getElementById('in_studio_email');
  const cityInput = document.getElementById('in_studio_city');
  const upiInput = document.getElementById('in_upi');
  const bankInput = document.getElementById('in_bank');
  const accNameInput = document.getElementById('in_acc_name');
  const accNoInput = document.getElementById('in_acc_no');
  const ifscInput = document.getElementById('in_ifsc');
  const instaInput = document.getElementById('in_insta');
  const footerPhoneInput = document.getElementById('in_footer_phone');

  if (stylistInput && !currentEditingInvoiceId) stylistInput.value = currentUser.business_name || currentUser.name;
  if (taglineInput && !currentEditingInvoiceId) taglineInput.value = currentUser.tagline || '';
  if (phoneInput && !currentEditingInvoiceId) phoneInput.value = currentUser.phone || '';
  if (emailInput && !currentEditingInvoiceId) emailInput.value = currentUser.email_contact || currentUser.email || '';
  if (cityInput && !currentEditingInvoiceId) cityInput.value = currentUser.city || '';
  if (upiInput && !currentEditingInvoiceId) upiInput.value = currentUser.upi_id || '';
  if (bankInput && !currentEditingInvoiceId) bankInput.value = currentUser.bank_name || '';
  if (accNameInput && !currentEditingInvoiceId) accNameInput.value = currentUser.acc_name || '';
  if (accNoInput && !currentEditingInvoiceId) accNoInput.value = currentUser.acc_no || '';
  if (ifscInput && !currentEditingInvoiceId) ifscInput.value = currentUser.ifsc || '';
  if (instaInput && !currentEditingInvoiceId) instaInput.value = currentUser.instagram || '';
  if (footerPhoneInput && !currentEditingInvoiceId) footerPhoneInput.value = currentUser.phone || '';

  // Settings tab inputs
  populateSettingsForm();
  updateInvoice();
}

function populateSettingsForm() {
  if (!currentUser) return;
  document.getElementById('set_name').value = currentUser.name || '';
  document.getElementById('set_business_name').value = currentUser.business_name || '';
  document.getElementById('set_tagline').value = currentUser.tagline || '';
  document.getElementById('set_phone').value = currentUser.phone || '';
  document.getElementById('set_email_contact').value = currentUser.email_contact || '';
  document.getElementById('set_city').value = currentUser.city || '';
  document.getElementById('set_instagram').value = currentUser.instagram || '';
  document.getElementById('set_upi_id').value = currentUser.upi_id || '';
  document.getElementById('set_bank_name').value = currentUser.bank_name || '';
  document.getElementById('set_acc_name').value = currentUser.acc_name || '';
  document.getElementById('set_acc_no').value = currentUser.acc_no || '';
  document.getElementById('set_ifsc').value = currentUser.ifsc || '';
  document.getElementById('set_invoice_prefix').value = currentUser.invoice_prefix || 'INV-';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const login = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    currentToken = data.token;
    localStorage.setItem('bridal_billing_token', currentToken);
    setCurrentUser(data.user);
    closeAuthModal();
    showToast(data.message || 'Login successful!');
    initApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    username: document.getElementById('reg-username').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    business_name: document.getElementById('reg-business').value.trim()
  };

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    currentToken = data.token;
    localStorage.setItem('bridal_billing_token', currentToken);
    setCurrentUser(data.user);
    closeAuthModal();
    showToast('Account registered successfully!');
    initApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}



function handleLogout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('bridal_billing_token');
  localStorage.removeItem('zoho_bridal_token');
  closeUserDropdown();
  openAuthModal('login');
  showToast('Logged out of system.', 'info');
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('modal-auth');
  modal.classList.remove('hidden');
  switchAuthMode(mode);
}

function closeAuthModal() {
  document.getElementById('modal-auth').classList.add('hidden');
}



function switchAuthMode(mode) {
  const tabLogin = document.getElementById('auth-tab-login');
  const tabReg = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');

  if (mode === 'login') {
    tabLogin.className = 'flex-1 pb-2 border-b-2 border-stone-900 text-stone-900 font-semibold';
    tabReg.className = 'flex-1 pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-700';
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  } else {
    tabReg.className = 'flex-1 pb-2 border-b-2 border-gold-600 text-gold-900 font-semibold';
    tabLogin.className = 'flex-1 pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-700';
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

function toggleUserDropdown() {
  const dd = document.getElementById('user-dropdown-menu');
  dd.classList.toggle('hidden');
}

function closeUserDropdown() {
  const dd = document.getElementById('user-dropdown-menu');
  if (dd) dd.classList.add('hidden');
}

// Close dropdown on outside click
window.addEventListener('click', (e) => {
  const userMenuBtn = document.getElementById('user-menu-btn');
  const dd = document.getElementById('user-dropdown-menu');
  if (userMenuBtn && dd && !userMenuBtn.contains(e.target) && !dd.contains(e.target)) {
    dd.classList.add('hidden');
  }
});

// ================= NAVIGATION =================

function navigateTo(tab) {
  currentTab = tab;
  closeUserDropdown();

  // Switch tab panes
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`view-${tab}`);
  if (target) target.classList.add('active');

  // Update nav buttons
  const tabs = ['dashboard', 'invoices', 'editor', 'settings'];
  tabs.forEach(t => {
    const desktopBtn = document.getElementById(`nav-btn-${t}`);
    const mobBtn = document.getElementById(`mob-nav-${t}`);
    
    if (t === tab) {
      if (desktopBtn) {
        desktopBtn.className = 'nav-tab-btn px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-stone-900 bg-white shadow-xs font-semibold';
      }
      if (mobBtn) {
        mobBtn.className = 'flex flex-col items-center gap-0.5 text-gold-700 font-semibold p-1';
      }
    } else {
      if (desktopBtn) {
        desktopBtn.className = 'nav-tab-btn px-3 py-1.5 rounded-md flex items-center gap-1.5 transition hover:text-stone-900 text-stone-600';
      }
      if (mobBtn) {
        mobBtn.className = 'flex flex-col items-center gap-0.5 text-stone-500 p-1';
      }
    }
  });

  if (tab === 'dashboard') {
    fetchDashboardStats();
  } else if (tab === 'invoices') {
    fetchInvoices();
  } else if (tab === 'editor') {
    updateInvoice();
  } else if (tab === 'settings') {
    populateSettingsForm();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= DASHBOARD & STATS =================

async function fetchDashboardStats() {
  try {
    const res = await authFetch('/api/dashboard/stats');
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderDashboard(data.stats, data.recentInvoices);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

function renderDashboard(stats, recentInvoices) {
  document.getElementById('stat-total-invoiced').innerText = formatCurrency(stats.totalInvoiced);
  document.getElementById('stat-total-received').innerText = formatCurrency(stats.totalReceived);
  document.getElementById('stat-total-due').innerText = formatCurrency(stats.totalBalanceDue);
  document.getElementById('stat-invoice-count').innerText = `${stats.totalInvoices} Invoices`;
  document.getElementById('stat-paid-count').innerText = stats.countPaid;
  document.getElementById('stat-partial-count').innerText = `${stats.countPartiallyPaid} partial`;
  document.getElementById('stat-unpaid-count').innerText = `${stats.countUnpaid} unpaid`;
  document.getElementById('stat-due-count').innerText = `${stats.countPartiallyPaid + stats.countUnpaid} pending`;

  // Update header badges
  document.getElementById('nav-invoices-badge').innerText = stats.totalInvoices;
  document.getElementById('cnt-filter-all').innerText = stats.totalInvoices;
  document.getElementById('cnt-filter-paid').innerText = stats.countPaid;
  document.getElementById('cnt-filter-partial').innerText = stats.countPartiallyPaid;
  document.getElementById('cnt-filter-unpaid').innerText = stats.countUnpaid;

  // Collection Progress Bar
  const total = stats.totalInvoiced || 1;
  const receivedPct = Math.min(100, Math.round((stats.totalReceived / total) * 100));
  const duePct = Math.max(0, 100 - receivedPct);

  document.getElementById('bar-received').style.width = `${receivedPct}%`;
  document.getElementById('bar-due').style.width = `${duePct}%`;
  document.getElementById('stat-collection-percent').innerText = `${receivedPct}% Collected (${formatCurrency(stats.totalReceived)} / ${formatCurrency(stats.totalInvoiced)})`;

  // Render Recent Invoices
  const tbody = document.getElementById('dash-recent-table');
  tbody.innerHTML = '';
  if (!recentInvoices || recentInvoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-stone-400">No invoices yet. Click "Create Invoice" to start!</td></tr>`;
    return;
  }

  recentInvoices.forEach(inv => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-stone-50/80 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-semibold text-stone-900">${inv.invoice_number}</td>
      <td class="py-2.5 px-4">
        <div class="font-medium text-stone-800">${inv.client_name}</div>
        <div class="text-[10px] text-stone-500">${inv.client_phone || '-'}</div>
      </td>
      <td class="py-2.5 px-4 text-stone-600">${inv.invoice_date}</td>
      <td class="py-2.5 px-4 text-right font-medium">${formatCurrency(inv.total_amount)}</td>
      <td class="py-2.5 px-4 text-right font-bold ${inv.balance_due > 0 ? 'text-amber-800' : 'text-emerald-700'}">${formatCurrency(inv.balance_due)}</td>
      <td class="py-2.5 px-4 text-center">${renderStatusBadge(inv.status)}</td>
      <td class="py-2.5 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          ${inv.balance_due > 0 ? `
            <button onclick="openRecordPaymentModal(${inv.id})" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded border border-emerald-200">
              Pay
            </button>
          ` : ''}
          <button onclick="loadInvoiceForEdit(${inv.id})" class="p-1 text-stone-500 hover:text-stone-900 rounded" title="View & Edit">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function renderStatusBadge(status) {
  if (status === 'PAID') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> PAID</span>`;
  } else if (status === 'PARTIALLY_PAID') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span> PARTIAL</span>`;
  }
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-600"></span> UNPAID</span>`;
}

// ================= INVOICES MANAGEMENT =================

function setInvoiceFilter(status) {
  currentFilter = status;
  document.querySelectorAll('.inv-filter-btn').forEach(btn => {
    btn.className = 'inv-filter-btn px-3 py-1 rounded-md text-stone-600 hover:bg-stone-100 transition';
  });
  const activeBtn = document.getElementById(`filter-btn-${status}`);
  if (activeBtn) {
    activeBtn.className = 'inv-filter-btn px-3 py-1 rounded-md font-semibold bg-stone-900 text-white transition';
  }
  fetchInvoices();
}

function debounceSearch() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    fetchInvoices();
  }, 300);
}

async function fetchInvoices() {
  const search = document.getElementById('invoice-search-input').value.trim();
  const sort = document.getElementById('invoice-sort-select').value;

  let url = `/api/invoices?sort=${sort}`;
  if (currentFilter !== 'ALL') {
    url += `&status=${currentFilter}`;
  }
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const res = await authFetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderInvoicesTable(data.invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err);
  }
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-table-body');
  const emptyState = document.getElementById('invoices-empty-state');
  tbody.innerHTML = '';

  if (!invoices || invoices.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  invoices.forEach(inv => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-stone-50 transition';
    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-stone-900 whitespace-nowrap">
        <a href="javascript:void(0)" onclick="loadInvoiceForEdit(${inv.id})" class="text-gold-700 hover:underline">
          ${inv.invoice_number}
        </a>
      </td>
      <td class="py-3 px-4 whitespace-nowrap text-stone-600">
        <div>${inv.invoice_date}</div>
        ${inv.service_date ? `<div class="text-[10px] text-gold-700 font-medium">Service: ${inv.service_date}</div>` : ''}
      </td>
      <td class="py-3 px-4">
        <div class="font-bold text-stone-900">${inv.client_name}</div>
        <div class="text-[10px] text-stone-500">${inv.client_phone || '-'} ${inv.client_email ? `• ${inv.client_email}` : ''}</div>
      </td>
      <td class="py-3 px-4 text-stone-600">
        <div>${inv.event_venue || '-'}</div>
        <div class="text-[10px] text-stone-500">${inv.event_location || ''}</div>
      </td>
      <td class="py-3 px-4 text-right font-semibold text-stone-900 whitespace-nowrap">${formatCurrency(inv.total_amount)}</td>
      <td class="py-3 px-4 text-right text-emerald-700 font-medium whitespace-nowrap">${formatCurrency(inv.advance_paid)}</td>
      <td class="py-3 px-4 text-right font-bold whitespace-nowrap ${inv.balance_due > 0 ? 'text-amber-800' : 'text-emerald-700'}">${formatCurrency(inv.balance_due)}</td>
      <td class="py-3 px-4 text-center whitespace-nowrap">${renderStatusBadge(inv.status)}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1">
          ${inv.balance_due > 0 ? `
            <button onclick="openRecordPaymentModal(${inv.id})" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded shadow-2xs" title="Record Payment">
              Record Pay
            </button>
          ` : ''}
          <button onclick="loadInvoiceForEdit(${inv.id})" class="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded" title="Edit Invoice">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="printSpecificInvoice(${inv.id})" class="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded" title="Print / PDF">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="duplicateInvoice(${inv.id})" class="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded" title="Duplicate Invoice">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="deleteInvoice(${inv.id}, '${inv.invoice_number}')" class="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

async function exportInvoicesCSV() {
  try {
    const res = await authFetch('/api/export/csv');
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoices_${currentUser ? currentUser.username : 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Invoices exported to CSV!');
  } catch (err) {
    showToast('Failed to export CSV', 'error');
  }
}

// ================= INVOICE STUDIO (EDITOR & PREVIEW) =================

function switchMobileEditorTab(tab) {
  const formCol = document.getElementById('editor-form-col');
  const prevCol = document.getElementById('editor-preview-col');
  const btnForm = document.getElementById('mob-switch-form');
  const btnPrev = document.getElementById('mob-switch-preview');

  if (tab === 'form') {
    formCol.classList.remove('hidden');
    prevCol.classList.add('hidden');
    btnForm.className = 'flex-1 py-1.5 rounded-md bg-white text-stone-900 font-semibold shadow-xs';
    btnPrev.className = 'flex-1 py-1.5 rounded-md text-stone-600';
  } else {
    formCol.classList.add('hidden');
    prevCol.classList.remove('hidden');
    prevCol.className = 'flex lg:col-span-7 justify-center overflow-x-auto';
    btnPrev.className = 'flex-1 py-1.5 rounded-md bg-white text-stone-900 font-semibold shadow-xs';
    btnForm.className = 'flex-1 py-1.5 rounded-md text-stone-600';
  }
}

async function startNewInvoice() {
  currentEditingInvoiceId = null;
  document.getElementById('editing-alert').classList.add('hidden');
  document.getElementById('btn-save-label').innerText = 'Save to Database';

  // Fetch next invoice number
  try {
    const res = await authFetch('/api/invoices/next-number');
    const data = await res.json();
    document.getElementById('in_inv_no').value = data.nextInvoiceNumber || 'INV-001';
  } catch (e) {
    document.getElementById('in_inv_no').value = 'INV-001';
  }

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('in_inv_date').value = today;
  document.getElementById('in_service_date').value = '';

  // Clear client info
  document.getElementById('in_bride_name').value = '';
  document.getElementById('in_bride_phone').value = '';
  document.getElementById('in_bride_email').value = '';
  document.getElementById('in_venue').value = '';
  document.getElementById('in_location').value = '';
  document.getElementById('in_discount').value = '';
  document.getElementById('in_advance').value = '';

  // Reset to default services
  services = [
    { desc: "Bridal Hairstyling", qty: "1", rate: "12000" },
    { desc: "Hair Trial", qty: "1", rate: "3000" },
    { desc: "Bridesmaid Hairstyling", qty: "2", rate: "2500" },
    { desc: "Travel Charges", qty: "1", rate: "1500" }
  ];

  syncUserProfileToForm();
  renderServiceInputs();
  updateInvoice();
  navigateTo('editor');
}

async function loadInvoiceForEdit(id) {
  try {
    const res = await authFetch(`/api/invoices/${id}`);
    if (!res.ok) throw new Error('Invoice not found');
    const data = await res.json();
    const inv = data.invoice;

    currentEditingInvoiceId = inv.id;
    document.getElementById('editing-alert').classList.remove('hidden');
    document.getElementById('editing-inv-title').innerText = `${inv.invoice_number} (${inv.client_name})`;
    document.getElementById('btn-save-label').innerText = 'Update Invoice';

    // Populate form
    document.getElementById('in_inv_no').value = inv.invoice_number;
    document.getElementById('in_inv_date').value = inv.invoice_date;
    document.getElementById('in_service_date').value = inv.service_date || '';
    document.getElementById('in_bride_name').value = inv.client_name;
    document.getElementById('in_bride_phone').value = inv.client_phone || '';
    document.getElementById('in_bride_email').value = inv.client_email || '';
    document.getElementById('in_venue').value = inv.event_venue || '';
    document.getElementById('in_location').value = inv.event_location || '';
    document.getElementById('in_discount').value = inv.discount || '';
    document.getElementById('in_advance').value = inv.advance_paid || '';

    // Services
    services = Array.isArray(inv.services) && inv.services.length > 0
      ? inv.services
      : [{ desc: "Bridal Hairstyling", qty: "1", rate: "12000" }];

    renderServiceInputs();
    updateInvoice();
    navigateTo('editor');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function duplicateInvoice(id) {
  try {
    const res = await authFetch(`/api/invoices/${id}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const inv = data.invoice;

    currentEditingInvoiceId = null;
    document.getElementById('editing-alert').classList.add('hidden');
    document.getElementById('btn-save-label').innerText = 'Save to Database';

    // Get next invoice number
    const nextRes = await authFetch('/api/invoices/next-number');
    const nextData = await nextRes.json();
    document.getElementById('in_inv_no').value = nextData.nextInvoiceNumber || 'INV-001';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('in_inv_date').value = today;
    document.getElementById('in_service_date').value = '';

    document.getElementById('in_bride_name').value = `${inv.client_name} (Copy)`;
    document.getElementById('in_bride_phone').value = inv.client_phone || '';
    document.getElementById('in_bride_email').value = inv.client_email || '';
    document.getElementById('in_venue').value = inv.event_venue || '';
    document.getElementById('in_location').value = inv.event_location || '';
    document.getElementById('in_discount').value = inv.discount || '';
    document.getElementById('in_advance').value = '0';

    services = JSON.parse(JSON.stringify(inv.services || []));
    renderServiceInputs();
    updateInvoice();
    navigateTo('editor');
    showToast('Invoice duplicated! Review and click Save.');
  } catch (err) {
    showToast('Failed to duplicate invoice', 'error');
  }
}

async function deleteInvoice(id, invNo) {
  if (!confirm(`Are you sure you want to delete invoice ${invNo}? This action cannot be undone.`)) {
    return;
  }
  try {
    const res = await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast(`Invoice ${invNo} deleted.`);
    fetchInvoices();
    fetchDashboardStats();
  } catch (err) {
    showToast('Failed to delete invoice', 'error');
  }
}

async function printSpecificInvoice(id) {
  await loadInvoiceForEdit(id);
  setTimeout(() => {
    triggerPrintPDF();
  }, 300);
}

// Services Inputs & Dynamic Calculations
function renderServiceInputs() {
  const container = document.getElementById('service_input_rows');
  if (!container) return;
  container.innerHTML = '';

  services.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-1.5';
    row.innerHTML = `
      <input type="text" value="${s.desc}" oninput="services[${idx}].desc=this.value; updateInvoice();" class="flex-grow px-2 py-1 text-xs border border-stone-200 rounded" placeholder="Service description">
      <input type="number" inputmode="numeric" value="${s.qty}" oninput="services[${idx}].qty=this.value; updateInvoice();" class="w-12 px-1 py-1 text-xs border border-stone-200 rounded text-center" placeholder="Qty">
      <input type="number" inputmode="numeric" value="${s.rate}" oninput="services[${idx}].rate=this.value; updateInvoice();" class="w-20 px-1.5 py-1 text-xs border border-stone-200 rounded text-right" placeholder="₹ Rate">
      <button onclick="removeServiceRow(${idx})" class="p-1 text-stone-400 hover:text-red-500 rounded active:scale-95"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
    `;
    container.appendChild(row);
  });
  lucide.createIcons();
}

function addServiceRow() {
  services.push({ desc: "", qty: "1", rate: "" });
  renderServiceInputs();
  updateInvoice();
}

function removeServiceRow(idx) {
  if (services.length > 1) {
    services.splice(idx, 1);
    renderServiceInputs();
    updateInvoice();
  }
}

function updateInvoice() {
  const stylist = document.getElementById('in_stylist').value.trim();
  const tagline = document.getElementById('in_tagline').value.trim();
  const sPhone = document.getElementById('in_studio_phone').value.trim();
  const sEmail = document.getElementById('in_studio_email').value.trim();
  const sCity = document.getElementById('in_studio_city').value.trim();

  document.getElementById('out_stylist').innerText = stylist || (currentUser ? currentUser.business_name : "Deepz Hairstylist");
  document.getElementById('out_tagline').innerText = tagline || "Bridal Hairstyling & Saree Draping";
  document.getElementById('out_studio_phone').innerText = sPhone || "+91 98945 70313";
  document.getElementById('out_studio_email').innerText = sEmail || "-";
  document.getElementById('out_studio_city').innerText = sCity || "-";

  document.getElementById('out_inv_no').innerText = document.getElementById('in_inv_no').value.trim() || "-";
  document.getElementById('out_inv_date').innerText = document.getElementById('in_inv_date').value || "-";
  document.getElementById('out_service_date').innerText = document.getElementById('in_service_date').value || "-";

  document.getElementById('out_bride_name').innerText = document.getElementById('in_bride_name').value.trim() || "-";
  document.getElementById('out_bride_phone').innerText = document.getElementById('in_bride_phone').value.trim() || "-";
  document.getElementById('out_bride_email').innerText = document.getElementById('in_bride_email').value.trim() || "-";
  document.getElementById('out_venue').innerText = document.getElementById('in_venue').value.trim() || "-";
  document.getElementById('out_location').innerText = document.getElementById('in_location').value.trim() || "-";

  const tableBody = document.getElementById('invoice_services_table');
  tableBody.innerHTML = '';
  let subtotal = 0;

  services.forEach(s => {
    const q = Number(s.qty) || 0;
    const r = Number(s.rate) || 0;
    const amt = (q > 0 ? q : 1) * r;

    if (r > 0) {
      subtotal += amt;
      const tr = document.createElement('tr');
      tr.className = 'border-b border-stone-100';
      tr.innerHTML = `
        <td class="py-1 px-2">${s.desc || "-"}</td>
        <td class="py-1 px-2 text-center text-stone-500">${s.qty || "1"}</td>
        <td class="py-1 px-2 text-right">${formatCurrency(r)}</td>
        <td class="py-1 px-2 text-right font-medium">${formatCurrency(amt)}</td>
      `;
      tableBody.appendChild(tr);
    }
  });

  const discount = Number(document.getElementById('in_discount').value) || 0;
  const advance = Number(document.getElementById('in_advance').value) || 0;
  const total = Math.max(0, subtotal - discount);
  const balance = Math.max(0, total - advance);

  document.getElementById('out_subtotal').innerText = formatCurrency(subtotal);
  
  const discRow = document.getElementById('row_discount');
  if (discount > 0) {
    discRow.classList.remove('hidden');
    document.getElementById('out_discount').innerText = "- " + formatCurrency(discount);
  } else {
    discRow.classList.add('hidden');
  }

  document.getElementById('out_total').innerText = formatCurrency(total);
  document.getElementById('out_advance').innerText = "- " + formatCurrency(advance);
  document.getElementById('out_balance').innerText = formatCurrency(balance);

  const upi = document.getElementById('in_upi').value.trim();
  document.getElementById('out_upi').innerText = upi || "-";
  document.getElementById('out_bank').innerText = document.getElementById('in_bank').value.trim() || "-";
  document.getElementById('out_acc_name').innerText = document.getElementById('in_acc_name').value.trim() || "-";
  document.getElementById('out_acc_no').innerText = document.getElementById('in_acc_no').value.trim() || "-";
  document.getElementById('out_ifsc').innerText = document.getElementById('in_ifsc').value.trim() || "-";

  const footerPhone = document.getElementById('in_footer_phone').value.trim();
  document.getElementById('out_footer_phone').innerText = footerPhone || "+91 98945 70313";

  const insta = document.getElementById('in_insta').value.trim();
  const instaLink = document.getElementById('out_insta_link');
  if (insta) {
    instaLink.innerText = `Instagram: @${insta.replace('@', '')}`;
    instaLink.href = `https://instagram.com/${insta.replace('@', '')}`;
  } else {
    instaLink.innerText = "Instagram: Deepz Hairstylist";
    instaLink.href = "#";
  }

  renderQRCode(upi, balance, stylist || "Bridal Hairstylist");
}

function renderQRCode(upiId, balance, name) {
  const qrDiv = document.getElementById('qrcode');
  if (!qrDiv) return;
  qrDiv.innerHTML = '';
  if (!upiId) {
    qrDiv.innerHTML = '<span class="text-[8px] text-stone-400 text-center px-1">UPI QR</span>';
    return;
  }
  const payeeName = encodeURIComponent(name);
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payeeName}&am=${balance}&cu=INR&tn=BridalInvoice`;
  
  qrcodeInstance = new QRCode(qrDiv, {
    text: upiUrl,
    width: 120,
    height: 120,
    colorDark: "#1C1917",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

async function saveCurrentInvoice() {
  const invNo = document.getElementById('in_inv_no').value.trim();
  const clientName = document.getElementById('in_bride_name').value.trim();

  if (!invNo) {
    showToast('Please enter an invoice number.', 'error');
    return;
  }
  if (!clientName) {
    showToast('Please enter the bride / client name.', 'error');
    return;
  }

  const payload = {
    invoice_number: invNo,
    invoice_date: document.getElementById('in_inv_date').value || new Date().toISOString().split('T')[0],
    service_date: document.getElementById('in_service_date').value || '',
    client_name: clientName,
    client_phone: document.getElementById('in_bride_phone').value.trim(),
    client_email: document.getElementById('in_bride_email').value.trim(),
    event_venue: document.getElementById('in_venue').value.trim(),
    event_location: document.getElementById('in_location').value.trim(),
    services: services,
    discount: Number(document.getElementById('in_discount').value) || 0,
    advance_paid: Number(document.getElementById('in_advance').value) || 0
  };

  try {
    let res;
    if (currentEditingInvoiceId) {
      res = await authFetch(`/api/invoices/${currentEditingInvoiceId}`, {
        method: 'PUT',
        body: payload
      });
    } else {
      res = await authFetch('/api/invoices', {
        method: 'POST',
        body: payload
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save invoice');

    showToast(currentEditingInvoiceId ? 'Invoice updated in database!' : 'New invoice saved to database!');
    currentEditingInvoiceId = data.invoice.id;
    document.getElementById('editing-alert').classList.remove('hidden');
    document.getElementById('editing-inv-title').innerText = `${data.invoice.invoice_number} (${data.invoice.client_name})`;
    document.getElementById('btn-save-label').innerText = 'Update Invoice';

    fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function triggerPrintPDF() {
  const brideName = document.getElementById('in_bride_name').value.trim() || "Bride";
  const invNo = document.getElementById('in_inv_no').value.trim() || "INV";
  const oldTitle = document.title;
  document.title = `${brideName}_${invNo}`;
  window.print();
  document.title = oldTitle;
}

function shareViaWhatsApp() {
  const bridePhone = document.getElementById('in_bride_phone').value.replace(/[^0-9]/g, "");
  const brideName = document.getElementById('in_bride_name').value.trim() || "Bride";
  const invNo = document.getElementById('in_inv_no').value.trim() || "INV";
  const balance = document.getElementById('out_balance').innerText;
  const upi = document.getElementById('in_upi').value.trim();
  const bank = document.getElementById('in_bank').value.trim();
  const accNo = document.getElementById('in_acc_no').value.trim();
  const ifsc = document.getElementById('in_ifsc').value.trim();
  const stylist = document.getElementById('in_stylist').value.trim();

  const text = encodeURIComponent(
    `Dear ${brideName},\n\n` +
    `Thank you for booking with ${stylist}! Here are the details for your Invoice #${invNo}:\n` +
    `• Balance Due: ${balance}\n` +
    (upi ? `• UPI ID for Instant Payment: ${upi}\n\n` : `\n`) +
    `Bank Transfer Details:\n` +
    `• Bank: ${bank}\n` +
    `• Account No: ${accNo}\n` +
    `• IFSC: ${ifsc}\n\n` +
    `Please settle the balance on or before the event date. Looking forward to making your special day memorable!`
  );

  const url = bridePhone ? `https://wa.me/${bridePhone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

// ================= RECORD PAYMENT MODAL =================

async function openRecordPaymentModal(invId) {
  try {
    const res = await authFetch(`/api/invoices/${invId}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    activePaymentInvoice = data.invoice;

    document.getElementById('rec-inv-info').innerText = `Invoice #${activePaymentInvoice.invoice_number}`;
    document.getElementById('rec-client-name').innerText = activePaymentInvoice.client_name;
    document.getElementById('rec-total-amt').innerText = formatCurrency(activePaymentInvoice.total_amount);
    document.getElementById('rec-advance-paid').innerText = formatCurrency(activePaymentInvoice.advance_paid);
    document.getElementById('rec-balance-due').innerText = formatCurrency(activePaymentInvoice.balance_due);

    // Default pre-fill with remaining balance
    document.getElementById('rec-payment-amount').value = activePaymentInvoice.balance_due;
    document.getElementById('rec-payment-notes').value = 'UPI / Cash payment received';

    document.getElementById('modal-record-payment').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load invoice payment details', 'error');
  }
}

function fillFullBalance() {
  if (activePaymentInvoice) {
    document.getElementById('rec-payment-amount').value = activePaymentInvoice.balance_due;
  }
}

function closeRecordPaymentModal() {
  document.getElementById('modal-record-payment').classList.add('hidden');
  activePaymentInvoice = null;
}

async function submitRecordPayment() {
  if (!activePaymentInvoice) return;
  const amount = Number(document.getElementById('rec-payment-amount').value) || 0;
  const notes = document.getElementById('rec-payment-notes').value.trim();

  if (amount <= 0) {
    showToast('Please enter a valid amount.', 'error');
    return;
  }

  try {
    const res = await authFetch(`/api/invoices/${activePaymentInvoice.id}/record-payment`, {
      method: 'POST',
      body: { amountPaid: amount, notes }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record payment');

    showToast(data.message || 'Payment recorded successfully!');
    closeRecordPaymentModal();
    fetchDashboardStats();
    if (currentTab === 'invoices') fetchInvoices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= STUDIO & UPI SETTINGS =================

async function saveStudioProfile() {
  const payload = {
    name: document.getElementById('set_name').value.trim(),
    business_name: document.getElementById('set_business_name').value.trim(),
    tagline: document.getElementById('set_tagline').value.trim(),
    phone: document.getElementById('set_phone').value.trim(),
    email_contact: document.getElementById('set_email_contact').value.trim(),
    city: document.getElementById('set_city').value.trim(),
    instagram: document.getElementById('set_instagram').value.trim(),
    upi_id: document.getElementById('set_upi_id').value.trim(),
    bank_name: document.getElementById('set_bank_name').value.trim(),
    acc_name: document.getElementById('set_acc_name').value.trim(),
    acc_no: document.getElementById('set_acc_no').value.trim(),
    ifsc: document.getElementById('set_ifsc').value.trim(),
    invoice_prefix: document.getElementById('set_invoice_prefix').value.trim()
  };

  try {
    const res = await authFetch('/api/auth/profile', {
      method: 'PUT',
      body: payload
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save settings');

    setCurrentUser(data.user);
    showToast('Studio profile and banking settings updated!');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= APP INITIALIZATION =================

function initApp() {
  renderServiceInputs();
  updateInvoice();
  fetchDashboardStats();
  lucide.createIcons();
}

window.onload = function() {
  checkAuth();
};
