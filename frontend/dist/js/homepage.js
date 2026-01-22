// Homepage JavaScript - Eventix Clone

// Global state
const homepageState = {
    cities: [],
    concerts: [],
    calendar: {
        isOpen: false,
        startDate: null,
        endDate: null,
        currentMonth1: new Date(2025, 11, 1), // December 2025
        currentMonth2: new Date(2026, 0, 1)    // January 2026
    },
    activeCategory: ''
};

// Initialize homepage
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initSearchHandlers();
    initCalendarPicker();
    initLocationAutocomplete();
    applyHomepageParams();
    loadFeaturedEvents();
});

// Load data from backend state
async function loadData() {
    const catalog = await loadCatalogState();
    homepageState.cities = catalog.cities?.cities || [];
    homepageState.concerts = catalog.concerts?.concerts || [];
    adjustConcertSchedule(homepageState.concerts);
}

// Initialize search handlers
function initSearchHandlers() {
    const searchBtn = document.getElementById('searchBtn');
    const locationInput = document.getElementById('locationInput');
    const artistInput = document.getElementById('artistInput');
    const clearLocationBtn = document.getElementById('clearLocation');

    // Search button click
    searchBtn.addEventListener('click', handleSearch);

    // Enter key in inputs
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    artistInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Clear location button
    clearLocationBtn.addEventListener('click', () => {
        locationInput.value = '';
        locationInput.focus();
    });
}

// Handle search
function handleSearch() {
    const filters = getSearchFilters();

    if (!hasSearchFilters(filters)) {
        loadFeaturedEvents();
        return;
    }

    const filteredByCategory = filterConcertsByCategory(homepageState.concerts, homepageState.activeCategory);
    const results = dedupeConcerts(filterConcertsBySearch(filteredByCategory, filters));
    const container = document.getElementById('eventCardsContainer');

    showLoading(container);
    renderEventCards(results, {
        title: `Search Results (${results.length})`,
        emptyMessage: 'No events match your search. Try adjusting your filters.'
    });
}

function getSearchFilters() {
    const location = document.getElementById('locationInput').value.trim();
    const query = document.getElementById('artistInput').value.trim();
    const { startDate, endDate } = homepageState.calendar;

    return {
        location,
        query,
        startDate,
        endDate
    };
}

function hasSearchFilters(filters) {
    return Boolean(filters.location || filters.query || filters.startDate || filters.endDate);
}

// Apply URL parameters to homepage state and UI
function applyHomepageParams() {
    const params = getURLParams();
    const category = params.category ? params.category.toLowerCase() : '';

    homepageState.activeCategory = category;

    if (params.location) {
        document.getElementById('locationInput').value = params.location;
    }

    if (params.artist) {
        document.getElementById('artistInput').value = params.artist;
    }

    if (category) {
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            heroTitle.textContent = `${formatCategoryLabel(category)} Events`;
        }
    }
}

// Initialize location autocomplete
function initLocationAutocomplete() {
    const locationInput = document.getElementById('locationInput');
    const dropdown = document.getElementById('locationDropdown');

    // Show dropdown on focus
    locationInput.addEventListener('focus', () => {
        if (locationInput.value.trim()) {
            showLocationDropdown(locationInput.value);
        }
    });

    // Filter on input
    locationInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();
        if (query) {
            showLocationDropdown(query);
        } else {
            dropdown.classList.add('hidden');
        }
    }, 300));

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!locationInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Show location dropdown with filtered cities
function showLocationDropdown(query) {
    const dropdown = document.getElementById('locationDropdown');
    const queryLower = query.toLowerCase();

    // Filter cities
    const matches = homepageState.cities.filter(city => {
        const cityName = `${city.name}, ${city.state}`.toLowerCase();
        return cityName.includes(queryLower);
    }).slice(0, 10); // Limit to 10 results

    if (matches.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    // Render dropdown items
    dropdown.innerHTML = '';
    matches.forEach(city => {
        const item = createElement('div', 'location-dropdown-item');
        item.textContent = `${city.name}, ${city.state}`;
        item.addEventListener('click', () => {
            document.getElementById('locationInput').value = `${city.name}, ${city.state}`;
            dropdown.classList.add('hidden');
        });
        dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
}

// Initialize calendar picker
function initCalendarPicker() {
    const dateSelect = document.getElementById('dateSelect');
    const calendarPicker = document.getElementById('calendarPicker');
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');
    const resetBtn = document.getElementById('resetCalendarBtn');
    const cancelBtn = document.getElementById('cancelCalendarBtn');
    const applyBtn = document.getElementById('applyCalendarBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    // Toggle calendar on select click
    dateSelect.addEventListener('click', () => {
        const isOpen = !calendarPicker.classList.contains('hidden');
        if (isOpen) {
            calendarPicker.classList.add('hidden');
            homepageState.calendar.isOpen = false;
        } else {
            calendarPicker.classList.remove('hidden');
            homepageState.calendar.isOpen = true;
            renderCalendars();
        }
    });

    // Date input changes
    startDateInput.addEventListener('input', debounce((e) => {
        const date = parseDateFromInput(e.target.value);
        if (date) {
            homepageState.calendar.startDate = date;
            renderCalendars();
        }
    }, 500));

    endDateInput.addEventListener('input', debounce((e) => {
        const date = parseDateFromInput(e.target.value);
        if (date) {
            homepageState.calendar.endDate = date;
            renderCalendars();
        }
    }, 500));

    // Next month navigation
    nextMonthBtn.addEventListener('click', () => {
        homepageState.calendar.currentMonth1 = new Date(
            homepageState.calendar.currentMonth1.getFullYear(),
            homepageState.calendar.currentMonth1.getMonth() + 1,
            1
        );
        homepageState.calendar.currentMonth2 = new Date(
            homepageState.calendar.currentMonth2.getFullYear(),
            homepageState.calendar.currentMonth2.getMonth() + 1,
            1
        );
        renderCalendars();
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        homepageState.calendar.startDate = null;
        homepageState.calendar.endDate = null;
        startDateInput.value = '';
        endDateInput.value = '';
        dateSelect.selectedIndex = 0;
        renderCalendars();
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        calendarPicker.classList.add('hidden');
        homepageState.calendar.isOpen = false;
    });

    // Apply button
    applyBtn.addEventListener('click', () => {
        const { startDate, endDate } = homepageState.calendar;
        if (startDate && endDate) {
            const dateText = `${formatDateForInput(startDate)} - ${formatDateForInput(endDate)}`;
            dateSelect.innerHTML = `<option selected>${dateText}</option>`;
        }
        calendarPicker.classList.add('hidden');
        homepageState.calendar.isOpen = false;
    });

    // Close calendar when clicking outside
    document.addEventListener('click', (e) => {
        if (!dateSelect.contains(e.target) && !calendarPicker.contains(e.target)) {
            calendarPicker.classList.add('hidden');
            homepageState.calendar.isOpen = false;
        }
    });

    // Initial render
    renderCalendars();
}

// Render both calendars
function renderCalendars() {
    renderCalendar('calendar1Days', 'month1Name', homepageState.calendar.currentMonth1);
    renderCalendar('calendar2Days', 'month2Name', homepageState.calendar.currentMonth2);
}

// Render a single calendar month
function renderCalendar(daysContainerId, monthNameId, month) {
    const daysContainer = document.getElementById(daysContainerId);
    const monthNameEl = document.getElementById(monthNameId);

    // Update month name
    monthNameEl.textContent = `${getMonthName(month)} ${month.getFullYear()}`;

    // Clear previous days
    daysContainer.innerHTML = '';

    // Get first day of month and number of days
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = createElement('div', 'calendar-day disabled');
        daysContainer.appendChild(emptyDay);
    }

    // Add days of the month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(month.getFullYear(), month.getMonth(), day);
        const dayEl = createElement('div', 'calendar-day');
        dayEl.textContent = day;

        // Check if date is today
        if (isSameDay(date, today)) {
            dayEl.classList.add('today');
        }

        // Check if date is in the past
        if (date < today) {
            dayEl.classList.add('disabled');
        } else {
            // Check if date is selected
            const { startDate, endDate } = homepageState.calendar;
            if (startDate && isSameDay(date, startDate)) {
                dayEl.classList.add('selected');
            } else if (endDate && isSameDay(date, endDate)) {
                dayEl.classList.add('selected');
            } else if (startDate && endDate && date > startDate && date < endDate) {
                dayEl.classList.add('in-range');
            }

            // Click handler
            dayEl.addEventListener('click', () => {
                handleDateClick(date);
            });
        }

        daysContainer.appendChild(dayEl);
    }
}

// Handle date click in calendar
function handleDateClick(date) {
    const { startDate, endDate } = homepageState.calendar;

    if (!startDate || (startDate && endDate)) {
        // Start new range
        homepageState.calendar.startDate = date;
        homepageState.calendar.endDate = null;
        document.getElementById('startDateInput').value = formatDateForInput(date);
        document.getElementById('endDateInput').value = '';
    } else if (startDate && !endDate) {
        // Complete range
        if (date >= startDate) {
            homepageState.calendar.endDate = date;
            document.getElementById('endDateInput').value = formatDateForInput(date);
        } else {
            // Swap if end date is before start date
            homepageState.calendar.endDate = startDate;
            homepageState.calendar.startDate = date;
            document.getElementById('startDateInput').value = formatDateForInput(date);
            document.getElementById('endDateInput').value = formatDateForInput(homepageState.calendar.endDate);
        }
    }

    renderCalendars();
}

// Load and render featured events
function loadFeaturedEvents() {
    const container = document.getElementById('eventCardsContainer');

    // Show loading
    showLoading(container);

    // Get featured concerts (optionally filter by category)
    const filtered = filterConcertsByCategory(homepageState.concerts, homepageState.activeCategory);
    const featured = filtered.filter(concert => concert.featured);

    renderEventCards(featured, {
        title: 'Promoted',
        emptyMessage: 'No featured events match your selection.'
    });
}

function renderEventCards(concerts, { title, emptyMessage } = {}) {
    const container = document.getElementById('eventCardsContainer');
    const sectionTitle = document.querySelector('.section-title');

    if (sectionTitle && title) {
        sectionTitle.textContent = title;
    }

    // Hide loading
    hideLoading(container);

    // Render event cards
    if (concerts.length === 0) {
        container.innerHTML = `<p class="text-center">${emptyMessage || 'No events found.'}</p>`;
        return;
    }

    container.innerHTML = '';
    concerts.forEach(concert => {
        const card = createEventCard(concert);
        container.appendChild(card);
    });
}

// Create event card element
function createEventCard(concert) {
    const card = createElement('a', 'event-card');
    card.href = `artist.html?concertId=${concert.id}`;

    // Event image
    const image = createElement('img', 'event-card-image');
    if (concert.imageUrl) {
        image.src = concert.imageUrl;
    }
    image.alt = concert.eventName;
    card.appendChild(image);

    // Event content
    const content = createElement('div', 'event-card-content');

    // Promoted badge
    if (concert.featured) {
        const badge = createElement('span', 'event-card-promoted');
        badge.textContent = 'PROMOTED';
        content.appendChild(badge);
    }

    // Event title
    const title = createElement('h3', 'event-card-title');
    title.textContent = concert.eventName;
    content.appendChild(title);

    // Event subtitle
    const subtitle = createElement('p', 'event-card-subtitle');
    subtitle.textContent = concert.featured ? 'More than you can imagine' : `${concert.venueName} • ${concert.city}, ${concert.state}`;
    content.appendChild(subtitle);

    // Find tickets button
    const btn = createElement('button', 'event-card-btn');
    btn.textContent = 'Find Tickets';
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToSeats(concert.id);
    });
    content.appendChild(btn);

    card.appendChild(content);

    return card;
}

function filterConcertsBySearch(concerts, filters) {
    const locationQuery = filters.location ? filters.location.toLowerCase() : '';
    const searchQuery = filters.query ? filters.query.toLowerCase() : '';

    return concerts.filter(concert => {
        if (locationQuery) {
            const location = `${concert.city}, ${concert.state}`.toLowerCase();
            if (!location.includes(locationQuery)) {
                return false;
            }
        }

        if (searchQuery) {
            const searchable = [
                concert.artistName,
                concert.eventName,
                concert.venueName
            ].filter(Boolean).join(' ').toLowerCase();

            if (!searchable.includes(searchQuery)) {
                return false;
            }
        }

        if (filters.startDate || filters.endDate) {
            const concertDate = new Date(concert.date);
            if (filters.startDate && concertDate < filters.startDate) {
                return false;
            }
            if (filters.endDate && concertDate > filters.endDate) {
                return false;
            }
        }

        return true;
    });
}

function dedupeConcerts(concerts) {
    const seen = new Map();

    concerts.forEach(concert => {
        const key = getConcertIdentityKey(concert);
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, concert);
            return;
        }

        if (getConcertDateValue(concert) < getConcertDateValue(existing)) {
            seen.set(key, concert);
        }
    });

    return Array.from(seen.values());
}

function getConcertIdentityKey(concert) {
    const parts = [
        concert.eventName,
        concert.artistId || concert.artistName,
        concert.venueId || concert.venueName,
        concert.city,
        concert.state
    ].filter(Boolean);

    if (parts.length === 0) {
        return concert.id || '';
    }

    return parts.join('|').toLowerCase();
}

function getConcertDateValue(concert) {
    if (!concert || !concert.date) {
        return Number.POSITIVE_INFINITY;
    }

    const time = concert.time || '00:00';
    const parsed = new Date(`${concert.date}T${time}`);
    const value = parsed.getTime();
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

// Filter concerts by category
function filterConcertsByCategory(concerts, category) {
    if (!category || category === 'concerts' || category === 'cities') {
        return concerts;
    }

    return concerts.filter(concert => concert.category === category);
}

// Format category label for display
function formatCategoryLabel(category) {
    const labels = {
        pop: 'Pop',
        theater: 'Arts, Theater & Comedy',
        sports: 'Sports',
        family: 'Family',
        cities: 'Cities'
    };

    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Navigate to seats page
function navigateToSeats(concertId) {
    window.location.href = `seats.html?concertId=${concertId}`;
}
