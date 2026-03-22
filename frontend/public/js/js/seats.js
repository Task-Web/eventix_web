// Seats Page Main Controller - Eventix Clone

// Global seat selection state
const seatsState = {
    concert: null,
    venue: null,
    seatData: null,
    selectedSeats: [],
    priceRange: { min: 0, max: 0 },
    currentTab: 'lowest', // 'lowest' or 'best'
    availableSeats: []
};

// Cart timer state
let cartTimerInterval = null;
let cartTimerStartTime = null;
const CART_TIMER_DURATION = 600; // 10 minutes in seconds
let focusedSeatId = null;

// Initialize seats page
document.addEventListener('DOMContentLoaded', async () => {
    await loadSeatsData();
    await initSeatMap();
    initTicketPanel();
    initLegend();
    initCart();
    restoreCartTimer();
});

/**
 * Load concert, venue, and seat data
 */
async function loadSeatsData() {
    const params = getURLParams();
    const concertId = params.concertId;

    if (!concertId) {
        console.error('No concertId provided');
        return;
    }

    const catalog = await loadCatalogState();
    const concerts = catalog.concerts?.concerts || [];
    const venues = catalog.venues?.venues || [];
    const seatMaps = catalog.seatMaps || {};

    // Load concert data
    if (concerts.length > 0) {
        adjustConcertSchedule(concerts);
    }
    seatsState.concert = concerts.find(c => c.id === concertId);

    if (!seatsState.concert) {
        console.error('Concert not found');
        return;
    }

    // Load venue data
    seatsState.venue = venues.find(v => v.id === seatsState.concert.venueId);

    if (!seatsState.venue) {
        console.error('Venue not found');
        return;
    }

    // Load seat map data
    let seatMapFile = seatsState.venue.seatMapFile;
    if (!seatMapFile && seatsState.venue.id === 'sphere') {
        seatMapFile = 'sphere-seats.json';
        seatsState.venue.seatMapFile = seatMapFile;
    }

    if (!seatMapFile) {
        console.error('Seat map file not configured for venue');
        return;
    }

    seatsState.seatData = seatMaps[seatMapFile];

    if (!seatsState.seatData) {
        console.error('Seat data not found');
        return;
    }

    // Update page header
    updatePageHeader();
    initEventHeaderActions();
}

/**
 * Update page header with event info
 */
function updatePageHeader() {
    const concert = seatsState.concert;

    document.getElementById('eventName').textContent = concert.eventName;
    document.getElementById('eventNameBreadcrumb').textContent = concert.eventName;
    document.getElementById('eventDateTime').textContent = formatDateTime(concert.date, concert.time);
    document.getElementById('venueLink').textContent = `${concert.venueName}, ${concert.city}, ${concert.state}`;

    const thumb = document.querySelector('.event-thumb');
    if (thumb && concert.imageUrl) {
        thumb.src = concert.imageUrl;
        thumb.alt = concert.eventName;
    }

    const venueLink = document.getElementById('venueLink');
    if (venueLink) {
        venueLink.href = `index.html?location=${encodeURIComponent(`${concert.city}, ${concert.state}`)}`;
    }

    const categoryLink = document.getElementById('breadcrumbCategoryLink');
    const genreLink = document.getElementById('breadcrumbGenreLink');
    if (categoryLink) {
        categoryLink.textContent = 'Concert Tickets';
        categoryLink.href = 'index.html?category=concerts';
    }
    if (genreLink) {
        const categoryLabel = formatCategoryLabel(concert.category);
        genreLink.textContent = categoryLabel;
        genreLink.href = `index.html?category=${encodeURIComponent(concert.category || 'concerts')}`;
    }
}

/**
 * Initialize seat map
 */
async function initSeatMap() {
    // Initialize renderer
    initSeatMapRenderer(seatsState.seatData);

    // Initialize zoom controls
    initZoomControls();

    // Initialize tooltip manager
    initTooltipManager();

    await applyAvailableSeatsFromState();

    // Get available seats for ticket panel
    seatsState.availableSeats = getAvailableSeats();
}

async function applyAvailableSeatsFromState() {
    if (!window.eventixApi || !seatsState.concert || typeof mapState === 'undefined') {
        return;
    }

    try {
        const current = await window.eventixApi.getState();
        const availableSeats = current?.state?.data?.inventory?.availableSeatsByConcert?.[seatsState.concert.id];

        if (!Array.isArray(availableSeats) || availableSeats.length === 0) {
            return;
        }

        const availableSeatIds = new Set(availableSeats);
        mapState.sections.forEach(section => {
            const seats = mapState.seats.get(section.id) || [];
            seats.forEach(seat => {
                if (availableSeatIds.has(seat.id)) {
                    seat.status = 'available';
                }
            });
        });

        renderSeatMap();
    } catch (error) {
        console.warn('Failed to apply available seats from state:', error);
    }
}

/**
 * Initialize ticket panel
 */
function initTicketPanel() {
    initPriceRangeSlider();
    initTicketTabs();
    initFiltersButton();
    renderTicketCards();
}

/**
 * Initialize price range slider
 */
function initPriceRangeSlider() {
    const priceMinSlider = document.getElementById('priceMinSlider');
    const priceMaxSlider = document.getElementById('priceMaxSlider');
    const priceMinDisplay = document.getElementById('priceMinDisplay');
    const priceMaxDisplay = document.getElementById('priceMaxDisplay');

    const priceBounds = getSeatPriceBounds();
    const minPrice = priceBounds.min;
    const maxPrice = priceBounds.max;

    seatsState.priceRange = { min: minPrice, max: maxPrice };

    priceMinSlider.min = minPrice;
    priceMinSlider.max = maxPrice;
    priceMinSlider.value = minPrice;

    priceMaxSlider.min = minPrice;
    priceMaxSlider.max = maxPrice;
    priceMaxSlider.value = maxPrice;

    priceMinDisplay.textContent = formatPrice(minPrice);
    priceMaxDisplay.textContent = `${formatPrice(maxPrice)}+`;

    priceMinSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value > seatsState.priceRange.max) {
            seatsState.priceRange.max = value;
            priceMaxSlider.value = value;
            priceMaxDisplay.textContent = `${formatPrice(value)}+`;
        }
        seatsState.priceRange.min = value;
        priceMinDisplay.textContent = formatPrice(value);
        renderTicketCards();
    });

    priceMaxSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value < seatsState.priceRange.min) {
            seatsState.priceRange.min = value;
            priceMinSlider.value = value;
            priceMinDisplay.textContent = formatPrice(value);
        }
        seatsState.priceRange.max = value;
        priceMaxDisplay.textContent = `${formatPrice(value)}+`;
        renderTicketCards();
    });
}

/**
 * Initialize ticket tabs
 */
function initTicketTabs() {
    const tabs = document.querySelectorAll('.ticket-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            seatsState.currentTab = tabType;

            // Update active state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Re-render tickets
            renderTicketCards();
        });
    });
}

/**
 * Initialize filters button
 */
function initFiltersButton() {
    const filtersBtn = document.getElementById('filtersBtn');

    filtersBtn.addEventListener('click', () => {
        const panel = document.querySelector('.ticket-panel');
        if (!panel) return;

        panel.classList.toggle('filters-collapsed');
        const isCollapsed = panel.classList.contains('filters-collapsed');
        filtersBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 2h6v2H0V2zm8 0h8v2H8V2zM0 7h8v2H0V7zm10 0h6v2h-6V7zM0 12h4v2H0v-2zm6 0h10v2H6v-2z"/>
            </svg>
            ${isCollapsed ? 'Show Filters' : 'Hide Filters'}
        `;
    });
}

/**
 * Initialize event header actions
 */
function initEventHeaderActions() {
    const moreInfoBtn = document.querySelector('.more-info-btn');
    if (moreInfoBtn && seatsState.concert) {
        moreInfoBtn.addEventListener('click', () => {
            window.location.href = `artist.html?concertId=${seatsState.concert.id}`;
        });
    }
}

/**
 * Format category label for display
 * @param {string} category - Category value
 * @returns {string} - Display label
 */
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

/**
 * Render ticket cards in the panel
 */
function renderTicketCards() {
    const container = document.getElementById('ticketCardsContainer');

    // Filter seats by price range
    let filteredSeats = seatsState.availableSeats.filter(seat => {
        return seat.price >= seatsState.priceRange.min &&
               seat.price <= seatsState.priceRange.max;
    });

    // Sort based on current tab
    if (seatsState.currentTab === 'lowest') {
        filteredSeats = sortSeatsByPrice(filteredSeats);
    } else if (seatsState.currentTab === 'best') {
        filteredSeats = sortSeatsByDistance(filteredSeats);
    }

    // Clear container
    hideLoading(container);
    container.innerHTML = '';

    if (filteredSeats.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--tm-gray-med);">No tickets found in this price range.</p>';
        return;
    }

    // Render ticket cards
    filteredSeats.forEach(seat => {
        const card = createTicketCard(seat);
        container.appendChild(card);
    });

    updateTicketCardStates();
    syncFocusNotice();
}

/**
 * Create ticket card element
 * @param {Object} seat - Seat object
 * @returns {HTMLElement} - Ticket card element
 */
function createTicketCard(seat) {
    const card = createElement('div', 'ticket-card');
    card.dataset.seatId = seat.id;
    if (seat.status === 'selected') {
        card.classList.add('ticket-card--selected');
    }
    if (focusedSeatId === seat.id) {
        card.classList.add('ticket-card--focused');
    }

    // Ticket icon
    const icon = createElement('div', 'ticket-icon');
    icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="var(--tm-gray-med)"/>
        </svg>
    `;
    card.appendChild(icon);

    // Ticket info
    const info = createElement('div', 'ticket-info');

    const location = createElement('div', 'ticket-location');
    location.textContent = `Sec ${seat.sectionName} • Row ${seat.row} • Seat ${seat.seatNumber}`;
    info.appendChild(location);

    const type = createElement('div', 'ticket-type');
    type.textContent = seat.ticketType;
    info.appendChild(type);

    card.appendChild(info);

    // Ticket price
    const price = createElement('div', 'ticket-price');
    price.textContent = formatPrice(seat.price);
    card.appendChild(price);

    // Click handler
    card.addEventListener('click', () => {
        handleTicketCardClick(seat);
    });

    return card;
}

/**
 * Handle ticket card click
 * @param {Object} seat - Seat object
 */
function handleTicketCardClick(seat) {
    handleSeatSelection(seat, { syncMap: true, syncPanel: true });
}

/**
 * Get min/max price from available seats
 * @returns {Object} - {min, max} price bounds
 */
function getSeatPriceBounds() {
    let min = Infinity;
    let max = -Infinity;

    if (seatsState.seatData && Array.isArray(seatsState.seatData.sections)) {
        seatsState.seatData.sections.forEach(section => {
            const priceRange = section.priceRange;
            if (!priceRange) return;
            if (Number.isFinite(priceRange.min)) {
                min = Math.min(min, priceRange.min);
            }
            if (Number.isFinite(priceRange.max)) {
                max = Math.max(max, priceRange.max);
            }
        });
    } else if (seatsState.availableSeats && seatsState.availableSeats.length > 0) {
        seatsState.availableSeats.forEach(seat => {
            if (!Number.isFinite(seat.price)) return;
            min = Math.min(min, seat.price);
            max = Math.max(max, seat.price);
        });
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { min: 0, max: 0 };
    }

    return { min, max };
}

/**
 * Handle seat selection from canvas
 * @param {Object} seat - Seat object
 */
function handleSeatSelection(seat, options = {}) {
    if (!seat || seat.status === 'unavailable') {
        return;
    }

    const shouldSyncMap = options.syncMap === true;
    const shouldSyncPanel = options.syncPanel === true;
    const wasEmpty = seatsState.selectedSeats.length === 0;

    if (focusedSeatId !== seat.id) {
        focusedSeatId = seat.id;
        if (shouldSyncMap) {
            focusSeatOnMap(seat);
        }
        if (shouldSyncPanel) {
            focusTicketCard(seat.id, true);
        }
        renderSeatMap();
        updateTicketCardStates();
        syncFocusNotice();
        return;
    }

    const selectionChanged = toggleSeatSelection(seat);
    renderSeatMap();
    updateCart();
    updateTicketCardStates();
    syncFocusNotice();

    if (selectionChanged) {
        focusedSeatId = null;
        renderSeatMap();
        updateTicketCardStates();
        syncFocusNotice();
    }

    // Start timer if this is the first seat added to an empty cart
    if (wasEmpty && seatsState.selectedSeats.length > 0) {
        console.log('Starting cart timer - first seat added');
        startCartTimer();
    }
    // Stop timer if cart becomes empty
    else if (seatsState.selectedSeats.length === 0) {
        console.log('Stopping cart timer - cart is now empty');
        stopCartTimer();
    }
}

/**
 * Initialize legend toggle
 */
function initLegend() {
    const legendToggle = document.getElementById('legendToggle');
    const legendContent = document.getElementById('legendContent');

    if (legendToggle && legendContent) {
        legendToggle.addEventListener('click', () => {
            legendContent.classList.toggle('hidden');
        });
    }
}

/**
 * Initialize cart functionality
 */
function initCart() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');

    // Checkout button
    checkoutBtn.addEventListener('click', () => {
        handleCheckout();
    });

    // Clear cart button
    clearCartBtn.addEventListener('click', () => {
        clearCart();
    });
}

/**
 * Update cart display
 */
function updateCart() {
    const cartContainer = document.getElementById('selectedSeatsCart');
    const seatsList = document.getElementById('selectedSeatsList');
    const totalAmount = document.getElementById('cartTotalAmount');

    // Show/hide cart based on selected seats
    if (seatsState.selectedSeats.length === 0) {
        cartContainer.classList.add('hidden');
        return;
    }

    cartContainer.classList.remove('hidden');

    // Clear current list
    seatsList.innerHTML = '';

    // Calculate total
    let total = 0;

    // Add timer display at the top if timer is active
    if (cartTimerStartTime) {
        const timerDisplay = createElement('div', 'cart-timer-display');
        timerDisplay.id = 'cartTimerDisplay';
        timerDisplay.style.cssText = 'background: #FEF3C7; padding: 12px; border-radius: 8px; margin-bottom: 12px; text-align: center; font-weight: 600; color: #92400E;';
        const timeLeft = getCartTimeRemaining();
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.innerHTML = `<div style="font-size: 12px; margin-bottom: 4px;">⏱️ Time remaining to complete booking</div><div style="font-size: 20px; color: ${timeLeft < 60 ? '#DC2626' : '#92400E'};">${minutes}:${seconds.toString().padStart(2, '0')}</div>`;
        seatsList.appendChild(timerDisplay);
    }

    // Render each selected seat
    seatsState.selectedSeats.forEach(seat => {
        total += seat.price;

        const seatItem = createElement('div', 'selected-seat-item');

        const seatInfo = createElement('div', 'selected-seat-info');
        const sectionName = createElement('div', 'selected-seat-section');
        sectionName.textContent = seat.sectionName;
        const location = createElement('div', 'selected-seat-location');
        location.textContent = `Row ${seat.row}, Seat ${seat.seatNumber}`;
        seatInfo.appendChild(sectionName);
        seatInfo.appendChild(location);

        const price = createElement('span', 'selected-seat-price');
        price.textContent = formatPrice(seat.price);

        const removeBtn = createElement('button', 'remove-seat-btn');
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('data-seat-id', seat.id);
        removeBtn.addEventListener('click', () => {
            removeSeatFromCart(seat.id);
        });

        seatItem.appendChild(seatInfo);
        seatItem.appendChild(price);
        seatItem.appendChild(removeBtn);

        seatsList.appendChild(seatItem);
    });

    // Update total
    totalAmount.textContent = formatPrice(total);
}

/**
 * Remove seat from cart
 */
function removeSeatFromCart(seatId) {
    const index = seatsState.selectedSeats.findIndex(s => s.id === seatId);
    if (index >= 0) {
        const seat = seatsState.selectedSeats[index];
        seat.status = 'available';
        seatsState.selectedSeats.splice(index, 1);
        if (focusedSeatId === seatId) {
            focusedSeatId = null;
        }
        renderSeatMap();
        updateCart();
        updateTicketCardStates();
        syncFocusNotice();

        // Stop timer if cart becomes empty
        if (seatsState.selectedSeats.length === 0) {
            stopCartTimer();
        }
    }
}

/**
 * Clear all selected seats
 */
function clearCart() {
    seatsState.selectedSeats.forEach(seat => {
        seat.status = 'available';
    });
    seatsState.selectedSeats = [];
    focusedSeatId = null;
    renderSeatMap();
    updateCart();
    updateTicketCardStates();
    syncFocusNotice();
    stopCartTimer();
}

/**
 * Handle checkout
 */
function handleCheckout() {
    if (seatsState.selectedSeats.length === 0) {
        alert('Please select at least one seat.');
        return;
    }

    const concert = seatsState.concert;

    // Calculate average price
    const totalPrice = seatsState.selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const avgPrice = totalPrice / seatsState.selectedSeats.length;

    // Create seat details array with full information for each seat
    const seatDetails = seatsState.selectedSeats.map(seat => ({
        id: seat.id,
        section: seat.sectionName,
        row: seat.row,
        seatNumber: seat.seatNumber,
        price: seat.price
    }));

    // Save timer state to sessionStorage before navigation
    saveCartTimerState();

    // Persist cart snapshot to backend state
    syncCartState({
        concert: concert,
        selectedSeats: seatsState.selectedSeats,
        totalPrice: totalPrice
    });

    // Navigate to payment page
    const params = new URLSearchParams({
        concertId: concert.id,
        price: avgPrice.toFixed(2),
        quantity: seatsState.selectedSeats.length,
        seatDetails: JSON.stringify(seatDetails),
        eventName: concert.eventName,
        venueName: `${concert.venueName}, ${concert.city}, ${concert.state}`,
        eventDate: formatDate(concert.date),
        eventDateTime: formatDateTime(concert.date, concert.time)
    });

    window.location.href = `payment.html?${params.toString()}`;
}

/**
 * Persist the current cart selection to backend state
 */
async function syncCartState(snapshot) {
    if (!window.eventixApi || !snapshot?.concert) {
        return;
    }

    const payload = {
        cart: {
            concertId: snapshot.concert.id,
            eventName: snapshot.concert.eventName,
            venueName: `${snapshot.concert.venueName}, ${snapshot.concert.city}, ${snapshot.concert.state}`,
            eventDateTime: formatDateTime(snapshot.concert.date, snapshot.concert.time),
            quantity: snapshot.selectedSeats.length,
            selectedSeats: snapshot.selectedSeats.map(seat => ({
                id: seat.id,
                section: seat.sectionName,
                row: seat.row,
                seatNumber: seat.seatNumber,
                price: seat.price
            })),
            totalPrice: snapshot.totalPrice,
            updatedAtUTC: new Date().toISOString()
        }
    };

    try {
        await window.eventixApi.patchState(payload, 'Saved cart for checkout');
    } catch (error) {
        console.warn('Failed to save cart state:', error);
    }
}

/**
 * Start cart timer when first seat is added
 */
function startCartTimer() {
    console.log('startCartTimer called');

    // Clear any existing timer
    if (cartTimerInterval) {
        clearInterval(cartTimerInterval);
    }

    // Set start time
    cartTimerStartTime = Date.now();
    console.log('Cart timer start time set:', cartTimerStartTime);

    // Save to sessionStorage
    sessionStorage.setItem('cartTimerStart', cartTimerStartTime.toString());

    // Start interval to update display
    cartTimerInterval = setInterval(() => {
        const timeLeft = getCartTimeRemaining();

        if (timeLeft <= 0) {
            handleCartTimerExpired();
        } else {
            updateCart(); // Refresh display
        }
    }, 1000);

    console.log('Cart timer interval started');
}

/**
 * Stop cart timer when cart becomes empty
 */
function stopCartTimer() {
    if (cartTimerInterval) {
        clearInterval(cartTimerInterval);
        cartTimerInterval = null;
    }
    cartTimerStartTime = null;
    sessionStorage.removeItem('cartTimerStart');
    updateCart(); // Refresh display to remove timer
}

/**
 * Get remaining time in seconds
 */
function getCartTimeRemaining() {
    if (!cartTimerStartTime) return CART_TIMER_DURATION;

    const elapsed = Math.floor((Date.now() - cartTimerStartTime) / 1000);
    const remaining = CART_TIMER_DURATION - elapsed;
    return Math.max(0, remaining);
}

/**
 * Save cart timer state to sessionStorage
 */
function saveCartTimerState() {
    if (cartTimerStartTime) {
        sessionStorage.setItem('cartTimerStart', cartTimerStartTime.toString());
    }
}

/**
 * Restore cart timer from sessionStorage
 */
function restoreCartTimer() {
    const savedStartTime = sessionStorage.getItem('cartTimerStart');

    if (savedStartTime && seatsState.selectedSeats.length > 0) {
        cartTimerStartTime = parseInt(savedStartTime);

        const timeLeft = getCartTimeRemaining();

        if (timeLeft <= 0) {
            handleCartTimerExpired();
        } else {
            // Restart the interval
            cartTimerInterval = setInterval(() => {
                const timeLeft = getCartTimeRemaining();

                if (timeLeft <= 0) {
                    handleCartTimerExpired();
                } else {
                    updateCart(); // Refresh display
                }
            }, 1000);
        }
    }
}

/**
 * Handle cart timer expiration
 */
function handleCartTimerExpired() {
    stopCartTimer();
    clearCart();
    alert('Your reservation time has expired. The seats have been released. Please select your seats again.');
}

/**
 * Toggle seat selection
 * @param {Object} seat - Seat object
 * @returns {boolean} - true if selection state changed
 */
function toggleSeatSelection(seat) {
    const index = seatsState.selectedSeats.findIndex(s => s.id === seat.id);

    if (index >= 0) {
        seatsState.selectedSeats.splice(index, 1);
        seat.status = 'available';
        return true;
    }

    seatsState.selectedSeats.push(seat);
    seat.status = 'selected';
    return true;
}

/**
 * Highlight and optionally scroll to the matching ticket card
 * @param {string} seatId - Seat id
 * @param {boolean} shouldScroll - Whether to scroll into view
 */
function focusTicketCard(seatId, shouldScroll) {
    const card = document.querySelector(`.ticket-card[data-seat-id="${seatId}"]`);
    if (!card) {
        setTicketFocusNotice('Focused seat is not in the current list. Adjust filters or tabs to locate it.');
        return;
    }

    if (shouldScroll) {
        const scrollContainer = document.querySelector('.ticket-panel');
        if (scrollContainer) {
            const cardRect = card.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const offset = cardRect.top - containerRect.top;
            const target = scrollContainer.scrollTop + offset - (containerRect.height / 2) + (cardRect.height / 2);
            scrollContainer.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        } else {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    setTicketFocusNotice('');
}

/**
 * Sync ticket card styles with focused/selected state
 */
function updateTicketCardStates() {
    const cards = document.querySelectorAll('.ticket-card');
    cards.forEach(card => {
        const seatId = card.dataset.seatId;
        const isFocused = focusedSeatId === seatId;
        const isSelected = seatsState.selectedSeats.some(seat => seat.id === seatId);

        card.classList.toggle('ticket-card--focused', isFocused);
        card.classList.toggle('ticket-card--selected', isSelected);
    });
}

/**
 * Show or hide the focus notice based on current filters and focus state
 */
function syncFocusNotice() {
    if (!focusedSeatId) {
        setTicketFocusNotice('');
        return;
    }

    const card = document.querySelector(`.ticket-card[data-seat-id="${focusedSeatId}"]`);
    if (!card) {
        setTicketFocusNotice('Focused seat is not in the current list. Adjust filters or tabs to locate it.');
        return;
    }

    setTicketFocusNotice('');
}

/**
 * Update the focus notice content
 * @param {string} message - Notice message
 */
function setTicketFocusNotice(message) {
    const notice = document.getElementById('ticketFocusNotice');
    if (!notice) return;

    if (!message) {
        notice.textContent = '';
        notice.classList.add('hidden');
        return;
    }

    notice.textContent = message;
    notice.classList.remove('hidden');
}
