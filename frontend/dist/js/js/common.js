// Common Utility Functions for Eventix Clone

const COOKIE_NAME = 'user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Apply cookie override from URL query param and redirect to a clean URL.
 * @returns {boolean} - True if a redirect was triggered
 */
function applyCookieFromQuery() {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    const override = url.searchParams.get('cookie');
    if (!override) return false;
    let cookie = `${COOKIE_NAME}=${encodeURIComponent(override)}; Path=/; SameSite=Lax`;
    if (Number.isFinite(COOKIE_MAX_AGE) && COOKIE_MAX_AGE > 0) {
        cookie += `; Max-Age=${Math.floor(COOKIE_MAX_AGE)}`;
    }
    document.cookie = cookie;
    url.searchParams.delete('cookie');
    const redirectUrl = `${url.origin}${url.pathname}${url.search}${url.hash}`;
    if (window.location.href !== redirectUrl) {
        window.location.replace(redirectUrl);
        return true;
    }
    return false;
}

/**
 * Resolve API base URL from meta tag or global override.
 * @returns {string} - API base URL
 */
function getApiBase() {
    const meta = document.querySelector('meta[name="api-base"]');
    const metaBase = meta ? meta.getAttribute('content') : '';
    const globalBase = window.API_BASE || window.__API_BASE__ || '';
    const fallback = '/api';
    const base = (globalBase || metaBase || fallback).trim();
    return base.replace(/\/$/, '');
}

/**
 * Make a JSON API request with cookies included.
 * @param {string} path - API path starting with /
 * @param {Object} options - fetch options
 * @returns {Promise<Object>}
 */
async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${getApiBase()}${path}`, {
        credentials: 'include',
        headers,
        ...options
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody.detail || response.statusText || 'Request failed';
        throw new Error(message);
    }
    return response.json();
}

const eventixApi = {
    baseUrl: () => getApiBase(),
    getCatalog: () => apiRequest('/eventix/catalog'),
    getAvailability: (concertId) =>
        apiRequest(`/eventix/concerts/${encodeURIComponent(concertId)}/availability`),
    saveCart: (cart) => apiRequest('/eventix/cart', {
        method: 'PUT',
        body: JSON.stringify(cart)
    }),
    saveCheckout: (checkout) => apiRequest('/eventix/cart/checkout', {
        method: 'PUT',
        body: JSON.stringify(checkout)
    }),
    holdSeats: (concertId, seatIds) =>
        apiRequest(`/eventix/concerts/${encodeURIComponent(concertId)}/holds`, {
            method: 'POST',
            body: JSON.stringify({ seat_ids: seatIds })
        }),
    createOrder: (order) => apiRequest('/eventix/orders', {
        method: 'POST',
        body: JSON.stringify(order)
    }),
    getInfo: () => apiRequest('/info'),
    listFiles: () => apiRequest('/files'),
    uploadFiles: (files = []) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        return apiRequest('/files', { method: 'POST', body: formData });
    }
};

window.eventixApi = eventixApi;

/**
 * Load JSON data from a file
 * @param {string} filepath - Path to JSON file
 * @returns {Promise<Object>} - Parsed JSON data
 */
async function loadJSON(filepath) {
    try {
        const response = await fetch(filepath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading JSON from ${filepath}:`, error);
        return null;
    }
}

/**
 * Load catalog data from backend state.
 * @returns {Promise<Object>} - Catalog payload
 */
async function loadCatalogState() {
    if (!window.eventixApi) {
        return {};
    }
    try {
        const response = await window.eventixApi.getCatalog();
        return response?.catalog || {};
    } catch (error) {
        console.warn('Failed to load catalog from state:', error);
        return {};
    }
}

/**
 * Format date string to readable format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Formatted date (e.g., "Tue • Dec 30, 2025")
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const formatted = date.toLocaleDateString('en-US', options);
    return formatted.replace(',', ' •');
}

/**
 * Format time string to 12-hour format
 * @param {string} timeString - Time in HH:mm format (24-hour)
 * @returns {string} - Formatted time (e.g., "9:00 PM")
 */
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format date and time together
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:mm format
 * @returns {string} - Formatted date and time (e.g., "Tue • Dec 30, 2025 • 9:00 PM")
 */
function formatDateTime(dateString, timeString) {
    return `${formatDate(dateString)} • ${formatTime(timeString)}`;
}

/**
 * Get URL parameters as an object
 * @returns {Object} - Key-value pairs of URL parameters
 */
function getURLParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
        params[key] = value;
    }
    return params;
}

/**
 * Set URL parameter and navigate
 * @param {string} key - Parameter name
 * @param {string} value - Parameter value
 * @param {boolean} replace - Replace current history entry instead of pushing new one
 */
function setURLParam(key, value, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

/**
 * Navigate to a URL with parameters
 * @param {string} page - Page URL
 * @param {Object} params - Key-value pairs of parameters
 */
function navigateWithParams(page, params) {
    const url = new URL(page, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value) {
            url.searchParams.set(key, value);
        }
    }
    window.location.href = url.toString();
}

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {*} data - Data to store (will be JSON stringified)
 */
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

/**
 * Get data from localStorage
 * @param {string} key - Storage key
 * @returns {*} - Retrieved data (parsed from JSON)
 */
function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

/**
 * Format price to currency
 * @param {number} price - Price value
 * @returns {string} - Formatted price (e.g., "$683.64")
 */
function formatPrice(price) {
    return `$${price.toFixed(2)}`;
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show a loading spinner on an element
 * @param {HTMLElement} element - Element to add loading state
 */
function showLoading(element) {
    element.classList.add('loading');
    element.innerHTML = '';
}

/**
 * Remove loading spinner from an element
 * @param {HTMLElement} element - Element to remove loading state
 */
function hideLoading(element) {
    element.classList.remove('loading');
}

/**
 * Get day of week abbreviation
 * @param {Date} date - Date object
 * @returns {string} - Day abbreviation (e.g., "Mon", "Tue")
 */
function getDayAbbr(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

/**
 * Get month abbreviation
 * @param {Date} date - Date object
 * @returns {string} - Month abbreviation (e.g., "Jan", "Feb")
 */
function getMonthAbbr(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()];
}

/**
 * Get full month name
 * @param {Date} date - Date object
 * @returns {string} - Full month name (e.g., "January", "February")
 */
function getMonthName(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[date.getMonth()];
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - True if same day
 */
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Format date for input field (MM/DD/YYYY)
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDateForInput(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

/**
 * Parse date from input field (MM/DD/YYYY)
 * @param {string} dateString - Date string in MM/DD/YYYY format
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDateFromInput(dateString) {
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;

    return date;
}

/**
 * Create element with classes and attributes
 * @param {string} tag - HTML tag name
 * @param {string|string[]} classes - Class name(s) to add
 * @param {Object} attributes - Attributes to set
 * @returns {HTMLElement} - Created element
 */
function createElement(tag, classes = [], attributes = {}) {
    const element = document.createElement(tag);

    if (typeof classes === 'string') {
        element.className = classes;
    } else if (Array.isArray(classes)) {
        element.classList.add(...classes);
    }

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }

    return element;
}

/**
 * Adjust concert dates so the earliest event is 7 days from now (UTC)
 * @param {Array} concerts - Array of concert objects
 */
function adjustConcertSchedule(concerts) {
    if (!Array.isArray(concerts) || concerts.length === 0) {
        return;
    }
    // Preserve dates from state as-is; do not shift relative to "today".
    return;
}

/**
 * Parse YYYY-MM-DD to UTC timestamp (midnight)
 * @param {string} dateString - Date string
 * @returns {number|null} UTC timestamp
 */
function parseDateToUTC(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day);
}

/**
 * Format UTC timestamp to YYYY-MM-DD
 * @param {number} utcMs - UTC timestamp
 * @returns {string} formatted date
 */
function formatUTCDate(utcMs) {
    const date = new Date(utcMs);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

applyCookieFromQuery();
