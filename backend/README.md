# Backend

## Purpose
This backend powers the Telegram Mini App storefront and order flow.

## Responsibilities
- Telegram webhook and Mini App integration
- Product catalog API for storefront consumption (`/api/products`)
- Cart/checkout and order creation
- Payment flow support (cash/online)
- Delivery calculation
- PDF receipt generation
- Source/QR/object tracking on orders

## Admin Panel Scope (Lightweight)
The admin panel is intentionally limited to operations:

### 1) Order Management
- `GET /admin`
- `GET /admin/orders`
- `GET /admin/orders/:id`

### 2) Payment Confirmation
- `POST /admin/orders/:id/confirm`

### 3) Order Status Management
- `POST /admin/orders/:id/deliver`
- `POST /admin/orders/:id/return`
- `GET /admin/orders/:id/receipt`

### 4) QR / Source / Object Analytics
- `GET /admin/sources`
- `GET /admin/sources/:code`
- `GET /admin/reports`

## Explicitly Out of Admin Scope
The following are not managed from this backend admin panel:
- Product CRUD (create/edit/delete)
- Manual price/image/category management
- Category CRUD
- Counterparty CRUD
- Purchase/stock admin operations and related reports

## Integration Boundary
- **DALION manages:** products, prices, stock, images
- **Mini App manages:** storefront, ordering, payment flow, delivery calc, QR/source tracking
- **Admin panel manages:** orders, payment confirmation, delivery/return status, QR/source analytics
