import json
import math
import mimetypes
import os
import platform
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from mcp.server.fastmcp import FastMCP

from .config import Settings, get_settings
from .file_store import FileStore
from .schemas import (
    EventixCartRequest,
    EventixCheckoutRequest,
    EventixOrderRequest,
    EventixSeatHoldRequest,
    FileMetadata,
    InfoResponse,
    StatePatchRequest,
    StateRequest,
    StateResponse,
)
from .state_store import StateStore


def _load_seed_catalog(data_dir: str) -> Dict[str, Any]:
    base_dir = Path(data_dir).resolve()

    def read_json(name: str) -> Optional[Dict[str, Any]]:
        path = base_dir / name
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    concerts = read_json("concerts.json")
    venues = read_json("venues.json")
    cities = read_json("cities.json")

    seat_maps: Dict[str, Any] = {}
    if isinstance(venues, dict):
        for venue in venues.get("venues", []):
            seat_file = venue.get("seatMapFile")
            if not seat_file or seat_file in seat_maps:
                continue
            seat_data = read_json(seat_file)
            if seat_data is not None:
                seat_maps[seat_file] = seat_data

    return {
        "concerts": concerts or {},
        "venues": venues or {},
        "cities": cities or {},
        "seatMaps": seat_maps,
    }


def _build_initial_state(settings: Settings) -> Dict[str, Any]:
    return {
        "catalog": _load_seed_catalog(settings.data_dir),
        "cart": {"items": [], "selectedSeats": []},
        "orders": [],
        "preferences": {"currency": "USD"},
        "uploads": [],
        "inventory": {"availableSeatsByConcert": {}},
    }


settings = get_settings()
store = StateStore(initial_state_factory=lambda: _build_initial_state(settings))
file_store = FileStore("files", settings.api_prefix)

tags_metadata = [
    {"name": "files", "description": "Upload and fetch files scoped to a user cookie"},
    {"name": "system", "description": "Environment and health information"},
]


def _resolve_user_cookie(provided: Optional[str]) -> str:
    return provided if provided else str(uuid.uuid4())


def _set_user_cookie(response: Response, user_id: str, settings: Settings) -> None:
    response.set_cookie(
        settings.cookie_name,
        user_id,
        max_age=settings.cookie_max_age,
        httponly=False,
        samesite="lax",
    )


mcp_server = FastMCP(
    name=f"{settings.app_name} MCP",
    instructions=(
        "Streamable HTTP MCP interface mirroring the REST API. "
        "Supply user_cookie to reuse the same per-user state; "
        "omit to generate a new cookie-backed state."
    ),
    host="0.0.0.0",
    streamable_http_path="/",
)

mcp_http_app = mcp_server.streamable_http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
    mcp_ctx = mcp_server.session_manager.run()
    await mcp_ctx.__aenter__()
    try:
        yield
    finally:
        await mcp_ctx.__aexit__(None, None, None)


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_tags=tags_metadata,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_user_id(
    request: Request, response: Response, settings: Settings = Depends(get_settings)
) -> str:
    cookie_override = request.query_params.get("cookie")
    user_id = cookie_override or request.cookies.get(settings.cookie_name)
    if not user_id:
        user_id = str(uuid.uuid4())
    _set_user_cookie(response, user_id, settings)
    return user_id


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    response: JSONResponse = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.get("/health", tags=["system"])
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get(
    f"{settings.api_prefix}/state",
    response_model=StateResponse,
    tags=["state"],
    include_in_schema=False,
)
async def get_state(user_id: str = Depends(get_user_id)) -> StateResponse:
    state = await store.get_state(user_id)
    return StateResponse(user_id=user_id, state=state)


@app.put(
    f"{settings.api_prefix}/state",
    response_model=StateResponse,
    tags=["state"],
    summary="Replace state",
    include_in_schema=False,
)
async def put_state(payload: StateRequest, user_id: str = Depends(get_user_id)) -> StateResponse:
    next_state = {"data": payload.data, "note": payload.note}
    if payload.meta is not None:
        next_state["meta"] = payload.meta
    state = await store.replace_state(user_id, next_state)
    return StateResponse(user_id=user_id, state=state)


@app.patch(
    f"{settings.api_prefix}/state",
    response_model=StateResponse,
    tags=["state"],
    summary="Merge into existing state",
    include_in_schema=False,
)
async def patch_state(
    payload: StatePatchRequest, user_id: str = Depends(get_user_id)
) -> StateResponse:
    state = await store.patch_state(user_id, patch=payload.data, note=payload.note)
    return StateResponse(user_id=user_id, state=state)


@app.delete(
    f"{settings.api_prefix}/state",
    response_model=StateResponse,
    tags=["state"],
    summary="Reset and clear state",
    include_in_schema=False,
)
async def delete_state(user_id: str = Depends(get_user_id)) -> StateResponse:
    file_store.delete_user_files(user_id)
    state = await store.reset_state(user_id)
    return StateResponse(user_id=user_id, state=state)


def _eventix_concert(data: Dict[str, Any], concert_id: str) -> Dict[str, Any]:
    concerts = data.get("catalog", {}).get("concerts", {}).get("concerts", [])
    concert = next((item for item in concerts if item.get("id") == concert_id), None)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    return concert


def _eventix_seats(data: Dict[str, Any], concert_id: str) -> Dict[str, Dict[str, Any]]:
    catalog = data.get("catalog", {})
    concert = _eventix_concert(data, concert_id)
    venues = catalog.get("venues", {}).get("venues", [])
    venue = next((item for item in venues if item.get("id") == concert.get("venueId")), None)
    if venue is None:
        raise HTTPException(status_code=409, detail="Concert venue is unavailable")
    seat_map = catalog.get("seatMaps", {}).get(venue.get("seatMapFile"), {})
    seats: Dict[str, Dict[str, Any]] = {}
    for section in seat_map.get("sections", []):
        rows = int(section.get("rows", 0))
        seats_per_row = int(section.get("seatsPerRow", 0))
        price_range = section.get("priceRange", {})
        minimum = float(price_range.get("min", 0))
        maximum = float(price_range.get("max", minimum))
        for row_index in range(rows):
            row = chr(65 + row_index)
            multiplier = row_index / (rows - 1) if rows > 1 else 0
            price = round(minimum + (maximum - minimum) * multiplier)
            for seat_number in range(1, seats_per_row + 1):
                seat_id = f"{section['id']}_{row}{seat_number}"
                seats[seat_id] = {
                    "id": seat_id,
                    "section": section.get("displayName", section["id"]),
                    "row": row,
                    "seatNumber": seat_number,
                    "price": price,
                }
    return seats


def _eventix_available_seat_ids(data: Dict[str, Any], concert_id: str) -> set[str]:
    valid = set(_eventix_seats(data, concert_id))
    inventory = data.get("inventory", {})
    configured = inventory.get("availableSeatsByConcert", {})
    available = set(configured[concert_id]) & valid if concert_id in configured else valid
    unavailable = set(inventory.get("unavailableSeatsByConcert", {}).get(concert_id, []))
    return available - unavailable


def _eventix_canonical_seats(
    data: Dict[str, Any], concert_id: str, submitted: List[Any]
) -> List[Dict[str, Any]]:
    seat_index = _eventix_seats(data, concert_id)
    submitted_ids = [seat.id for seat in submitted]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise HTTPException(status_code=422, detail="Selected seats must be unique")
    missing = [seat_id for seat_id in submitted_ids if seat_id not in seat_index]
    if missing:
        raise HTTPException(status_code=404, detail=f"Seat not found: {missing[0]}")
    for seat in submitted:
        canonical = seat_index[seat.id]
        if seat.model_dump() != canonical:
            raise HTTPException(status_code=422, detail=f"Seat details do not match catalog: {seat.id}")
    return [seat_index[seat_id] for seat_id in submitted_ids]


def _eventix_assert_amount(actual: float, expected: float, label: str) -> None:
    if not math.isclose(actual, expected, abs_tol=0.01):
        raise HTTPException(status_code=422, detail=f"{label} does not match server total")


@app.get(f"{settings.api_prefix}/eventix/catalog", tags=["eventix"])
async def eventix_catalog(user_id: str = Depends(get_user_id)) -> Dict[str, Any]:
    state = await store.get_state(user_id)
    return {"user_id": user_id, "catalog": state.data.get("catalog", {})}


@app.get(f"{settings.api_prefix}/eventix/concerts/{{concert_id}}/availability", tags=["eventix"])
async def eventix_availability(
    concert_id: str, user_id: str = Depends(get_user_id)
) -> Dict[str, Any]:
    state = await store.get_state(user_id)
    inventory = state.data.get("inventory", {})
    available = _eventix_available_seat_ids(state.data, concert_id)
    return {
        "user_id": user_id,
        "concert_id": concert_id,
        "available_seat_ids": sorted(available),
        "unavailable_seat_ids": inventory.get("unavailableSeatsByConcert", {}).get(concert_id, []),
    }


@app.put(f"{settings.api_prefix}/eventix/cart", tags=["eventix"])
async def eventix_save_cart(
    payload: EventixCartRequest, user_id: str = Depends(get_user_id)
) -> Dict[str, Any]:
    if payload.quantity != len(payload.selectedSeats):
        raise HTTPException(status_code=422, detail="Cart quantity does not match selected seats")
    current = await store.get_state(user_id)
    concert = _eventix_concert(current.data, payload.concertId)
    seats = _eventix_canonical_seats(current.data, payload.concertId, payload.selectedSeats)
    available = _eventix_available_seat_ids(current.data, payload.concertId)
    if any(seat["id"] not in available for seat in seats):
        raise HTTPException(status_code=409, detail="One or more selected seats are unavailable")
    total = sum(float(seat["price"]) for seat in seats)
    _eventix_assert_amount(payload.totalPrice, total, "Cart total")
    venue_name = f"{concert['venueName']}, {concert['city']}, {concert['state']}"
    if payload.eventName != concert["eventName"] or payload.venueName != venue_name:
        raise HTTPException(status_code=422, detail="Cart event details do not match catalog")
    cart = {
        **payload.model_dump(),
        "selectedSeats": seats,
        "totalPrice": total,
    }
    await store.patch_state(user_id, {"cart": cart}, "Saved cart for checkout")
    return {"user_id": user_id, "cart": cart}


@app.put(f"{settings.api_prefix}/eventix/cart/checkout", tags=["eventix"])
async def eventix_save_checkout(
    payload: EventixCheckoutRequest, user_id: str = Depends(get_user_id)
) -> Dict[str, Any]:
    current = await store.get_state(user_id)
    cart = current.data.get("cart", {})
    if not cart.get("selectedSeats"):
        raise HTTPException(status_code=409, detail="Cannot check out an empty cart")
    summary = payload.checkout.orderSummary
    if summary.concertId != cart.get("concertId") or summary.quantity != cart.get("quantity"):
        raise HTTPException(status_code=422, detail="Checkout does not match the current cart")
    if [seat.model_dump() for seat in summary.seatDetails] != cart.get("selectedSeats"):
        raise HTTPException(status_code=422, detail="Checkout seats do not match the current cart")
    subtotal = sum(float(seat["price"]) for seat in cart["selectedSeats"])
    service_fee = round(subtotal * 0.1368, 2)
    taxes = round(subtotal * 0.09, 2)
    total = subtotal + service_fee + taxes
    _eventix_assert_amount(summary.ticketSubtotal, subtotal, "Ticket subtotal")
    _eventix_assert_amount(summary.serviceFee, service_fee, "Service fee")
    _eventix_assert_amount(summary.taxes, taxes, "Taxes")
    _eventix_assert_amount(summary.total, total, "Order total")
    _eventix_assert_amount(summary.pricePerTicket, subtotal / summary.quantity, "Ticket price")
    payment = payload.payment
    if payment.cardLast4 != payment.formData.cardNumber[-4:]:
        raise HTTPException(status_code=422, detail="Card details do not match")
    if payment.cardholderName != payment.formData.cardName:
        raise HTTPException(status_code=422, detail="Cardholder details do not match")
    checkout = payload.checkout.model_dump()
    checkout["orderSummary"].update(
        {
            "seatDetails": cart["selectedSeats"],
            "ticketSubtotal": subtotal,
            "serviceFee": service_fee,
            "taxes": taxes,
            "total": total,
            "pricePerTicket": subtotal / summary.quantity,
        }
    )
    patch = {"cart": {"payment": payment.model_dump(), "checkout": checkout}}
    state = await store.patch_state(user_id, patch, "Updated checkout state")
    return {"user_id": user_id, "cart": state.data.get("cart", {})}


@app.post(f"{settings.api_prefix}/eventix/concerts/{{concert_id}}/holds", tags=["eventix"])
async def eventix_hold_seats(
    concert_id: str,
    payload: EventixSeatHoldRequest,
    user_id: str = Depends(get_user_id),
) -> Dict[str, Any]:
    held: List[str] = []

    def mutate(data: Dict[str, Any]) -> Dict[str, Any]:
        nonlocal held
        available = _eventix_available_seat_ids(data, concert_id)
        unavailable_requested = [seat_id for seat_id in payload.seat_ids if seat_id not in available]
        if unavailable_requested:
            raise HTTPException(
                status_code=409,
                detail=f"Seat is unavailable: {unavailable_requested[0]}",
            )
        cart_ids = {seat.get("id") for seat in data.get("cart", {}).get("selectedSeats", [])}
        if set(payload.seat_ids) != cart_ids:
            raise HTTPException(status_code=409, detail="Held seats must match the current cart")
        inventory = data.setdefault("inventory", {})
        unavailable = inventory.setdefault("unavailableSeatsByConcert", {})
        held = list(dict.fromkeys([*unavailable.get(concert_id, []), *payload.seat_ids]))
        unavailable[concert_id] = held
        return data

    await store.mutate_data(user_id, mutate, "Held seats for checkout")
    return {"user_id": user_id, "concert_id": concert_id, "seat_ids": held}


@app.post(f"{settings.api_prefix}/eventix/orders", tags=["eventix"])
async def eventix_create_order(
    payload: EventixOrderRequest, user_id: str = Depends(get_user_id)
) -> Dict[str, Any]:
    order: Dict[str, Any] = {}

    def mutate(data: Dict[str, Any]) -> Dict[str, Any]:
        nonlocal order
        orders = data.setdefault("orders", [])
        if any(item.get("orderNumber") == payload.orderNumber for item in orders):
            raise HTTPException(status_code=409, detail="Order already recorded")
        cart = data.get("cart", {})
        checkout = cart.get("checkout", {})
        payment = cart.get("payment", {})
        if not checkout.get("termsAgreed"):
            raise HTTPException(status_code=409, detail="Checkout terms must be accepted")
        cart_seats = cart.get("selectedSeats", [])
        submitted_seats = _eventix_canonical_seats(data, payload.concertId, payload.seatDetails)
        if submitted_seats != cart_seats or payload.quantity != len(cart_seats):
            raise HTTPException(status_code=409, detail="Order does not match the checked-out cart")
        held = set(
            data.get("inventory", {})
            .get("unavailableSeatsByConcert", {})
            .get(payload.concertId, [])
        )
        if any(seat["id"] not in held for seat in cart_seats):
            raise HTTPException(status_code=409, detail="Order seats have not been held")
        subtotal = sum(float(seat["price"]) for seat in cart_seats)
        service_fee = round(subtotal * 0.1368, 2)
        taxes = round(subtotal * 0.09, 2)
        total = subtotal + service_fee + taxes
        _eventix_assert_amount(payload.ticketSubtotal, subtotal, "Ticket subtotal")
        _eventix_assert_amount(payload.serviceFee, service_fee, "Service fee")
        _eventix_assert_amount(payload.taxes, taxes, "Taxes")
        _eventix_assert_amount(payload.totalPaid, total, "Order total")
        expected_form = payment.get("formData")
        submitted_form = payload.formData.model_dump() if payload.formData else None
        if (
            payload.cardholderName != payment.get("cardholderName")
            or payload.cardLast4 != payment.get("cardLast4")
            or payload.cardType != payment.get("cardType")
            or payload.insurance != payment.get("insurance")
            or submitted_form != expected_form
        ):
            raise HTTPException(status_code=422, detail="Order payment details do not match checkout")
        if (
            payload.concertId != cart.get("concertId")
            or payload.eventName != cart.get("eventName")
            or payload.eventDateTime != cart.get("eventDateTime")
            or payload.venueName != cart.get("venueName")
        ):
            raise HTTPException(status_code=422, detail="Order event details do not match checkout")
        order = {
            **payload.model_dump(),
            "seatDetails": cart_seats,
            "ticketSubtotal": subtotal,
            "serviceFee": service_fee,
            "taxes": taxes,
            "totalPaid": total,
        }
        orders.append(order)
        data["cart"] = {"items": [], "selectedSeats": [], "payment": None}
        data.setdefault("inventory", {})["updatedAtUTC"] = payload.createdAtUTC
        return data

    state = await store.mutate_data(user_id, mutate, "Recorded order confirmation")
    return {"user_id": user_id, "order": order, "inventory": state.data["inventory"]}


@app.post(
    f"{settings.api_prefix}/files",
    response_model=List[FileMetadata],
    tags=["files"],
    summary="Upload files for the current user",
)
async def upload_files(
    files: List[UploadFile] = File(...), user_id: str = Depends(get_user_id)
) -> List[FileMetadata]:
    return [file_store.save_upload(upload, user_id) for upload in files]


@app.get(
    f"{settings.api_prefix}/files",
    response_model=List[FileMetadata],
    tags=["files"],
    summary="List files for the current user",
)
async def list_files(user_id: str = Depends(get_user_id)) -> List[FileMetadata]:
    return file_store.list_files(user_id)


@app.get(
    f"{settings.api_prefix}/files/{{filename}}",
    tags=["files"],
    summary="Fetch a stored file for the current user",
)
async def get_file(filename: str, user_id: str = Depends(get_user_id)) -> FileResponse:
    target_path = file_store.get_file_path(user_id, filename)
    if not target_path:
        raise HTTPException(status_code=404, detail="File not found")
    display_name = filename.split("__", 1)[1] if "__" in filename else filename
    media_type = mimetypes.guess_type(display_name)[0] or "application/octet-stream"
    response = FileResponse(target_path, media_type=media_type, filename=display_name)
    _set_user_cookie(response, user_id, settings)
    return response


@app.get(
    f"{settings.api_prefix}/info",
    response_model=InfoResponse,
    tags=["system"],
    summary="System and request info",
)
async def info(request: Request, user_id: str = Depends(get_user_id)) -> InfoResponse:
    runtime_env = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "env_mode": os.getenv("ENV", "dev"),
    }
    request_info: Dict[str, Any] = {
        "client": request.client.host if request.client else "unknown",
        "headers": dict(request.headers),
        "path": request.url.path,
        "method": request.method,
        "user_id": user_id,
    }
    return InfoResponse(
        app_name=settings.app_name,
        python_version=runtime_env["python_version"],
        env=runtime_env,
        request=request_info,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request.headers.get("x-request-id")},
    )


@mcp_server.tool(
    name="info",
    description="Return backend environment info and the resolved user id.",
)
async def mcp_info(user_cookie: Optional[str] = None) -> Dict[str, Any]:
    user_id = _resolve_user_cookie(user_cookie)
    runtime_env = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "env_mode": os.getenv("ENV", "dev"),
    }
    return {
        "app_name": settings.app_name,
        "user_id": user_id,
        "env": runtime_env,
    }


app.mount("/mcp", mcp_http_app)
