// Artist Page JavaScript - Eventix Clone

// Global state
const artistState = {
    concerts: [],
    allConcerts: [],
    filters: {
        location: '',
        dates: '',
        artist: ''
    },
    viewMode: 'list', // or 'calendar'
    activeTab: 'concerts'
};

// Initialize artist page
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    applyURLFilters();
    initTabs();
    initViewToggle();
    initFilters();
    initFavoriteButton();
    initPromotedButton();
    renderConcertCards();
});

// Load data from backend state
async function loadData() {
    const catalog = await loadCatalogState();
    artistState.allConcerts = catalog.concerts?.concerts || [];
    adjustConcertSchedule(artistState.allConcerts);
}

// Apply filters from URL parameters
function applyURLFilters() {
    const params = getURLParams();

    // Get artist filter (either from artist param or concertId)
    if (params.artist) {
        artistState.filters.artist = params.artist.toLowerCase();
    } else if (params.concertId) {
        // Find concert by ID and use its artist name
        const concert = artistState.allConcerts.find(c => c.id === params.concertId);
        if (concert) {
            artistState.filters.artist = concert.artistName.toLowerCase();
        }
    }

    if (params.location) {
        artistState.filters.location = params.location;
    }

    if (params.startDate && params.endDate) {
        artistState.filters.startDate = parseDateFromInput(params.startDate);
        artistState.filters.endDate = parseDateFromInput(params.endDate);
    }

    // Filter concerts
    filterConcerts();

    // Update page header with artist info
    if (artistState.concerts.length > 0) {
        const firstConcert = artistState.concerts[0];
        updatePageHeader(firstConcert);
    }
}

// Update page header with artist information
function updatePageHeader(concert) {
    document.getElementById('artistTitle').textContent = `${concert.artistName} Tickets`;
    document.getElementById('artistNameBreadcrumb').textContent = `${concert.artistName} Tickets`;
    document.getElementById('categoryBadge').textContent = concert.category;
    const categoryLink = document.getElementById('categoryBreadcrumbLink');
    if (categoryLink) {
        categoryLink.textContent = formatCategoryLabel(concert.category);
        categoryLink.href = `index.html?category=${encodeURIComponent(concert.category)}`;
    }
    const artistImage = document.querySelector('.artist-image');
    if (artistImage && concert.imageUrl) {
        artistImage.src = concert.imageUrl;
        artistImage.alt = concert.artistName;
    }
    if (concert.rating) {
        const ratingEl = document.getElementById('artistRating');
        ratingEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 0l2.163 5.329 5.837.424-4.424 3.764 1.311 5.683L8 12.18 3.113 15.2l1.311-5.683L.0 5.753l5.837-.424L8 0z"/>
            </svg>
            ${concert.rating}
        `;
    }
}

// Filter concerts based on current filters
function filterConcerts() {
    artistState.concerts = artistState.allConcerts.filter(concert => {
        // Filter by artist
        if (artistState.filters.artist) {
            if (!concert.artistName.toLowerCase().includes(artistState.filters.artist)) {
                return false;
            }
        }

        // Filter by location
        if (artistState.filters.location) {
            const location = `${concert.city}, ${concert.state}`.toLowerCase();
            if (!location.includes(artistState.filters.location.toLowerCase())) {
                return false;
            }
        }

        // Filter by date range
        if (artistState.filters.startDate && artistState.filters.endDate) {
            const concertDate = new Date(concert.date);
            if (concertDate < artistState.filters.startDate || concertDate > artistState.filters.endDate) {
                return false;
            }
        }

        // Filter by date preset (if selected)
        if (!passesDateFilter(concert)) {
            return false;
        }

        return true;
    });

    // Update results count
    document.getElementById('resultsCount').textContent = artistState.concerts.length;
}

// Initialize tabs
function initTabs() {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabType = tab.dataset.tab;
            artistState.activeTab = tabType;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            renderConcertCards();
        });
    });
}

// Initialize view toggle
function initViewToggle() {
    const viewBtns = document.querySelectorAll('.view-btn');

    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            artistState.viewMode = view;

            // Update active state
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-render (for now just keep list view)
            renderConcertCards();
        });
    });
}

// Initialize filters
function initFilters() {
    const locationFilter = document.getElementById('locationFilter');
    const datesFilter = document.getElementById('datesFilter');

    populateFilterOptions(locationFilter, datesFilter);

    locationFilter.addEventListener('change', () => {
        artistState.filters.location = locationFilter.value;
        filterConcerts();
        renderConcertCards();
    });

    datesFilter.addEventListener('change', () => {
        artistState.filters.dates = datesFilter.value;
        artistState.filters.startDate = null;
        artistState.filters.endDate = null;
        filterConcerts();
        renderConcertCards();
    });
}

// Populate filter options
function populateFilterOptions(locationFilter, datesFilter) {
    const locations = Array.from(new Set(artistState.allConcerts.map(concert => `${concert.city}, ${concert.state}`)));
    locationFilter.innerHTML = '<option value="">All Locations</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });

    const monthKeys = Array.from(new Set(artistState.allConcerts.map(concert => concert.date.slice(0, 7))));
    datesFilter.innerHTML = '<option value="">All Dates</option>';
    datesFilter.innerHTML += '<option value="next-30">Next 30 Days</option>';
    datesFilter.innerHTML += '<option value="next-90">Next 3 Months</option>';

    const years = Array.from(new Set(artistState.allConcerts.map(concert => concert.date.slice(0, 4))));
    years.forEach(year => {
        datesFilter.innerHTML += `<option value="year-${year}">${year}</option>`;
    });

    monthKeys.forEach(key => {
        const [year, month] = key.split('-').map(Number);
        const label = `${getMonthName(new Date(year, month - 1, 1))} ${year}`;
        datesFilter.innerHTML += `<option value="month-${key}">${label}</option>`;
    });

    if (artistState.filters.location) {
        locationFilter.value = artistState.filters.location;
    }

    if (artistState.filters.dates) {
        datesFilter.value = artistState.filters.dates;
    }
}

// Render concert cards
function renderConcertCards() {
    const container = document.getElementById('concertCardsContainer');
    const filtersRow = document.querySelector('.filters-row');
    const viewToggle = document.querySelector('.view-toggle');
    const listingsTitle = document.querySelector('.listings-title');

    if (artistState.activeTab !== 'concerts') {
        hideLoading(container);
        container.innerHTML = `<p style="text-align: center; padding: 40px; color: var(--tm-gray-med);">No ${artistState.activeTab} content available yet.</p>`;
        if (filtersRow) filtersRow.classList.add('hidden');
        if (viewToggle) viewToggle.classList.add('hidden');
        if (listingsTitle) {
            listingsTitle.innerHTML = `${artistState.activeTab.toUpperCase()} <span>0 RESULTS</span>`;
        }
        return;
    }

    if (filtersRow) filtersRow.classList.remove('hidden');
    if (viewToggle) viewToggle.classList.remove('hidden');
    if (listingsTitle) {
        listingsTitle.innerHTML = `CONCERTS <span id="resultsCount">${artistState.concerts.length}</span> RESULTS`;
    }

    if (artistState.concerts.length === 0) {
        hideLoading(container);
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--tm-gray-med);">No concerts found matching your criteria.</p>';
        return;
    }

    hideLoading(container);
    container.innerHTML = '';

    if (artistState.viewMode === 'calendar') {
        renderCalendarGroups(container, artistState.concerts);
    } else {
        artistState.concerts.forEach(concert => {
            const card = createConcertCard(concert);
            container.appendChild(card);
        });
    }
}

// Create concert card element
function createConcertCard(concert) {
    const card = createElement('div', 'concert-card');

    // Date column
    const dateCol = createElement('div', 'concert-date');

    if (concert.nearYou) {
        const badge = createElement('span', 'concert-date-badge');
        badge.textContent = 'NEAR YOU';
        dateCol.appendChild(badge);
    }

    const concertDate = new Date(concert.date);
    const monthEl = createElement('div', 'concert-date-month');
    monthEl.textContent = getMonthAbbr(concertDate).toUpperCase();
    dateCol.appendChild(monthEl);

    const dayEl = createElement('div', 'concert-date-day');
    dayEl.textContent = concertDate.getDate();
    dateCol.appendChild(dayEl);

    card.appendChild(dateCol);

    // Details column
    const detailsCol = createElement('div', 'concert-details');

    const timeEl = createElement('div', 'concert-time');
    timeEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 4v4l3 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        ${getDayAbbr(concertDate)} • ${formatTime(concert.time)}
    `;
    detailsCol.appendChild(timeEl);

    const nameEl = createElement('h3', 'concert-name');
    nameEl.textContent = concert.eventName;
    detailsCol.appendChild(nameEl);

    const venueEl = createElement('div', 'concert-venue');
    venueEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 0C5.24 0 3 2.24 3 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 7.5c-1.38 0-2.5-1.12-2.5-2.5S6.62 2.5 8 2.5s2.5 1.12 2.5 2.5S9.38 7.5 8 7.5z" fill="currentColor"/>
        </svg>
        ${concert.city}, ${concert.state} • ${concert.venueName}
    `;
    detailsCol.appendChild(venueEl);

    card.appendChild(detailsCol);

    // Actions column
    const actionsCol = createElement('div', 'concert-actions');

    const findTicketsBtn = createElement('button', 'find-tickets-btn');
    findTicketsBtn.innerHTML = `
        Find Tickets
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
    `;
    findTicketsBtn.addEventListener('click', () => {
        navigateToSeats(concert.id);
    });
    actionsCol.appendChild(findTicketsBtn);

    card.appendChild(actionsCol);

    return card;
}

// Render concerts grouped by month
function renderCalendarGroups(container, concerts) {
    const groups = concerts.reduce((acc, concert) => {
        const key = concert.date.slice(0, 7);
        if (!acc[key]) acc[key] = [];
        acc[key].push(concert);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach(key => {
        const [year, month] = key.split('-').map(Number);
        const header = createElement('div', 'calendar-group-title');
        header.textContent = `${getMonthName(new Date(year, month - 1, 1))} ${year}`;
        container.appendChild(header);

        groups[key].forEach(concert => {
            const card = createConcertCard(concert);
            container.appendChild(card);
        });
    });
}

// Initialize favorite button toggle
function initFavoriteButton() {
    const favoriteBtn = document.querySelector('.favorite-btn');
    if (!favoriteBtn) return;

    favoriteBtn.addEventListener('click', () => {
        const isActive = favoriteBtn.classList.toggle('active');
        favoriteBtn.setAttribute('aria-pressed', isActive.toString());
    });
}

// Initialize promoted hotel button
function initPromotedButton() {
    const promotedBtn = document.querySelector('.promoted-btn');
    if (!promotedBtn) return;

    promotedBtn.addEventListener('click', () => {
        const city = artistState.concerts[0]?.city || artistState.allConcerts[0]?.city || 'Las Vegas';
        const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}`;
        window.open(url, '_blank', 'noopener');
    });
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

    if (!category) {
        return 'Concerts';
    }

    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Check if a concert passes the selected date filter
function passesDateFilter(concert) {
    const filter = artistState.filters.dates;
    if (!filter) return true;

    const concertDate = new Date(concert.date);
    const now = new Date();

    if (filter === 'next-30') {
        const end = new Date(now);
        end.setDate(end.getDate() + 30);
        return concertDate >= now && concertDate <= end;
    }

    if (filter === 'next-90') {
        const end = new Date(now);
        end.setDate(end.getDate() + 90);
        return concertDate >= now && concertDate <= end;
    }

    if (filter.startsWith('year-')) {
        const year = filter.split('-')[1];
        return concert.date.startsWith(year);
    }

    if (filter.startsWith('month-')) {
        const monthKey = filter.replace('month-', '');
        return concert.date.startsWith(monthKey);
    }

    return true;
}

// Navigate to seats page
function navigateToSeats(concertId) {
    window.location.href = `seats.html?concertId=${concertId}`;
}
