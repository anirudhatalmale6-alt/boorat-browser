// PX Warm-Up - Background Service Worker

const SITE_LISTS = {
  general: [
    'https://www.google.com',
    'https://www.youtube.com',
    'https://www.reddit.com',
    'https://www.wikipedia.org',
    'https://weather.com',
    'https://www.yahoo.com',
    'https://www.bing.com',
    'https://www.imdb.com',
    'https://www.stackoverflow.com',
    'https://www.github.com',
    'https://www.quora.com',
    'https://www.medium.com',
    'https://www.twitch.tv',
    'https://www.spotify.com',
    'https://www.netflix.com',
    'https://www.hulu.com',
    'https://www.craigslist.org',
    'https://www.yelp.com',
    'https://www.zillow.com',
    'https://www.tripadvisor.com',
    'https://www.booking.com',
    'https://www.expedia.com',
    'https://www.indeed.com',
    'https://www.glassdoor.com',
    'https://www.webmd.com',
  ],
  shopping: [
    'https://www.amazon.com',
    'https://www.ebay.com',
    'https://www.walmart.com',
    'https://www.target.com',
    'https://www.bestbuy.com',
    'https://www.etsy.com',
    'https://www.aliexpress.com',
    'https://www.wayfair.com',
    'https://www.costco.com',
    'https://www.homedepot.com',
    'https://www.lowes.com',
    'https://www.macys.com',
    'https://www.nordstrom.com',
    'https://www.zappos.com',
    'https://www.newegg.com',
    'https://www.overstock.com',
    'https://www.kohls.com',
    'https://www.sephora.com',
    'https://www.nike.com',
    'https://www.adidas.com',
    'https://www.shein.com',
    'https://www.asos.com',
    'https://www.gap.com',
    'https://www.hm.com',
    'https://www.zara.com',
  ],
  social: [
    'https://www.facebook.com',
    'https://twitter.com',
    'https://www.instagram.com',
    'https://www.linkedin.com',
    'https://www.pinterest.com',
    'https://www.tiktok.com',
    'https://www.snapchat.com',
    'https://www.tumblr.com',
    'https://www.discord.com',
    'https://www.telegram.org',
    'https://www.whatsapp.com',
    'https://www.reddit.com',
    'https://www.quora.com',
    'https://www.meetup.com',
    'https://www.flickr.com',
    'https://www.deviantart.com',
    'https://mastodon.social',
    'https://www.threads.net',
    'https://bsky.app',
    'https://www.clubhouse.com',
  ],
  news: [
    'https://www.cnn.com',
    'https://www.bbc.com',
    'https://www.reuters.com',
    'https://www.nytimes.com',
    'https://www.washingtonpost.com',
    'https://www.theguardian.com',
    'https://www.foxnews.com',
    'https://www.nbcnews.com',
    'https://www.cbsnews.com',
    'https://www.abcnews.go.com',
    'https://www.usatoday.com',
    'https://www.huffpost.com',
    'https://www.politico.com',
    'https://www.bloomberg.com',
    'https://www.cnbc.com',
    'https://www.forbes.com',
    'https://www.businessinsider.com',
    'https://www.techcrunch.com',
    'https://www.theverge.com',
    'https://www.wired.com',
    'https://arstechnica.com',
    'https://www.apnews.com',
    'https://www.aljazeera.com',
    'https://www.npr.org',
    'https://news.ycombinator.com',
  ],
};

// State
let warmupState = {
  running: false,
  current: 0,
  total: 0,
  sites: [],
  duration: 10,
  tabId: null,
  log: [],
  aborted: false,
};

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Send message to popup (safe - ignores errors if popup is closed)
function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Popup not open, ignore
  });
}

// Wait for a tab to finish loading
function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    function checkTab() {
      if (Date.now() - startTime > timeoutMs) {
        resolve(false);
        return;
      }
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        if (tab.status === 'complete') {
          resolve(true);
        } else {
          setTimeout(checkTab, 500);
        }
      });
    }

    checkTab();
  });
}

// Inject scrolling behavior into the current tab
async function injectScrolling(tabId, durationSec) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (duration) => {
        // Signal that warm-up scrolling should happen
        window.__pxWarmupDuration = duration;
        window.__pxWarmupActive = true;
      },
      args: [durationSec],
    });
  } catch (e) {
    // Some pages block script injection (chrome:// etc), that's OK
  }
}

// Sleep helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main warm-up loop
async function runWarmup(config) {
  const { category, duration, siteCount } = config;

  const pool = SITE_LISTS[category] || SITE_LISTS.general;
  let sites = [];

  // If requesting more sites than available, repeat the pool
  while (sites.length < siteCount) {
    sites = sites.concat(shuffle(pool));
  }
  sites = sites.slice(0, siteCount);

  warmupState = {
    running: true,
    current: 0,
    total: siteCount,
    sites: sites,
    duration: duration,
    tabId: null,
    log: [],
    aborted: false,
  };

  // Get or create a tab to use
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    warmupState.tabId = activeTab ? activeTab.id : null;
  } catch (e) {
    // Fallback: create a new tab
  }

  if (!warmupState.tabId) {
    const newTab = await chrome.tabs.create({ active: true });
    warmupState.tabId = newTab.id;
  }

  for (let i = 0; i < sites.length; i++) {
    if (warmupState.aborted) break;

    const url = sites[i];
    warmupState.current = i;

    // Notify popup we're visiting
    notifyPopup({ type: 'visiting', url: url });

    try {
      // Navigate the tab
      await chrome.tabs.update(warmupState.tabId, { url: url });

      // Wait for page load
      const loaded = await waitForTabLoad(warmupState.tabId);

      if (warmupState.aborted) break;

      if (loaded) {
        // Inject scrolling behavior
        await injectScrolling(warmupState.tabId, duration);

        // Wait for the configured duration
        // Break it into 1-second chunks so we can check abort flag
        for (let s = 0; s < duration; s++) {
          if (warmupState.aborted) break;
          await sleep(1000);
        }
      } else {
        // Page didn't load in time, wait a bit and move on
        await sleep(2000);
      }

      if (warmupState.aborted) break;

      warmupState.current = i + 1;
      const logEntry = { url: url, type: 'success' };
      warmupState.log.push(logEntry);

      // Notify popup of progress
      notifyPopup({
        type: 'progress',
        current: i + 1,
        total: siteCount,
        url: url,
      });
    } catch (err) {
      const logEntry = { url: `${url} - ${err.message}`, type: 'error' };
      warmupState.log.push(logEntry);

      notifyPopup({
        type: 'error',
        url: url,
        error: err.message,
      });

      // Brief pause before continuing
      await sleep(1000);
    }
  }

  if (!warmupState.aborted) {
    notifyPopup({ type: 'complete', total: warmupState.current });
  }

  warmupState.running = false;
  warmupState.aborted = false;
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startWarmup') {
    if (!warmupState.running) {
      runWarmup(msg.config);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'stopWarmup') {
    warmupState.aborted = true;
    warmupState.running = false;
    notifyPopup({ type: 'stopped' });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'getStatus') {
    sendResponse({
      running: warmupState.running,
      current: warmupState.current,
      total: warmupState.total,
      log: warmupState.log,
    });
    return true;
  }

  return false;
});

// Keep service worker alive while warming up
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive' && warmupState.running) {
    chrome.alarms.create('keepalive', { delayInMinutes: 0.4 });
  }
});

// Periodic keepalive alarm to prevent service worker from going idle during warm-up
chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });
