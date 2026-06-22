/**
 * PX Auto-Fill - Popup Controller
 * Manages profile CRUD and triggers auto-fill on active tab
 */

const STORAGE_KEY = 'px_autofill_profiles';
const SELECTED_KEY = 'px_autofill_selected';

const profileSelect = document.getElementById('profile-select');
const profileForm = document.getElementById('profile-form');
const formTitle = document.getElementById('form-title');
const btnAdd = document.getElementById('btn-add');
const btnDelete = document.getElementById('btn-delete');
const btnAutofill = document.getElementById('btn-autofill');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const statusMsg = document.getElementById('status-msg');
const profileCount = document.getElementById('profile-count');

const fieldIds = [
  'f-profile-name', 'f-first-name', 'f-last-name', 'f-email', 'f-phone',
  'f-address1', 'f-address2', 'f-city', 'f-state', 'f-zip', 'f-country'
];

const fieldKeys = [
  'profileName', 'firstName', 'lastName', 'email', 'phone',
  'address1', 'address2', 'city', 'state', 'zip', 'country'
];

let profiles = [];
let editingId = null;

// ── Init ──
document.addEventListener('DOMContentLoaded', loadProfiles);

// ── Event Listeners ──
btnAdd.addEventListener('click', () => {
  editingId = null;
  formTitle.textContent = 'New Profile';
  clearForm();
  showForm(true);
});

btnCancel.addEventListener('click', () => {
  showForm(false);
});

btnDelete.addEventListener('click', () => {
  const id = profileSelect.value;
  if (!id) return;
  const profile = profiles.find(p => p.id === id);
  if (profile && confirm(`Delete profile "${profile.profileName}"?`)) {
    profiles = profiles.filter(p => p.id !== id);
    saveProfiles(() => {
      renderSelect();
      showStatus('Profile deleted', 'info');
    });
  }
});

btnSave.addEventListener('click', () => {
  const data = {};
  fieldKeys.forEach((key, i) => {
    data[key] = document.getElementById(fieldIds[i]).value.trim();
  });

  if (!data.profileName) {
    showStatus('Profile name is required', 'error');
    document.getElementById('f-profile-name').focus();
    return;
  }

  if (!data.firstName && !data.lastName) {
    showStatus('Enter at least a first or last name', 'error');
    return;
  }

  if (editingId) {
    const idx = profiles.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      data.id = editingId;
      profiles[idx] = data;
    }
  } else {
    data.id = 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    profiles.push(data);
  }

  saveProfiles(() => {
    renderSelect(data.id);
    showForm(false);
    showStatus(editingId ? 'Profile updated' : 'Profile saved', 'success');
  });
});

btnAutofill.addEventListener('click', () => {
  const id = profileSelect.value;
  if (!id) return;
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      showStatus('No active tab found', 'error');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'px_autofill',
      profile: profile
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Could not reach page. Reload and retry.', 'error');
        return;
      }
      if (response && response.filled > 0) {
        showStatus(`Filled ${response.filled} field${response.filled > 1 ? 's' : ''}`, 'success');
      } else if (response && response.filled === 0) {
        showStatus('No matching form fields found', 'info');
      } else {
        showStatus('Fill command sent', 'info');
      }
    });
  });
});

profileSelect.addEventListener('change', () => {
  const hasSelection = !!profileSelect.value;
  btnDelete.disabled = !hasSelection;
  btnAutofill.disabled = !hasSelection;

  if (profileSelect.value) {
    chrome.storage.local.set({ [SELECTED_KEY]: profileSelect.value });
  }
});

// Double-click profile to edit
profileSelect.addEventListener('dblclick', () => {
  const id = profileSelect.value;
  if (!id) return;
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  editingId = id;
  formTitle.textContent = 'Edit Profile';
  fieldKeys.forEach((key, i) => {
    document.getElementById(fieldIds[i]).value = profile[key] || '';
  });
  showForm(true);
});

// ── Storage Helpers ──
function loadProfiles() {
  chrome.storage.local.get([STORAGE_KEY, SELECTED_KEY], (result) => {
    profiles = result[STORAGE_KEY] || [];
    const lastSelected = result[SELECTED_KEY] || '';
    renderSelect(lastSelected);
  });
}

function saveProfiles(callback) {
  chrome.storage.local.set({ [STORAGE_KEY]: profiles }, callback);
}

function renderSelect(selectId) {
  profileSelect.innerHTML = '';

  if (profiles.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- No profiles saved --';
    profileSelect.appendChild(opt);
    btnDelete.disabled = true;
    btnAutofill.disabled = true;
    profileCount.textContent = '';
    return;
  }

  profileCount.textContent = `${profiles.length} saved`;

  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.profileName || `${p.firstName} ${p.lastName}`;
    profileSelect.appendChild(opt);
  });

  if (selectId && profiles.find(p => p.id === selectId)) {
    profileSelect.value = selectId;
  } else {
    profileSelect.value = profiles[0].id;
  }

  btnDelete.disabled = false;
  btnAutofill.disabled = false;
}

// ── UI Helpers ──
function showForm(visible) {
  profileForm.classList.toggle('active', visible);
  if (visible) {
    document.getElementById('f-profile-name').focus();
  }
}

function clearForm() {
  fieldIds.forEach(id => {
    document.getElementById(id).value = '';
  });
}

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status ' + type;

  clearTimeout(statusMsg._timer);
  statusMsg._timer = setTimeout(() => {
    statusMsg.className = 'status';
  }, 3000);
}
