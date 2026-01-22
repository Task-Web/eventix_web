// Confirmation Page Controller - Eventix Clone

// Order data
let orderData = {
    orderNumber: '',
    concertId: '',
    eventName: '',
    eventDateTime: '',
    venueName: '',
    quantity: 0,
    seatDetails: [],
    cardholderName: '',
    cardLast4: '',
    cardType: '',
    ticketSubtotal: 0,
    serviceFee: 0,
    taxes: 0,
    totalPaid: 0,
    insurance: false
};

// Initialize confirmation page
document.addEventListener('DOMContentLoaded', () => {
    loadOrderData();
    displayOrderDetails();
    initButtons();
    populatePrintTemplate();
    updateNavigationLinks();
    recordOrderInState();
});

/**
 * Load order data from URL parameters or localStorage
 */
function loadOrderData() {
    const params = getURLParams();

    // Generate order number
    orderData.orderNumber = params.orderNumber || `TM-2025-${Math.floor(100000 + Math.random() * 900000)}`;
    orderData.concertId = params.concertId || '';

    // Load event details
    orderData.eventName = params.eventName || 'Bruno Mars Las Vegas';
    orderData.eventDateTime = params.eventDateTime || 'Tue Dec 30, 2025 9:00 PM';
    orderData.venueName = params.venueName || 'Dolby Live, Las Vegas, NV';

    // Load ticket details
    orderData.quantity = parseInt(params.quantity) || 2;

    // Parse seat details
    try {
        orderData.seatDetails = JSON.parse(params.seatDetails || '[]');
        if (orderData.seatDetails.length === 0) {
            // Fallback to default
            orderData.seatDetails = [{section: 'FLOOR 102', row: 'A', seatNumber: '12', price: 1545.00}];
        }
    } catch (e) {
        console.error('Error parsing seat details:', e);
        orderData.seatDetails = [{section: 'FLOOR 102', row: 'A', seatNumber: '12', price: 1545.00}];
    }

    // Load payment details
    orderData.cardholderName = params.cardholderName || 'John Doe';
    orderData.cardLast4 = params.cardLast4 || '1234';
    orderData.cardType = params.cardType || 'VISA';

    // Calculate prices from individual seat prices
    orderData.ticketSubtotal = orderData.seatDetails.reduce((sum, seat) => sum + (seat.price || 0), 0);
    orderData.serviceFee = Math.round(orderData.ticketSubtotal * 0.1368 * 100) / 100;
    orderData.taxes = Math.round(orderData.ticketSubtotal * 0.09 * 100) / 100;
    orderData.totalPaid = orderData.ticketSubtotal + orderData.serviceFee + orderData.taxes;

    // Insurance
    orderData.insurance = params.insurance === 'yes';

    // Raw form data (optional)
    orderData.formData = null;
    if (params.formData) {
        try {
            orderData.formData = JSON.parse(params.formData);
        } catch (e) {
            console.error('Error parsing form data:', e);
        }
    }
}

/**
 * Display order details on page
 */
function displayOrderDetails() {
    // Order number
    document.getElementById('orderNumber').textContent = orderData.orderNumber;

    // Event details
    document.getElementById('eventName').textContent = orderData.eventName;
    document.getElementById('eventDateTime').textContent = orderData.eventDateTime;
    document.getElementById('venueName').textContent = orderData.venueName;

    // Ticket details
    document.getElementById('ticketQuantity').textContent = `${orderData.quantity} Ticket${orderData.quantity > 1 ? 's' : ''}`;

    // Display seat list
    const seatsList = document.getElementById('seatsList');
    seatsList.innerHTML = '';
    orderData.seatDetails.forEach(seat => {
        const seatItem = document.createElement('div');
        seatItem.className = 'seat-item';

        const seatInfo = document.createElement('span');
        seatInfo.className = 'seat-item-info';
        seatInfo.textContent = `Section ${seat.section}, Row ${seat.row}, Seat ${seat.seatNumber}`;

        const seatPrice = document.createElement('span');
        seatPrice.className = 'seat-item-price';
        seatPrice.textContent = `$${formatPrice(seat.price || 0)}`;

        seatItem.appendChild(seatInfo);
        seatItem.appendChild(seatPrice);
        seatsList.appendChild(seatItem);
    });

    // Payment details
    document.getElementById('cardholderName').textContent = orderData.cardholderName;
    document.getElementById('cardInfo').textContent = `${orderData.cardType} 鈥⑩€⑩€⑩€?${orderData.cardLast4}`;
    document.getElementById('ticketSubtotal').textContent = `$${formatPrice(orderData.ticketSubtotal)}`;
    document.getElementById('serviceFee').textContent = `$${formatPrice(orderData.serviceFee)}`;
    document.getElementById('taxes').textContent = `$${formatPrice(orderData.taxes)}`;
    document.getElementById('totalPaid').textContent = `$${formatPrice(orderData.totalPaid)}`;

    // Insurance
    if (orderData.insurance) {
        document.getElementById('insuranceInfo').classList.remove('hidden');
    }
}

/**
 * Populate print template with order data
 */
function populatePrintTemplate() {
    document.getElementById('printOrderNumber').textContent = orderData.orderNumber;
    document.getElementById('printEventName').textContent = orderData.eventName;
    document.getElementById('printEventDateTime').textContent = orderData.eventDateTime;
    document.getElementById('printVenueName').textContent = orderData.venueName;
    document.getElementById('printTicketQuantity').textContent = `${orderData.quantity} Ticket${orderData.quantity > 1 ? 's' : ''}`;

    // Display seat list in print template
    const printSeatsList = document.getElementById('printSeatsList');
    printSeatsList.innerHTML = '';
    orderData.seatDetails.forEach(seat => {
        const seatPara = document.createElement('p');
        seatPara.innerHTML = `<strong>Section ${seat.section}, Row ${seat.row}, Seat ${seat.seatNumber}</strong> - $${formatPrice(seat.price || 0)}`;
        printSeatsList.appendChild(seatPara);
    });

    document.getElementById('printCardholderName').textContent = orderData.cardholderName;
    document.getElementById('printCardInfo').textContent = `${orderData.cardType} 鈥⑩€⑩€⑩€?${orderData.cardLast4}`;
    document.getElementById('printTicketSubtotal').textContent = `$${formatPrice(orderData.ticketSubtotal)}`;
    document.getElementById('printServiceFee').textContent = `$${formatPrice(orderData.serviceFee)}`;
    document.getElementById('printTaxes').textContent = `$${formatPrice(orderData.taxes)}`;
    document.getElementById('printTotalPaid').textContent = `$${formatPrice(orderData.totalPaid)}`;

    const metadata = buildMetadataPayload();
    const metadataEl = document.getElementById('pdfMetadata');
    if (metadataEl) {
        metadataEl.textContent = `TM_META_START${metadata}TM_META_END`;
    }
}

/**
 * Initialize button handlers
 */
function initButtons() {
    // Download PDF button
    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
        downloadPDF();
    });

    // Email confirmation button
    document.getElementById('emailConfirmationBtn').addEventListener('click', () => {
        emailConfirmation();
    });
}

/**
 * Download PDF (using print dialog)
 */
function downloadPDF() {
    // Set document title for PDF filename
    document.title = `Eventix_Confirmation_${orderData.orderNumber}`;

    // Trigger print dialog
    window.print();

    // Reset title
    setTimeout(() => {
        document.title = 'Order Confirmation - Eventix';
    }, 1000);
}

/**
 * Email confirmation
 */
function emailConfirmation() {
    alert(`Confirmation email has been sent to your registered email address.\n\nOrder Number: ${orderData.orderNumber}\n\nPlease check your inbox and spam folder.`);
}

/**
 * Build base64-encoded metadata payload for PDF extraction
 * @returns {string} base64 metadata
 */
function buildMetadataPayload() {
    const payload = {
        orderNumber: orderData.orderNumber,
        concertId: orderData.concertId,
        eventName: orderData.eventName,
        eventDateTime: orderData.eventDateTime,
        venueName: orderData.venueName,
        quantity: orderData.quantity,
        seatDetails: orderData.seatDetails,
        ticketSubtotal: orderData.ticketSubtotal,
        serviceFee: orderData.serviceFee,
        taxes: orderData.taxes,
        totalPaid: orderData.totalPaid,
        cardholderName: orderData.cardholderName,
        cardLast4: orderData.cardLast4,
        cardType: orderData.cardType,
        insurance: orderData.insurance,
        formData: orderData.formData,
        generatedAtUTC: new Date().toISOString()
    };

    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Update navigation links based on order data
 */
function updateNavigationLinks() {
    const viewMoreLink = document.getElementById('viewMoreEventsLink');
    if (viewMoreLink) {
        const artistParam = encodeURIComponent(orderData.eventName.split(' ')[0] || '');
        viewMoreLink.href = `artist.html?artist=${artistParam}`;
    }
}

/**
 * Append order record to backend state
 */
async function recordOrderInState() {
    if (!window.eventixApi) {
        return;
    }

    const orderRecord = {
        orderNumber: orderData.orderNumber,
        concertId: orderData.concertId,
        eventName: orderData.eventName,
        eventDateTime: orderData.eventDateTime,
        venueName: orderData.venueName,
        quantity: orderData.quantity,
        seatDetails: orderData.seatDetails,
        ticketSubtotal: orderData.ticketSubtotal,
        serviceFee: orderData.serviceFee,
        taxes: orderData.taxes,
        totalPaid: orderData.totalPaid,
        cardholderName: orderData.cardholderName,
        cardLast4: orderData.cardLast4,
        cardType: orderData.cardType,
        insurance: orderData.insurance,
        formData: orderData.formData,
        createdAtUTC: new Date().toISOString()
    };

    try {
        const current = await window.eventixApi.getState();
        const existingOrders = Array.isArray(current?.state?.data?.orders)
            ? current.state.data.orders
            : [];
        const nextOrders = [...existingOrders, orderRecord];

        const patchPayload = {
            orders: nextOrders,
            cart: { items: [], selectedSeats: [], payment: null }
        };

        const seatIds = Array.isArray(orderData.seatDetails)
            ? orderData.seatDetails.map(seat => seat.id).filter(Boolean)
            : [];

        if (orderData.concertId && seatIds.length > 0) {
            const existingUnavailable = current?.state?.data?.inventory?.unavailableSeatsByConcert?.[orderData.concertId];
            const mergedUnavailable = Array.isArray(existingUnavailable)
                ? Array.from(new Set([...existingUnavailable, ...seatIds]))
                : Array.from(new Set(seatIds));

            patchPayload.inventory = {
                unavailableSeatsByConcert: {
                    [orderData.concertId]: mergedUnavailable
                },
                updatedAtUTC: new Date().toISOString()
            };
        }

        await window.eventixApi.patchState(patchPayload, 'Recorded order confirmation');
    } catch (error) {
        console.warn('Failed to record order:', error);
    }
}

/**
 * Format price with commas
 */
function formatPrice(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
