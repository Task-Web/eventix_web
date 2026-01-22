# Ticket State Reference

This document describes the per-user state used by the concert tickets backend. The backend stores a `UserState`
envelope with a free-form `data` object. You can store any JSON data under `data`.

All timestamps are ISO 8601 strings (UTC).

## State envelope (UserState)
- `meta.created_at` (string): When the state was created.
- `meta.updated_at` (string): Last update time (patch/merge).
- `meta.version` (number): Incremented on each patch/merge.
- `meta.type` (string): Currently `"unrestricted"`.
- `data` (object): Free-form container for ticket and UI data.
- `note` (string or null): Optional human-readable note describing the last change.

When replacing state via `PUT /state`, you may include a `meta` object in the payload to set the envelope explicitly. If omitted, the backend generates new metadata values.

## Default data shape
The backend initializes `data` with:
- `catalog` (object): Snapshot of the JSON payloads under `data/`.
  - `concerts` (object): Contents of `data/concerts.json`.
  - `venues` (object): Contents of `data/venues.json`.
  - `cities` (object): Contents of `data/cities.json`.
  - `seatMaps` (object): Map of seat map filenames to their JSON payloads.
- `cart` (object)
  - `items` (array): Selected tickets or offers.
  - `selectedSeats` (array): Seat selections during checkout.
-  `payment` (object): Payment snapshot captured on the payment page (optional).
- `orders` (array): Completed purchases recorded on confirmation.
- `preferences` (object)
  - `currency` (string): Default currency, e.g. `"USD"`.
- `uploads` (array): File metadata stored for the current user (uploaded via `/api/files`).

Resetting state via `DELETE /state` also deletes the stored files for that user.

### Upload
- `id` (string): Unique upload id.
- `name` (string): Original file name.
- `filename` (string): Stored file name on disk (e.g. `<id>__<name>`).
- `type` (string): MIME type (falls back to `application/octet-stream`).
- `size` (number): File size in bytes.
- `url` (string): API URL for fetching the file.
- `uploaded_at` (string): ISO timestamp (optional).
- `content_type` (string): Legacy MIME type for base64 uploads.
- `content_base64` (string): Legacy data URL, e.g. `data:application/pdf;base64,...`.

## Full example (UserState)
```json
{
  "meta": {
    "created_at": "2024-04-01T12:00:00+00:00",
    "updated_at": "2024-04-01T12:30:00+00:00",
    "version": 2,
    "type": "unrestricted"
  },
  "data": {
    "catalog": {
      "concerts": { "concerts": [] },
      "venues": { "venues": [] },
      "cities": { "cities": [] },
      "seatMaps": {}
    },
    "cart": { "items": [], "selectedSeats": [] },
    "orders": [],
    "preferences": { "currency": "USD" },
    "uploads": [
      {
        "id": "b5b0c835dfe64f0d8b800d5c1700f9f9",
        "name": "report.pdf",
        "filename": "b5b0c835dfe64f0d8b800d5c1700f9f9__report.pdf",
        "type": "application/pdf",
        "size": 84231,
        "url": "/api/files/b5b0c835dfe64f0d8b800d5c1700f9f9__report.pdf",
        "uploaded_at": "2024-04-01T12:10:00+00:00"
      }
    ]
  },
  "note": "Seeded default data"
}
```
