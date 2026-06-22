// PX Cookie Manager - PersonaX Profile Cookie Management
// Handles import, export, and clearing of cookies per domain or globally

(function () {
  "use strict";

  // DOM elements
  const domainEl = document.getElementById("currentDomain");
  const countEl = document.getElementById("cookieCount");
  const btnExport = document.getElementById("btnExport");
  const btnExportAll = document.getElementById("btnExportAll");
  const btnImport = document.getElementById("btnImport");
  const btnClear = document.getElementById("btnClear");
  const importArea = document.getElementById("importArea");
  const importText = document.getElementById("importText");
  const btnDoImport = document.getElementById("btnDoImport");
  const btnCancelImport = document.getElementById("btnCancelImport");
  const statusArea = document.getElementById("statusArea");
  const statusMsg = document.getElementById("statusMsg");

  let currentUrl = null;
  let currentDomain = null;
  let statusTimeout = null;

  // ── Helpers ──────────────────────────────────────────────

  function extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  function showStatus(message, type) {
    clearTimeout(statusTimeout);
    const icon =
      type === "success"
        ? '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm-.75 8a1 1 0 100-2 1 1 0 000 2z"/></svg>';

    statusMsg.className = "status-msg " + type;
    statusMsg.innerHTML = icon + "<span>" + message + "</span>";
    statusArea.classList.add("visible");

    statusTimeout = setTimeout(function () {
      statusArea.classList.remove("visible");
    }, 3500);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    }
  }

  // ── Cookie Operations ──────────────────────────────────

  function cookieToSetDetails(cookie) {
    const details = {
      url: (cookie.secure ? "https://" : "http://") + cookie.domain.replace(/^\./, "") + cookie.path,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path || "/",
      secure: !!cookie.secure,
      httpOnly: !!cookie.httpOnly,
    };

    if (cookie.domain) {
      details.domain = cookie.domain;
    }

    if (cookie.sameSite) {
      const sameSiteMap = {
        no_restriction: "no_restriction",
        lax: "lax",
        strict: "strict",
        none: "no_restriction",
        Lax: "lax",
        Strict: "strict",
        None: "no_restriction",
      };
      details.sameSite = sameSiteMap[cookie.sameSite] || "lax";
    }

    if (cookie.expirationDate) {
      details.expirationDate = cookie.expirationDate;
    }

    if (cookie.storeId) {
      details.storeId = cookie.storeId;
    }

    return details;
  }

  async function getDomainCookies(domain) {
    if (!domain) return [];
    return new Promise(function (resolve) {
      chrome.cookies.getAll({ domain: domain }, function (cookies) {
        resolve(cookies || []);
      });
    });
  }

  async function getAllCookies() {
    return new Promise(function (resolve) {
      chrome.cookies.getAll({}, function (cookies) {
        resolve(cookies || []);
      });
    });
  }

  async function removeCookie(cookie) {
    const protocol = cookie.secure ? "https://" : "http://";
    const url = protocol + cookie.domain.replace(/^\./, "") + cookie.path;
    return new Promise(function (resolve) {
      chrome.cookies.remove(
        { url: url, name: cookie.name, storeId: cookie.storeId },
        function () {
          resolve();
        }
      );
    });
  }

  async function setCookie(details) {
    return new Promise(function (resolve, reject) {
      chrome.cookies.set(details, function (cookie) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(cookie);
        }
      });
    });
  }

  // ── Update Cookie Count ────────────────────────────────

  async function updateCookieCount() {
    if (!currentDomain) {
      countEl.textContent = "0";
      return;
    }
    const cookies = await getDomainCookies(currentDomain);
    countEl.textContent = String(cookies.length);
  }

  // ── Export Current Domain ──────────────────────────────

  async function exportDomainCookies() {
    if (!currentDomain) {
      showStatus("No active domain detected", "error");
      return;
    }

    try {
      const cookies = await getDomainCookies(currentDomain);
      if (cookies.length === 0) {
        showStatus("No cookies found for " + currentDomain, "error");
        return;
      }

      const exported = cookies.map(function (c) {
        return {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate || null,
          hostOnly: c.hostOnly,
          session: c.session,
        };
      });

      const json = JSON.stringify(exported, null, 2);
      const ok = await copyToClipboard(json);

      if (ok) {
        showStatus(cookies.length + " cookies copied to clipboard", "success");
      } else {
        showStatus("Failed to copy to clipboard", "error");
      }
    } catch (err) {
      showStatus("Export failed: " + err.message, "error");
    }
  }

  // ── Export All Cookies ─────────────────────────────────

  async function exportAllCookies() {
    try {
      const cookies = await getAllCookies();
      if (cookies.length === 0) {
        showStatus("No cookies found", "error");
        return;
      }

      const exported = cookies.map(function (c) {
        return {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate || null,
          hostOnly: c.hostOnly,
          session: c.session,
        };
      });

      const json = JSON.stringify(exported, null, 2);
      const ok = await copyToClipboard(json);

      if (ok) {
        showStatus(cookies.length + " cookies (all domains) copied", "success");
      } else {
        showStatus("Failed to copy to clipboard", "error");
      }
    } catch (err) {
      showStatus("Export failed: " + err.message, "error");
    }
  }

  // ── Import Cookies ─────────────────────────────────────

  function toggleImportArea() {
    const visible = importArea.classList.contains("visible");
    if (visible) {
      importArea.classList.remove("visible");
      importText.value = "";
    } else {
      importArea.classList.add("visible");
      importText.focus();
    }
  }

  async function doImport() {
    const raw = importText.value.trim();
    if (!raw) {
      showStatus("Please paste cookie JSON first", "error");
      return;
    }

    let cookies;
    try {
      cookies = JSON.parse(raw);
    } catch {
      showStatus("Invalid JSON format", "error");
      return;
    }

    if (!Array.isArray(cookies)) {
      showStatus("Expected a JSON array of cookie objects", "error");
      return;
    }

    if (cookies.length === 0) {
      showStatus("No cookies in the provided data", "error");
      return;
    }

    let imported = 0;
    let failed = 0;

    for (const cookie of cookies) {
      if (!cookie.name || !cookie.domain) {
        failed++;
        continue;
      }

      try {
        const details = cookieToSetDetails(cookie);
        await setCookie(details);
        imported++;
      } catch {
        failed++;
      }
    }

    importArea.classList.remove("visible");
    importText.value = "";

    await updateCookieCount();

    if (failed === 0) {
      showStatus(imported + " cookies imported successfully", "success");
    } else {
      showStatus(
        imported + " imported, " + failed + " failed",
        imported > 0 ? "success" : "error"
      );
    }
  }

  // ── Clear Domain Cookies ───────────────────────────────

  async function clearDomainCookies() {
    if (!currentDomain) {
      showStatus("No active domain detected", "error");
      return;
    }

    try {
      const cookies = await getDomainCookies(currentDomain);
      if (cookies.length === 0) {
        showStatus("No cookies to clear for " + currentDomain, "error");
        return;
      }

      const count = cookies.length;
      const removePromises = cookies.map(function (c) {
        return removeCookie(c);
      });
      await Promise.all(removePromises);

      await updateCookieCount();
      showStatus(count + " cookies cleared from " + currentDomain, "success");
    } catch (err) {
      showStatus("Clear failed: " + err.message, "error");
    }
  }

  // ── Initialize ─────────────────────────────────────────

  async function init() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs && tabs[0] && tabs[0].url) {
        currentUrl = tabs[0].url;
        currentDomain = extractDomain(currentUrl);

        if (currentDomain) {
          domainEl.textContent = currentDomain;
          domainEl.title = currentUrl;
        } else {
          domainEl.textContent = "No domain";
        }
      } else {
        domainEl.textContent = "No active tab";
      }

      await updateCookieCount();
    } catch (err) {
      domainEl.textContent = "Error loading";
      console.error("PX Cookie Manager init error:", err);
    }
  }

  // ── Event Listeners ────────────────────────────────────

  btnExport.addEventListener("click", exportDomainCookies);
  btnExportAll.addEventListener("click", exportAllCookies);
  btnImport.addEventListener("click", toggleImportArea);
  btnClear.addEventListener("click", clearDomainCookies);
  btnDoImport.addEventListener("click", doImport);
  btnCancelImport.addEventListener("click", function () {
    importArea.classList.remove("visible");
    importText.value = "";
  });

  // Ctrl+Enter to import
  importText.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doImport();
    }
  });

  // Start
  init();
})();
