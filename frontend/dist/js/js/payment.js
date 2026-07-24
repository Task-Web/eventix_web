// Payment Page Controller - Eventix Clone

// Timer state
let timeRemaining = 600; // 10 minutes in seconds (default)
let timerInterval = null;
const CART_TIMER_DURATION = 600; // 10 minutes in seconds
const CHECKOUT_SYNC_DELAY = 400;

// Initialize payment page
document.addEventListener('DOMContentLoaded', () => {
    initTimerFromSession();
    initForm();
    initPlaceOrderButton();
    initNavigationLinks();
    loadOrderDetails();
    initCheckoutStateSync();
});

/**
 * Initialize timer from sessionStorage (continues from seats page)
 */
function initTimerFromSession() {
    const savedStartTime = sessionStorage.getItem('cartTimerStart');

    if (savedStartTime) {
        const startTime = parseInt(savedStartTime);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeRemaining = Math.max(0, CART_TIMER_DURATION - elapsed);

        if (timeRemaining <= 0) {
            handleTimerExpired();
            return;
        }
    } else {
        // Fallback to 10 minutes if no saved state
        timeRemaining = CART_TIMER_DURATION;
    }

    initTimer();
}

/**
 * Initialize and start the countdown timer
 */
function initTimer() {
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            handleTimerExpired();
        }
    }, 1000);
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('countdown').textContent = display;

    // Change color to red when less than 1 minute
    if (timeRemaining < 60) {
        document.getElementById('countdown').style.color = '#DC2626';
    }
}

/**
 * Handle timer expiration
 */
function handleTimerExpired() {
    alert('Your session has expired. Please select your seats again.');
    window.location.href = 'seats.html?concertId=bruno-mars-dec30';
}

/**
 * Initialize navigation links
 */
function initNavigationLinks() {
    const params = getURLParams();
    const backLink = document.getElementById('backToSeats');
    const cancelLink = document.getElementById('cancelOrderLink');

    if (backLink) {
        const concertId = params.concertId || 'bruno-mars-dec30';
        backLink.href = `seats.html?concertId=${concertId}`;
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = backLink.href;
        });
    }

    if (cancelLink) {
        cancelLink.addEventListener('click', (e) => {
            e.preventDefault();
            const shouldCancel = confirm('Cancel this order and release your seats?');
            if (!shouldCancel) return;
            sessionStorage.removeItem('cartTimerStart');
            const concertId = params.concertId || 'bruno-mars-dec30';
            window.location.href = `seats.html?concertId=${concertId}`;
        });
    }
}

/**
 * Initialize form functionality
 */
function initForm() {
    // Card number formatting
    const cardNumberInput = document.getElementById('cardNumber');
    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s/g, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        e.target.value = formattedValue;
    });

    // Expiration date formatting (MM/YY)
    const expDateInput = document.getElementById('expDate');
    expDateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4);
        }
        e.target.value = value;
    });

    // CVV - numbers only
    const cvvInput = document.getElementById('cvv');
    cvvInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 6) {
            value = '(' + value.slice(0, 3) + ') ' + value.slice(3, 6) + '-' + value.slice(6, 10);
        } else if (value.length >= 3) {
            value = '(' + value.slice(0, 3) + ') ' + value.slice(3);
        }
        e.target.value = value;
    });
}

/**
 * Initialize Place Order button
 */
function initPlaceOrderButton() {
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const agreeTermsCheckbox = document.getElementById('agreeTerms');

    // Enable/disable button based on checkbox
    agreeTermsCheckbox.addEventListener('change', () => {
        placeOrderBtn.disabled = !agreeTermsCheckbox.checked;
    });

    // Initially disabled
    placeOrderBtn.disabled = true;

    // Handle button click
    placeOrderBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePlaceOrder();
    });
}

/**
 * Initialize checkout state syncing
 */
function initCheckoutStateSync() {
    const form = document.getElementById('paymentForm');
    const insuranceInputs = document.querySelectorAll('input[name="insurance"]');
    const agreeTermsCheckbox = document.getElementById('agreeTerms');
    const syncDebounced = debounce(() => {
        syncCheckoutState();
    }, CHECKOUT_SYNC_DELAY);

    if (form) {
        form.addEventListener('input', syncDebounced);
        form.addEventListener('change', syncDebounced);
    }

    insuranceInputs.forEach(input => {
        input.addEventListener('change', syncDebounced);
    });

    if (agreeTermsCheckbox) {
        agreeTermsCheckbox.addEventListener('change', syncDebounced);
    }

    syncCheckoutState('Initialized checkout state');
}

/**
 * Handle Place Order button click
 */
function handlePlaceOrder() {
    // Validate form
    const form = document.getElementById('paymentForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Show loading modal
    showLoadingModal();

    // Simulate availability check (3 seconds)
    setTimeout(async () => {
        hideLoadingModal();
        await showConfirmation();
    }, 3000);
}

/**
 * Show loading modal
 */
function showLoadingModal() {
    document.getElementById('loadingModal').classList.remove('hidden');
}

/**
 * Hide loading modal
 */
function hideLoadingModal() {
    document.getElementById('loadingModal').classList.add('hidden');
}

/**
 * Show confirmation after successful order
 */
async function showConfirmation() {
    // Stop timer
    clearInterval(timerInterval);

    // Clear cart timer from sessionStorage
    sessionStorage.removeItem('cartTimerStart');

    // Get form data
    const form = document.getElementById('paymentForm');
    const paymentSnapshot = getPaymentSnapshot(form);
    const orderSummary = getOrderSummarySnapshot();

    const orderNumber = `TM-2025-${Math.floor(100000 + Math.random() * 900000)}`;
    const formData = paymentSnapshot.formData;

    await syncCheckoutState('Placed order', { paymentSnapshot, orderSummary });
    await markSeatsUnavailableInState(orderSummary);

    // Prepare confirmation page params
    const confirmParams = new URLSearchParams({
        orderNumber: orderNumber,
        concertId: orderSummary.concertId || '',
        eventName: orderSummary.eventName,
        eventDateTime: orderSummary.eventDateTime,
        venueName: orderSummary.venueName,
        quantity: orderSummary.quantity.toString(),
        seatDetails: JSON.stringify(orderSummary.seatDetails),
        price: orderSummary.pricePerTicket.toFixed(2),
        cardholderName: paymentSnapshot.cardholderName,
        cardLast4: paymentSnapshot.cardLast4,
        cardType: paymentSnapshot.cardType,
        insurance: paymentSnapshot.insurance ? 'yes' : 'no',
        formData: JSON.stringify(formData)
    });

    // Redirect to confirmation page
    window.location.href = `confirmation.html?${confirmParams.toString()}`;
}

/**
 * Persist checkout snapshot into backend state
 */
async function syncCheckoutState(note = 'Updated checkout state', overrides = {}) {
    if (!window.eventixApi) {
        return;
    }

    const form = document.getElementById('paymentForm');
    const paymentSnapshot = overrides.paymentSnapshot || (form ? getPaymentSnapshot(form) : null);
    const orderSummary = overrides.orderSummary || getOrderSummarySnapshot();
    const agreeTermsCheckbox = document.getElementById('agreeTerms');
    const termsAgreed = agreeTermsCheckbox ? agreeTermsCheckbox.checked : false;

    if (!paymentSnapshot) {
        return;
    }

    const updatedAtUTC = new Date().toISOString();

    try {
        await window.eventixApi.saveCheckout({
            payment: {
                cardholderName: paymentSnapshot.cardholderName,
                cardLast4: paymentSnapshot.cardLast4,
                cardType: paymentSnapshot.cardType,
                insurance: paymentSnapshot.insurance,
                formData: paymentSnapshot.formData,
                updatedAtUTC: updatedAtUTC
            },
            checkout: {
                termsAgreed: termsAgreed,
                orderSummary: orderSummary,
                updatedAtUTC: updatedAtUTC
            }
        });
    } catch (error) {
        console.warn('Failed to save checkout state:', error);
    }
}

/**
 * Mark purchased seats as unavailable in backend state
 */
async function markSeatsUnavailableInState(orderSummary) {
    if (!window.eventixApi || !orderSummary?.concertId) {
        return;
    }

    const seatIds = Array.isArray(orderSummary.seatDetails)
        ? orderSummary.seatDetails.map(seat => seat.id).filter(Boolean)
        : [];

    if (seatIds.length === 0) {
        return;
    }

    try {
        await window.eventixApi.holdSeats(orderSummary.concertId, seatIds);
    } catch (error) {
        console.warn('Failed to mark seats unavailable:', error);
    }
}

function getOrderSummarySnapshot() {
    const params = getURLParams();
    const seatDetails = getSeatDetailsFromParams(params);
    const quantityParam = parseInt(params.quantity, 10);
    const quantity = Number.isFinite(quantityParam) ? quantityParam : (seatDetails.length || 1);
    const rawPrice = parseFloat(params.price);
    const fallbackPrice = Number.isFinite(rawPrice) ? rawPrice : 1545.00;

    const ticketSubtotal = seatDetails.length > 0
        ? seatDetails.reduce((sum, seat) => sum + (Number(seat.price) || 0), 0)
        : fallbackPrice * quantity;
    const pricePerTicket = quantity > 0 ? ticketSubtotal / quantity : fallbackPrice;
    const serviceFee = Math.round(ticketSubtotal * 0.1368 * 100) / 100;
    const taxes = Math.round(ticketSubtotal * 0.09 * 100) / 100;

    return {
        concertId: params.concertId || null,
        eventName: params.eventName || 'Bruno Mars Las Vegas',
        eventDate: params.eventDate || 'Dec-30-25',
        eventDateTime: params.eventDateTime || 'Tue Dec 30, 2025 9:00 PM',
        venueName: params.venueName || 'Dolby Live, Las Vegas, NV',
        quantity: quantity,
        seatDetails: seatDetails,
        pricePerTicket: pricePerTicket,
        ticketSubtotal: ticketSubtotal,
        serviceFee: serviceFee,
        taxes: taxes,
        total: ticketSubtotal + serviceFee + taxes,
        currency: 'USD'
    };
}

function getSeatDetailsFromParams(params) {
    if (!params?.seatDetails) {
        return [];
    }

    try {
        const parsed = JSON.parse(params.seatDetails);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse seat details:', error);
        return [];
    }
}

/**
 * Build payment snapshot from form inputs
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function getPaymentSnapshot(form) {
    const cardNumber = form.cardNumber.value.replace(/\s/g, '');
    const cardLast4 = cardNumber.slice(-4);
    const cardType = getCardType(cardNumber);
    const insuranceYes = document.querySelector('input[name="insurance"][value="yes"]');
    const insurance = insuranceYes ? insuranceYes.checked : false;

    return {
        cardholderName: form.cardName.value,
        cardNumber: cardNumber,
        cardLast4: cardLast4,
        cardType: cardType,
        insurance: insurance,
        formData: {
            cardName: form.cardName.value,
            cardNumber: cardNumber,
            expDate: form.expDate.value,
            cvv: form.cvv.value,
            country: form.country.value,
            address1: form.address1.value,
            address2: form.address2.value,
            city: form.city.value,
            state: form.state.value,
            postalCode: form.postalCode.value,
            phone: form.phone.value
        }
    };
}

/**
 * Determine card type from number
 * @param {string} cardNumber
 * @returns {string}
 */
function getCardType(cardNumber) {
    if (cardNumber.startsWith('4')) {
        return 'VISA';
    }
    if (cardNumber.startsWith('5')) {
        return 'Mastercard';
    }
    if (cardNumber.startsWith('3')) {
        return 'AmEx';
    }
    if (cardNumber.startsWith('6')) {
        return 'Discover';
    }
    return 'CARD';
}

/**
 * Load order details from URL parameters or session storage
 */
function loadOrderDetails() {
    const summary = getOrderSummarySnapshot();
    const ticketPrice = summary.pricePerTicket;
    const quantity = summary.quantity;
    const ticketTotal = summary.ticketSubtotal;
    const serviceFee = summary.serviceFee;
    const taxAmount = summary.taxes;
    const grandTotal = summary.total;

    // Update ticket description
    document.getElementById('ticketDescription').textContent =
        `Preferred Premium Seat: $${formatPrice(ticketPrice)} x ${quantity}`;
    document.getElementById('ticketTotal').textContent = `$${formatPrice(ticketTotal)}`;

    // Update fees and taxes
    document.getElementById('serviceFee').textContent = `$${formatPrice(serviceFee)}`;
    document.getElementById('taxAmount').textContent = `$${formatPrice(taxAmount)}`;

    // Update grand total (multiple places)
    document.getElementById('grandTotal').textContent = `$${formatPrice(grandTotal)}`;
    document.getElementById('totalAmountWarning').textContent = formatPrice(grandTotal);

    // Update event info
    document.getElementById('eventNameInsurance').textContent = summary.eventName;
    document.getElementById('eventDateInsurance').textContent = summary.eventDate;
    document.getElementById('eventNameSummary').textContent = summary.eventName.toUpperCase();
    document.getElementById('eventDateTimeSummary').textContent = summary.eventDateTime;
}

/**
 * Format price with commas
 */
function formatPrice(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
