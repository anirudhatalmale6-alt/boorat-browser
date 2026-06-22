// PX Warm-Up - Popup Script

const $ = (sel) => document.querySelector(sel);

const statusDot = $('#statusDot');
const statusText = $('#statusText');
const btnStart = $('#btnStart');
const btnStop = $('#btnStop');
const progressSection = $('#progressSection');
const progressBar = $('#progressBar');
const progressCount = $('#progressCount');
const logBody = $('#logBody');
const logEmpty = $('#logEmpty');
const btnClearLog = $('#btnClearLog');
const categorySelect = $('#category');
const durationSelect = $('#duration');
const siteCountSelect = $('#siteCount');

// Load saved settings
chrome.storage.local.get(['category', 'duration', 'siteCount'], (data) => {
  if (data.category) categorySelect.value = data.category;
  if (data.duration) durationSelect.value = data.duration;
  if (data.siteCount) siteCountSelect.value = data.siteCount;
});

// Save settings on change
[categorySelect, durationSelect, siteCountSelect].forEach((el) => {
  el.addEventListener('change', () => {
    chrome.storage.local.set({
      category: categorySelect.value,
      duration: durationSelect.value,
      siteCount: siteCountSelect.value,
    });
  });
});

// Disable settings while running
function setSettingsDisabled(disabled) {
  categorySelect.disabled = disabled;
  durationSelect.disabled = disabled;
  siteCountSelect.disabled = disabled;
}

// Update UI for running/idle state
function setRunningState(running) {
  if (running) {
    statusDot.classList.add('active');
    statusText.textContent = 'Warming Up...';
    btnStart.disabled = true;
    btnStop.disabled = false;
    progressSection.classList.add('visible');
    progressBar.classList.add('animating');
    setSettingsDisabled(true);
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Idle';
    btnStart.disabled = false;
    btnStop.disabled = true;
    progressBar.classList.remove('animating');
    setSettingsDisabled(false);
  }
}

// Update progress display
function updateProgress(current, total) {
  progressSection.classList.add('visible');
  progressCount.textContent = `${current} / ${total}`;
  const pct = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = `${pct}%`;
}

// Add log entry
function addLogEntry(url, type = 'info') {
  logEmpty.style.display = 'none';
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-url">${url}</span>
  `;

  logBody.appendChild(entry);
  logBody.scrollTop = logBody.scrollHeight;
}

// Clear log
btnClearLog.addEventListener('click', () => {
  logBody.innerHTML = '';
  logBody.appendChild(logEmpty);
  logEmpty.style.display = 'block';
});

// Start warm-up
btnStart.addEventListener('click', () => {
  const config = {
    category: categorySelect.value,
    duration: parseInt(durationSelect.value, 10),
    siteCount: parseInt(siteCountSelect.value, 10),
  };

  // Save settings
  chrome.storage.local.set({
    category: config.category,
    duration: config.duration.toString(),
    siteCount: config.siteCount.toString(),
  });

  setRunningState(true);
  updateProgress(0, config.siteCount);

  chrome.runtime.sendMessage({
    action: 'startWarmup',
    config: config,
  });
});

// Stop warm-up
btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopWarmup' });
  setRunningState(false);
  addLogEntry('Warm-up stopped by user', 'error');
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') {
    updateProgress(msg.current, msg.total);
    addLogEntry(msg.url, 'success');
  } else if (msg.type === 'visiting') {
    addLogEntry(`Visiting: ${msg.url}`, 'info');
  } else if (msg.type === 'error') {
    addLogEntry(`Error: ${msg.url} - ${msg.error}`, 'error');
  } else if (msg.type === 'complete') {
    setRunningState(false);
    updateProgress(msg.total, msg.total);
    addLogEntry(`Warm-up complete! Visited ${msg.total} sites.`, 'success');
  } else if (msg.type === 'stopped') {
    setRunningState(false);
  }
});

// Check current state on popup open
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  if (chrome.runtime.lastError) return;
  if (response && response.running) {
    setRunningState(true);
    updateProgress(response.current, response.total);

    // Replay log entries
    if (response.log && response.log.length > 0) {
      response.log.forEach((entry) => {
        addLogEntry(entry.url, entry.type);
      });
    }
  }
});
