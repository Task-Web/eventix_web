from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import StateMeta, UserState


class StateRequest(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None
    meta: Optional[StateMeta] = None


class StatePatchRequest(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None


class StateResponse(BaseModel):
    user_id: str
    state: UserState


class InfoResponse(BaseModel):
    app_name: str
    python_version: str
    env: Dict[str, str]
    request: Dict[str, Any]


class FileMetadata(BaseModel):
    id: str
    name: str
    size: int
    type: str
    url: str
    filename: str


class EventixRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EventixSeat(EventixRequest):

    id: str
    section: str
    row: str
    seatNumber: int = Field(ge=1)
    price: float = Field(ge=0)


class EventixCartRequest(EventixRequest):

    concertId: str
    eventName: str
    venueName: str
    eventDateTime: str
    quantity: int = Field(ge=0)
    selectedSeats: list[EventixSeat]
    totalPrice: float = Field(ge=0)
    updatedAtUTC: str


class EventixPaymentForm(EventixRequest):
    cardName: str
    cardNumber: str = Field(pattern=r"^\d{12,19}$")
    expDate: str = Field(pattern=r"^(0[1-9]|1[0-2])/\d{2}$")
    cvv: str = Field(pattern=r"^\d{3,4}$")
    country: str
    address1: str
    address2: str
    city: str
    state: str
    postalCode: str
    phone: str


class EventixPayment(EventixRequest):

    cardholderName: str
    cardLast4: str = Field(pattern=r"^\d{4}$")
    cardType: Literal["VISA", "Mastercard", "AmEx", "Discover", "CARD"]
    insurance: bool
    formData: EventixPaymentForm
    updatedAtUTC: str


class EventixOrderSummary(EventixRequest):
    concertId: str
    eventName: str
    eventDate: str
    eventDateTime: str
    venueName: str
    quantity: int = Field(ge=1)
    seatDetails: list[EventixSeat]
    pricePerTicket: float = Field(ge=0)
    ticketSubtotal: float = Field(ge=0)
    serviceFee: float = Field(ge=0)
    taxes: float = Field(ge=0)
    total: float = Field(ge=0)
    currency: Literal["USD"]


class EventixCheckout(EventixRequest):

    termsAgreed: bool
    orderSummary: EventixOrderSummary
    updatedAtUTC: str


class EventixCheckoutRequest(EventixRequest):

    payment: EventixPayment
    checkout: EventixCheckout


class EventixOrderRequest(EventixRequest):

    orderNumber: str
    concertId: str
    eventName: str
    eventDateTime: str
    venueName: str
    quantity: int = Field(ge=1)
    seatDetails: list[EventixSeat]
    ticketSubtotal: float = Field(ge=0)
    serviceFee: float = Field(ge=0)
    taxes: float = Field(ge=0)
    totalPaid: float = Field(ge=0)
    cardholderName: str
    cardLast4: str
    cardType: str
    insurance: bool
    formData: Optional[EventixPaymentForm] = None
    createdAtUTC: str


class EventixSeatHoldRequest(EventixRequest):

    seat_ids: list[str] = Field(min_length=1)

    @field_validator("seat_ids")
    @classmethod
    def unique_seat_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("seat_ids must be unique")
        return value
