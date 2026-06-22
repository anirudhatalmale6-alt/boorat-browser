/**
 * PX Proxy Tester - popup.js
 * Tests proxy connection, checks IP info, latency, and blacklist status.
 */

(function () {
  'use strict';

  // --- DOM References ---
  const checkIpBtn = document.getElementById('checkIpBtn');
  const testSpeedBtn = document.getElementById('testSpeedBtn');
  const errorMsg = document.getElementById('errorMsg');
  const placeholder = document.getElementById('placeholder');
  const ipCard = document.getElementById('ipCard');
  const latencyCard = document.getElementById('latencyCard');
  const blacklistCard = document.getElementById('blacklistCard');
  const typeBadge = document.getElementById('typeBadge');
  const typeBadgeText = document.getElementById('typeBadgeText');
  const ipDisplay = document.getElementById('ipDisplay');
  const infoCountry = document.getElementById('infoCountry');
  const infoCity = document.getElementById('infoCity');
  const infoTimezone = document.getElementById('infoTimezone');
  const infoRegion = document.getElementById('infoRegion');
  const infoIsp = document.getElementById('infoIsp');
  const latencyDisplay = document.getElementById('latencyDisplay');
  const latencyValue = document.getElementById('latencyValue');
  const latencyFill = document.getElementById('latencyFill');
  const blacklistLinks = document.getElementById('blacklistLinks');
  const historyList = document.getElementById('historyList');
  const historyClearBtn = document.getElementById('historyClearBtn');

  // Current IP data (stored after a check)
  let currentIpData = null;

  // --- Datacenter / Hosting keywords ---
  const datacenterKeywords = [
    'amazon', 'aws', 'google', 'gcp', 'microsoft', 'azure', 'digitalocean',
    'linode', 'vultr', 'ovh', 'hetzner', 'contabo', 'hosting', 'server',
    'cloud', 'datacenter', 'data center', 'colocation', 'colo', 'rack',
    'dedicated', 'vps', 'virtual', 'leaseweb', 'rackspace', 'cloudflare',
    'fastly', 'akamai', 'incapsula', 'choopa', 'servermania', 'psychz',
    'quadranet', 'reliablesite', 'softlayer', 'oracle', 'alibaba',
    'tencent', 'scaleway', 'upcloud', 'kamatera', 'interserver',
    'hostinger', 'godaddy', 'namecheap', 'bluehost', 'siteground',
    'ionos', 'strato', 'm247', 'datacamp', 'proxy', 'vpn', 'tunnel',
    'nord', 'express', 'surfshark', 'mullvad', 'private internet',
    'cyberghost', 'proton'
  ];

  // --- Blacklist check sites ---
  const blacklistSites = [
    { name: 'MXToolbox', url: 'https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a{ip}' },
    { name: 'Spamhaus', url: 'https://check.spamhaus.org/listed/?searchterm={ip}' },
    { name: 'AbuseIPDB', url: 'https://www.abuseipdb.com/check/{ip}' },
    { name: 'IPVoid', url: 'https://www.ipvoid.com/ip-blacklist-check/' },
    { name: 'Scamalytics', url: 'https://scamalytics.com/ip/{ip}' }
  ];

  // --- Helpers ---

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }

  function hideError() {
    errorMsg.classList.add('hidden');
  }

  function setButtonLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn._prevHTML = btn.innerHTML;
      const label = btn === checkIpBtn ? 'Checking...' : 'Testing...';
      btn.innerHTML = '<span class="spinner"></span> ' + label;
    } else {
      btn.disabled = false;
      if (btn._prevHTML) {
        btn.innerHTML = btn._prevHTML;
      }
    }
  }

  function classifyIsp(isp, org) {
    if (!isp && !org) return 'unknown';
    const combined = ((isp || '') + ' ' + (org || '')).toLowerCase();
    for (const kw of datacenterKeywords) {
      if (combined.includes(kw)) return 'datacenter';
    }
    return 'residential';
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + 'h ago';

    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return month + '/' + day + ' ' + hours + ':' + mins;
  }

  // --- IP Check ---

  async function fetchIpInfo() {
    // Try ip-api.com first (no HTTPS on free tier, but works for extensions)
    // Then fall back to ipapi.co
    const apis = [
      {
        url: 'http://ip-api.com/json/?fields=query,country,city,regionName,timezone,isp,org,as,status',
        parse: function (data) {
          if (data.status !== 'success') throw new Error('ip-api returned failure');
          return {
            ip: data.query,
            country: data.country || '--',
            city: data.city || '--',
            region: data.regionName || '--',
            timezone: data.timezone || '--',
            isp: data.isp || '--',
            org: data.org || '--'
          };
        }
      },
      {
        url: 'https://ipapi.co/json/',
        parse: function (data) {
          if (data.error) throw new Error(data.reason || 'ipapi.co error');
          return {
            ip: data.ip,
            country: data.country_name || '--',
            city: data.city || '--',
            region: data.region || '--',
            timezone: data.timezone || '--',
            isp: data.org || '--',
            org: data.org || '--'
          };
        }
      }
    ];

    for (const api of apis) {
      try {
        const resp = await fetch(api.url, { cache: 'no-store' });
        if (!resp.ok) continue;
        const data = await resp.json();
        return api.parse(data);
      } catch (e) {
        // Try next API
        continue;
      }
    }

    throw new Error('All IP lookup services failed. Check your connection.');
  }

  async function handleCheckIp() {
    hideError();
    setButtonLoading(checkIpBtn, true);
    testSpeedBtn.disabled = true;

    try {
      const data = await fetchIpInfo();
      currentIpData = data;

      // Update UI
      placeholder.classList.add('hidden');
      ipCard.classList.remove('hidden');
      blacklistCard.classList.remove('hidden');

      ipDisplay.textContent = data.ip;
      infoCountry.textContent = data.country;
      infoCity.textContent = data.city;
      infoTimezone.textContent = data.timezone;
      infoRegion.textContent = data.region;
      infoIsp.textContent = data.isp;

      // Classify IP type
      const ipType = classifyIsp(data.isp, data.org);
      typeBadge.className = 'badge badge-' + ipType;
      typeBadgeText.textContent = ipType.charAt(0).toUpperCase() + ipType.slice(1);

      // Populate blacklist links
      blacklistLinks.innerHTML = '';
      blacklistSites.forEach(function (site) {
        const a = document.createElement('a');
        a.className = 'bl-link';
        a.textContent = site.name;
        a.title = 'Check on ' + site.name;
        a.addEventListener('click', function () {
          const url = site.url.replace('{ip}', encodeURIComponent(data.ip));
          chrome.tabs.create({ url: url });
        });
        blacklistLinks.appendChild(a);
      });

      // Enable speed test
      testSpeedBtn.disabled = false;

      // Save to history
      await saveToHistory(data);
      await renderHistory();
    } catch (err) {
      showError(err.message || 'Failed to fetch IP information.');
    } finally {
      setButtonLoading(checkIpBtn, false);
    }
  }

  // --- Speed Test ---

  async function measureLatency() {
    // Measure round-trip time to a fast, reliable endpoint
    const targets = [
      'https://www.google.com/generate_204',
      'https://www.gstatic.com/generate_204',
      'https://clients3.google.com/generate_204'
    ];

    const results = [];

    for (const url of targets) {
      try {
        const start = performance.now();
        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store'
        });
        const end = performance.now();
        results.push(Math.round(end - start));
      } catch (e) {
        // Skip failed targets
      }
    }

    if (results.length === 0) {
      throw new Error('Could not reach any speed test targets.');
    }

    // Return median
    results.sort(function (a, b) { return a - b; });
    return results[Math.floor(results.length / 2)];
  }

  async function handleTestSpeed() {
    hideError();
    setButtonLoading(testSpeedBtn, true);

    try {
      latencyCard.classList.remove('hidden');
      latencyValue.textContent = '...';
      latencyDisplay.className = 'latency-display';
      latencyFill.style.width = '0%';

      const ms = await measureLatency();

      latencyValue.textContent = ms;

      // Color code
      let colorClass;
      let fillPct;
      if (ms < 200) {
        colorClass = 'latency-green';
        fillPct = Math.max(10, (ms / 200) * 33);
      } else if (ms < 500) {
        colorClass = 'latency-yellow';
        fillPct = 33 + ((ms - 200) / 300) * 34;
      } else {
        colorClass = 'latency-red';
        fillPct = Math.min(100, 67 + ((ms - 500) / 500) * 33);
      }

      latencyDisplay.className = 'latency-display ' + colorClass;
      latencyFill.style.width = fillPct + '%';
    } catch (err) {
      showError(err.message || 'Speed test failed.');
    } finally {
      setButtonLoading(testSpeedBtn, false);
    }
  }

  // --- History ---

  async function getHistory() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ pxProxyHistory: [] }, function (result) {
        resolve(result.pxProxyHistory || []);
      });
    });
  }

  async function saveToHistory(data) {
    const history = await getHistory();
    const entry = {
      ip: data.ip,
      country: data.country,
      city: data.city,
      type: classifyIsp(data.isp, data.org),
      timestamp: Date.now()
    };

    // Add to front
    history.unshift(entry);

    // Keep only last 5
    while (history.length > 5) {
      history.pop();
    }

    return new Promise(function (resolve) {
      chrome.storage.local.set({ pxProxyHistory: history }, resolve);
    });
  }

  async function clearHistory() {
    return new Promise(function (resolve) {
      chrome.storage.local.set({ pxProxyHistory: [] }, resolve);
    });
  }

  async function renderHistory() {
    const history = await getHistory();

    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No checks yet</div>';
      historyClearBtn.classList.add('hidden');
      return;
    }

    historyClearBtn.classList.remove('hidden');
    historyList.innerHTML = '';

    history.forEach(function (entry) {
      const div = document.createElement('div');
      div.className = 'history-item';

      const badgeColor = entry.type === 'residential' ? '#34d399'
        : entry.type === 'datacenter' ? '#fbbf24'
        : '#8b949e';

      div.innerHTML =
        '<span class="history-ip">' + escapeHtml(entry.ip) + '</span>' +
        '<span class="history-meta">' +
          '<span>' + escapeHtml(entry.country) + '</span>' +
          '<span class="history-badge" style="background:' + badgeColor + '"></span>' +
          '<span>' + formatTimestamp(entry.timestamp) + '</span>' +
        '</span>';

      historyList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Event Listeners ---

  checkIpBtn.addEventListener('click', handleCheckIp);
  testSpeedBtn.addEventListener('click', handleTestSpeed);
  historyClearBtn.addEventListener('click', async function () {
    await clearHistory();
    await renderHistory();
  });

  // --- Init ---
  renderHistory();

})();
