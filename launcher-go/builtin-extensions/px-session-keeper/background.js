const PERSIST_DAYS = 365;
const SYNC_INTERVAL_MS = 30000;
const SERVER_PORT_FILE = '.port';

const IMPORTANT_DOMAINS = [
  'google.com', 'gmail.com', 'accounts.google.com', 'myaccount.google.com',
  'youtube.com', 'googleusercontent.com', 'gstatic.com', 'google.co',
  'ticketmaster.com', 'livenation.com', 'checkout.ticketmaster.com',
  'seatgeek.com', 'axs.com', 'mlb.com', 'evenue.net',
  'microsoft.com', 'live.com', 'outlook.com', 'login.microsoftonline.com',
  'facebook.com', 'instagram.com',
  'twitter.com', 'x.com',
  'amazon.com', 'apple.com', 'icloud.com'
];

function domainMatches(cookieDomain, pattern) {
  const d = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
  return d === pattern || d.endsWith('.' + pattern);
}

function isImportantDomain(domain) {
  return IMPORTANT_DOMAINS.some(p => domainMatches(domain, p));
}

async function persistSessionCookies() {
  const allCookies = await chrome.cookies.getAll({});
  const futureDate = Date.now() / 1000 + PERSIST_DAYS * 86400;
  let converted = 0;

  for (const cookie of allCookies) {
    if (cookie.session && isImportantDomain(cookie.domain)) {
      const url = (cookie.secure ? 'https://' : 'http://') +
        (cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain) +
        cookie.path;
      try {
        await chrome.cookies.set({
          url: url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'unspecified',
          expirationDate: futureDate
        });
        converted++;
      } catch (e) {}
    }
  }
  if (converted > 0) {
    console.log('[Session Keeper] Persisted ' + converted + ' session cookies');
  }
}

async function exportCookies() {
  const allCookies = await chrome.cookies.getAll({});
  const important = allCookies.filter(c => isImportantDomain(c.domain));
  const exportData = important.map(c => ({
    domain: c.domain,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite || 'unspecified',
    expirationDate: c.expirationDate || (Date.now() / 1000 + PERSIST_DAYS * 86400),
    hostOnly: c.hostOnly
  }));

  try {
    await chrome.storage.local.set({ px_cookies: JSON.stringify(exportData), px_cookies_ts: Date.now() });
    console.log('[Session Keeper] Exported ' + exportData.length + ' cookies to storage');
  } catch (e) {}

  const profileId = await getProfileId();
  if (profileId) {
    try {
      const resp = await fetch('http://127.0.0.1:33939/api/cookie-sync/' + profileId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: exportData })
      });
      if (resp.ok) {
        console.log('[Session Keeper] Synced ' + exportData.length + ' cookies to server');
      }
    } catch (e) {
      console.log('[Session Keeper] Server sync failed (offline mode)');
    }
  }
}

async function importCookies() {
  const profileId = await getProfileId();
  let cookieData = null;

  if (profileId) {
    try {
      const resp = await fetch('http://127.0.0.1:33939/api/cookie-sync/' + profileId);
      if (resp.ok) {
        const data = await resp.json();
        if (data.cookies && data.cookies.length > 0) {
          cookieData = data.cookies;
          console.log('[Session Keeper] Got ' + cookieData.length + ' cookies from server');
        }
      }
    } catch (e) {}
  }

  if (!cookieData) {
    try {
      const stored = await chrome.storage.local.get(['px_cookies']);
      if (stored.px_cookies) {
        cookieData = JSON.parse(stored.px_cookies);
        console.log('[Session Keeper] Got ' + cookieData.length + ' cookies from local storage');
      }
    } catch (e) {}
  }

  if (!cookieData || cookieData.length === 0) return;

  let imported = 0;
  for (const c of cookieData) {
    const url = (c.secure ? 'https://' : 'http://') +
      (c.domain.startsWith('.') ? c.domain.substring(1) : c.domain) +
      (c.path || '/');
    try {
      await chrome.cookies.set({
        url: url,
        name: c.name,
        value: c.value,
        domain: c.hostOnly ? undefined : c.domain,
        path: c.path || '/',
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite || 'unspecified',
        expirationDate: c.expirationDate || (Date.now() / 1000 + PERSIST_DAYS * 86400)
      });
      imported++;
    } catch (e) {}
  }
  console.log('[Session Keeper] Imported ' + imported + ' cookies');
}

async function getProfileId() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        const match = tab.url.match(/[#&?]mlx-profile=([^&]+)/);
        if (match) return match[1];
      }
    }
    const stored = await chrome.storage.local.get(['px_profile_id']);
    if (stored.px_profile_id) return stored.px_profile_id;

    const resp = await fetch('http://127.0.0.1:33939/api/status');
    if (resp.ok) {
      const data = await resp.json();
      if (data.running_profiles && data.running_profiles.length > 0) {
        return data.running_profiles[0];
      }
    }
  } catch (e) {}
  return null;
}

chrome.runtime.onInstalled.addListener(() => {
  importCookies();
});

chrome.runtime.onStartup.addListener(() => {
  importCookies();
});

importCookies();

setTimeout(() => persistSessionCookies(), 5000);

chrome.alarms.create('persist-cookies', { periodInMinutes: 0.5 });
chrome.alarms.create('export-cookies', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'persist-cookies') {
    persistSessionCookies();
  } else if (alarm.name === 'export-cookies') {
    exportCookies();
  }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!changeInfo.removed && changeInfo.cookie.session && isImportantDomain(changeInfo.cookie.domain)) {
    const cookie = changeInfo.cookie;
    const url = (cookie.secure ? 'https://' : 'http://') +
      (cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain) +
      cookie.path;
    chrome.cookies.set({
      url: url,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite || 'unspecified',
      expirationDate: Date.now() / 1000 + PERSIST_DAYS * 86400
    }).catch(() => {});
  }
});

console.log('[Session Keeper] v2.0 Active - cookie persist + API sync');
