/**
 * PX Auto-Fill - Content Script
 * Detects and fills checkout/address form fields on any page.
 * Covers Amazon, eBay, Walmart, Shopify, WooCommerce, and general retail forms.
 */

(() => {
  'use strict';

  // ── Field Mapping ──
  // Each profile key maps to arrays of patterns that match field name, id, autocomplete,
  // placeholder, or associated label text (all compared lowercase).
  const FIELD_PATTERNS = {
    firstName: [
      'first_name', 'firstname', 'first-name', 'fname', 'given-name', 'given_name',
      'givenname', 'first name', 'nombre', 'prenom',
      'shipping_first_name', 'billing_first_name',
      'ship-first-name', 'bill-first-name',
      'enteraddresspostalcode_firstname', // Amazon
      'recipient-first-name',
      'cc-given-name'
    ],
    lastName: [
      'last_name', 'lastname', 'last-name', 'lname', 'family-name', 'family_name',
      'familyname', 'surname', 'last name', 'apellido',
      'shipping_last_name', 'billing_last_name',
      'ship-last-name', 'bill-last-name',
      'enteraddresspostalcode_lastname', // Amazon
      'recipient-last-name',
      'cc-family-name'
    ],
    email: [
      'email', 'e-mail', 'email_address', 'emailaddress', 'email-address',
      'buyer-email', 'contact-email', 'user-email',
      'shipping_email', 'billing_email'
    ],
    phone: [
      'phone', 'telephone', 'tel', 'phone_number', 'phonenumber', 'phone-number',
      'mobile', 'cell', 'contact-phone', 'daytime-phone', 'evening-phone',
      'shipping_phone', 'billing_phone',
      'enteraddresspostalcode_phonenumber' // Amazon
    ],
    address1: [
      'address1', 'address_1', 'address-1', 'address-line-1', 'address_line_1',
      'address-line1', 'addressline1', 'street', 'street_address', 'street-address',
      'streetaddress', 'address line 1', 'line1', 'address',
      'shipping_address_1', 'billing_address_1',
      'ship-address1', 'bill-address1',
      'enteraddresspostalcode_addressline1', // Amazon
      'street-address'
    ],
    address2: [
      'address2', 'address_2', 'address-2', 'address-line-2', 'address_line_2',
      'address-line2', 'addressline2', 'apt', 'suite', 'unit', 'line2',
      'address line 2', 'apartment',
      'shipping_address_2', 'billing_address_2',
      'ship-address2', 'bill-address2',
      'enteraddresspostalcode_addressline2', // Amazon
      'address-line2'
    ],
    city: [
      'city', 'town', 'locality', 'address-level2', 'address_city',
      'shipping_city', 'billing_city', 'ship-city', 'bill-city',
      'enteraddresspostalcode_city', // Amazon
      'municipality'
    ],
    state: [
      'state', 'province', 'region', 'address-level1', 'address_state',
      'state_province', 'state-province', 'zone',
      'shipping_state', 'billing_state', 'ship-state', 'bill-state',
      'enteraddresspostalcode_stateorregion' // Amazon
    ],
    zip: [
      'zip', 'zipcode', 'zip_code', 'zip-code', 'postal', 'postal_code',
      'postal-code', 'postalcode', 'postcode', 'post_code', 'post-code',
      'shipping_zip', 'billing_zip', 'shipping_postcode', 'billing_postcode',
      'ship-zip', 'bill-zip',
      'enteraddresspostalcode_postalcode' // Amazon
    ],
    country: [
      'country', 'country_code', 'countrycode', 'country-code', 'country_name',
      'countryname', 'address_country', 'nation',
      'shipping_country', 'billing_country', 'ship-country', 'bill-country',
      'enteraddresspostalcode_countrycode' // Amazon
    ]
  };

  // Patterns specifically for full name fields (combined first + last)
  const FULL_NAME_PATTERNS = [
    'full_name', 'fullname', 'full-name', 'name', 'your-name', 'your_name',
    'recipient-name', 'recipient_name', 'recipientname',
    'enteraddresspostalcode_fullname', // Amazon
    'ship-name', 'bill-name', 'contact-name', 'cc-name',
    'shipping_name', 'billing_name', 'card-name', 'cardholder'
  ];

  // ── Helper Functions ──

  /**
   * Normalize a string for comparison: lowercase, collapse whitespace, strip special chars
   */
  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Get the associated label text for an input element
   */
  function getLabelText(input) {
    // By id -> <label for="id">
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) return label.textContent.trim().toLowerCase();
    }
    // Parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim().toLowerCase();
    // aria-label
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label').toLowerCase();
    }
    return '';
  }

  /**
   * Get all candidate strings for matching an input field
   */
  function getFieldSignatures(input) {
    const sigs = [];
    const attrs = ['name', 'id', 'autocomplete', 'placeholder', 'data-field', 'data-name',
                   'aria-label', 'data-automation-id', 'data-testid'];

    attrs.forEach(attr => {
      const val = input.getAttribute(attr);
      if (val) sigs.push(val.toLowerCase());
    });

    // Label text
    const label = getLabelText(input);
    if (label) sigs.push(label);

    return sigs;
  }

  /**
   * Check if any signature matches any pattern (fuzzy matching)
   */
  function matchesPatterns(signatures, patterns) {
    for (const sig of signatures) {
      const normSig = normalize(sig);
      for (const pattern of patterns) {
        const normPattern = normalize(pattern);
        // Exact normalized match
        if (normSig === normPattern) return true;
        // Sig contains pattern or pattern contains sig (for longer descriptive attrs)
        if (normSig.includes(normPattern) || normPattern.includes(normSig)) return true;
      }
      // Also try the raw lowercase match (preserves hyphens/underscores context)
      const rawSig = sig.toLowerCase().trim();
      for (const pattern of patterns) {
        if (rawSig === pattern) return true;
        if (rawSig.includes(pattern)) return true;
      }
    }
    return false;
  }

  /**
   * Set value on an input and dispatch realistic events so frameworks pick it up
   */
  function setFieldValue(input, value) {
    if (!value) return false;

    // Focus the field
    input.focus();
    input.dispatchEvent(new Event('focus', { bubbles: true }));

    // For select elements, try to find matching option
    if (input.tagName === 'SELECT') {
      return setSelectValue(input, value);
    }

    // Clear and set
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch events that React/Angular/Vue listen for
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  /**
   * Set value on a <select> element, matching by value or text
   */
  function setSelectValue(select, value) {
    const normValue = value.toLowerCase().trim();

    for (const option of select.options) {
      const optVal = option.value.toLowerCase().trim();
      const optText = option.textContent.toLowerCase().trim();

      if (optVal === normValue || optText === normValue ||
          optVal.includes(normValue) || optText.includes(normValue) ||
          normValue.includes(optVal) || normValue.includes(optText)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }

    // Try partial match with state abbreviations, etc.
    for (const option of select.options) {
      const optText = option.textContent.toLowerCase().trim();
      if (optText.startsWith(normValue) || normValue.startsWith(optText)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  /**
   * Get all visible input-like elements on the page
   */
  function getFormFields() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="search"]',
      'input:not([type])',
      'select',
      'textarea'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));
    return Array.from(elements).filter(el => {
      // Skip hidden, disabled, readonly
      if (el.type === 'hidden') return false;
      if (el.disabled) return false;
      if (el.readOnly) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      return true;
    });
  }

  // ── Main Fill Logic ──

  function fillForm(profile) {
    const fields = getFormFields();
    let filledCount = 0;
    const filledElements = new Set();

    // First pass: fill specific fields
    for (const field of fields) {
      const signatures = getFieldSignatures(field);
      if (signatures.length === 0) continue;

      let matched = false;

      for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
        if (matchesPatterns(signatures, patterns)) {
          const value = profile[key];
          if (value && setFieldValue(field, value)) {
            filledCount++;
            filledElements.add(field);
            matched = true;
          }
          break;
        }
      }

      // Check for full name field
      if (!matched && !filledElements.has(field)) {
        if (matchesPatterns(signatures, FULL_NAME_PATTERNS)) {
          const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
          if (fullName && setFieldValue(field, fullName)) {
            filledCount++;
            filledElements.add(field);
          }
        }
      }
    }

    return filledCount;
  }

  // ── Message Listener ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'px_autofill' && message.profile) {
      try {
        const filled = fillForm(message.profile);
        sendResponse({ filled: filled, success: true });
      } catch (err) {
        console.error('[PX Auto-Fill] Error:', err);
        sendResponse({ filled: 0, success: false, error: err.message });
      }
    }
    return true; // Keep message channel open for async response
  });
})();
