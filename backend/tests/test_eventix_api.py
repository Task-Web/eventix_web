import pytest


@pytest.mark.asyncio
async def test_control_plane_is_hidden_from_public_openapi(async_client):
    schema = (await async_client.get("/api/openapi.json")).json()
    assert "/api/state" not in schema["paths"]
    assert all(tag.get("name") != "state" for tag in schema.get("tags", []))


COOKIE = "eventix-product-api"
CONCERT_ID = "bruno-mars-dec30"
SEAT = {
    "id": "FLOOR_101_A1",
    "section": "FLOOR 101",
    "row": "A",
    "seatNumber": 1,
    "price": 750,
}


def cart_payload():
    return {
        "concertId": CONCERT_ID,
        "eventName": "Bruno Mars Las Vegas",
        "venueName": "Dolby Live, Las Vegas, NV",
        "eventDateTime": "Tue Dec 30, 2025 9:00 PM",
        "quantity": 1,
        "selectedSeats": [SEAT],
        "totalPrice": 750,
        "updatedAtUTC": "2026-07-24T00:00:00Z",
    }


def payment_form():
    return {
        "cardName": "Ada Lovelace",
        "cardNumber": "4111111111111234",
        "expDate": "12/30",
        "cvv": "123",
        "country": "US",
        "address1": "1 Main St",
        "address2": "",
        "city": "Las Vegas",
        "state": "NV",
        "postalCode": "89109",
        "phone": "555-0100",
    }


def checkout_payload(terms=True):
    subtotal = 750
    fee = 102.6
    taxes = 67.5
    return {
        "payment": {
            "cardholderName": "Ada Lovelace",
            "cardLast4": "1234",
            "cardType": "VISA",
            "insurance": False,
            "formData": payment_form(),
            "updatedAtUTC": "2026-07-24T00:00:01Z",
        },
        "checkout": {
            "termsAgreed": terms,
            "orderSummary": {
                "concertId": CONCERT_ID,
                "eventName": "Bruno Mars Las Vegas",
                "eventDate": "Dec-30-25",
                "eventDateTime": "Tue Dec 30, 2025 9:00 PM",
                "venueName": "Dolby Live, Las Vegas, NV",
                "quantity": 1,
                "seatDetails": [SEAT],
                "pricePerTicket": subtotal,
                "ticketSubtotal": subtotal,
                "serviceFee": fee,
                "taxes": taxes,
                "total": subtotal + fee + taxes,
                "currency": "USD",
            },
            "updatedAtUTC": "2026-07-24T00:00:01Z",
        },
    }


@pytest.mark.asyncio
async def test_eventix_checkout_flow_preserves_control_plane_shape(async_client):
    await async_client.delete("/api/state", params={"cookie": COOKIE})
    await async_client.patch(
        "/api/state",
        params={"cookie": COOKIE},
        json={
            "data": {
                "evaluator_marker": {"keep": True},
                "unrelated_top_level": {"hidden": True},
                "developer_tools_open": False,
            }
        },
    )
    catalog = await async_client.get("/api/eventix/catalog", params={"cookie": COOKIE})
    assert catalog.status_code == 200
    assert set(catalog.json()) == {"user_id", "catalog"}
    assert "evaluator_marker" not in catalog.json()["catalog"]
    assert "unrelated_top_level" not in catalog.json()["catalog"]

    availability = await async_client.get(
        f"/api/eventix/concerts/{CONCERT_ID}/availability",
        params={"cookie": COOKIE},
    )
    assert availability.status_code == 200
    assert set(availability.json()) == {
        "user_id",
        "concert_id",
        "available_seat_ids",
        "unavailable_seat_ids",
    }
    assert SEAT["id"] in availability.json()["available_seat_ids"]

    cart = await async_client.put(
        "/api/eventix/cart", params={"cookie": COOKIE}, json=cart_payload()
    )
    assert cart.status_code == 200

    checkout = await async_client.put(
        "/api/eventix/cart/checkout",
        params={"cookie": COOKIE},
        json=checkout_payload(),
    )
    assert checkout.status_code == 200

    hold = await async_client.post(
        f"/api/eventix/concerts/{CONCERT_ID}/holds",
        params={"cookie": COOKIE},
        json={"seat_ids": [SEAT["id"]]},
    )
    assert hold.status_code == 200

    order_payload = {
        "orderNumber": "TM-2025-123456",
        "concertId": CONCERT_ID,
        "eventName": "Bruno Mars Las Vegas",
        "eventDateTime": "Tue Dec 30, 2025 9:00 PM",
        "venueName": "Dolby Live, Las Vegas, NV",
        "quantity": 1,
        "seatDetails": [SEAT],
        "ticketSubtotal": 750,
        "serviceFee": 102.6,
        "taxes": 67.5,
        "totalPaid": 920.1,
        "cardholderName": "Ada Lovelace",
        "cardLast4": "1234",
        "cardType": "VISA",
        "insurance": False,
        "formData": payment_form(),
        "createdAtUTC": "2026-07-24T00:00:02Z",
    }
    order = await async_client.post(
        "/api/eventix/orders", params={"cookie": COOKIE}, json=order_payload
    )
    assert order.status_code == 200

    final = await async_client.get("/api/state", params={"cookie": COOKIE})
    data = final.json()["state"]["data"]
    assert data["orders"][-1]["totalPaid"] == pytest.approx(920.1)
    assert data["orders"][-1]["seatDetails"] == [SEAT]
    assert data["cart"]["selectedSeats"] == []
    assert SEAT["id"] in data["inventory"]["unavailableSeatsByConcert"][CONCERT_ID]
    assert "catalog" in data
    assert data["evaluator_marker"] == {"keep": True}
    assert data["unrelated_top_level"] == {"hidden": True}
    assert data["developer_tools_open"] is False


@pytest.mark.asyncio
async def test_eventix_rejects_nested_internal_fields_and_forged_seats(async_client):
    cookie = "eventix-strict"
    await async_client.delete("/api/state", params={"cookie": cookie})

    for field in (
        "arbitrary_state",
        "developer_tools_open",
        "evaluator_marker",
        "data",
        "state",
    ):
        response = await async_client.put(
            "/api/eventix/cart",
            params={"cookie": cookie},
            json={**cart_payload(), field: True},
        )
        assert response.status_code == 422

    forged = cart_payload()
    forged["selectedSeats"] = [{**SEAT, "price": 1}]
    forged["totalPrice"] = 1
    response = await async_client.put(
        "/api/eventix/cart", params={"cookie": cookie}, json=forged
    )
    assert response.status_code == 422

    assert (
        await async_client.put(
            "/api/eventix/cart", params={"cookie": cookie}, json=cart_payload()
        )
    ).status_code == 200
    nested = checkout_payload()
    nested["payment"]["formData"]["developer_tools_open"] = True
    response = await async_client.put(
        "/api/eventix/cart/checkout", params={"cookie": cookie}, json=nested
    )
    assert response.status_code == 422

    response = await async_client.post(
        f"/api/eventix/concerts/{CONCERT_ID}/holds",
        params={"cookie": cookie},
        json={"seat_ids": ["missing-seat"]},
    )
    assert response.status_code in {404, 409}
