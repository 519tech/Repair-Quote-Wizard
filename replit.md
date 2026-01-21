# RepairQuote - Device Repair Estimate Application

## Overview

RepairQuote is a full-stack web application that provides instant repair quotes for electronic devices including smartphones, tablets, laptops, and more. The application features a customer-facing quote wizard and an admin panel for managing device types, devices, services, parts, and pricing.

## Recent Changes

- **Jan 2026**: Service availability and "Labour only" feature
  - Services without parts assigned now show "Not Available" instead of price
  - Warranty and repair time are hidden for unavailable services
  - New "Labour only" checkbox for services that don't require parts (e.g., diagnostics, software services)
  - Labour-only services will show their price even without parts attached
  - Unavailable services are sorted to the end of the comparison list and dimmed
- **Jan 2026**: Clone service links when adding new device
  - When adding a new device, search for an existing device to clone service links from
  - All service links are copied except parts (parts SKU must be assigned separately)
  - Saves time when new device models are released with similar repair services
- **Jan 2026**: Parts management improvements for 100k+ parts
  - Bulk upload now replaces all existing parts (not upsert) to identify removed supplier items
  - Server-side pagination with 100 parts per page
  - Server-side search by SKU or name with debounced input
  - Pagination controls with Previous/Next buttons and page info
- **Jan 2026**: Quote widget footer with disclaimer and price update timestamp
  - Footer displays: "All prices are estimates only and subject to change. In-store verification required."
  - Shows "Prices last updated: [date]" based on last parts import
- **Jan 2026**: Services in comparison view now sorted by price (lowest first)
- **Jan 2026**: Added bulk add feature for service links
  - Click "Bulk Add" in Service Links tab to link a service to multiple devices at once
  - Filter by device type (e.g., all smartphones) and/or brand (e.g., all Samsung devices)
  - Use case: Add diagnostic service to all smartphones or all Samsung tablets
  - Shows preview of how many devices will be linked before submitting
- **Jan 2026**: Added filtering to Services tab - filter by category (like Devices tab)
- **Jan 2026**: Quote wizard now shows ALL service options side-by-side for comparison
  - After selecting a repair category, all available services are displayed on one page
  - Each service shows price, repair time, warranty with individual "Send me quote" button
  - Users can compare options easily before deciding
  - Streamlined 4-step wizard: Type → Brand → Device → Category/Compare
- **Jan 2026**: Added database unique constraints to prevent duplicate entries:
  - Devices: unique on (name + brand + device type) combination
  - Services: unique on name
  - Device-Service Links: unique on (device + service) combination - prevents linking same device-service pair twice
  - Note: Brands, Device Types, Service Categories, and Parts SKU already had unique constraints
- **Jan 2026**: Added brand-service-category linking - service categories can be restricted to specific brands
- **Jan 2026**: Service Categories tab now shows linked brands column and "Manage Brand Links" dialog
- **Jan 2026**: Quote wizard filters categories by selected brand (categories with no links appear for all brands)
- **Jan 2026**: Added Service Categories feature - services can now be grouped into categories (e.g., "Battery Replacement", "Screen Replacement")
- **Jan 2026**: Quote wizard now shows category selection first when multiple categories exist, then service types within category
- **Jan 2026**: Added Service Categories tab in admin panel with full CRUD (create, edit, delete categories)
- **Jan 2026**: Services tab updated with category dropdown selector and category column in table
- **Jan 2026**: Added device search bar to quote widget - search all models to skip step-by-step selection
- **Jan 2026**: Search results show device name, brand, and type for easy identification
- **Jan 2026**: Selecting a search result jumps directly to service selection (step 4)
- **Jan 2026**: Bulk device import now accepts flexible column names (Model, Device, Name, etc.)
- **Jan 2026**: Added image upload support to Brands tab - upload logo via Object Storage or enter URL
- **Jan 2026**: Added image upload support to Devices tab - upload device image via Object Storage or enter URL
- **Jan 2026**: Created reusable ImageInput component with URL/upload mode toggle and error handling
- **Jan 2026**: Added bulk device import via Excel (.xlsx) with downloadable sample template
- **Jan 2026**: Bulk device import columns: Brand, Type, Model Name, Image URL
- **Jan 2026**: Added spreadsheet-style Service Links tab with columns: Device Type, Brand, Device Model, Service, Part SKU, Total Price, Actions
- **Jan 2026**: Added inline SKU editing - click on any Part SKU cell to edit directly
- **Jan 2026**: Added filtering by Brand, Device, or Service in Service Links tab
- **Jan 2026**: Added embeddable quote widget at /embed - can be embedded via iframe on external websites
- **Jan 2026**: Added password protection to admin panel - requires ADMIN_PASSWORD to access
- **Jan 2026**: Added Settings tab in admin panel to customize email and SMS message templates with macros
- **Jan 2026**: Quote widget rearranged - contact info collected before showing quote
- **Jan 2026**: Removed price from service selection step (shown only after contact info)
- **Jan 2026**: Quote display now shows repair time and warranty
- **Jan 2026**: Added opt-in checkbox for SMS and email quote delivery
- **Jan 2026**: Performance optimization - parts dropdown only renders when searching, capped at 50 results
- **Jan 2026**: Added SKU input to edit service links dialog (not just create)
- **Jan 2026**: Added Total Price column to Service Links table showing calculated price
- **Jan 2026**: Fixed $NaN price display in quote wizard by using service-level laborPrice/partsMarkup
- **Jan 2026**: Added filtering to Devices tab - filter by brand or device type
- **Jan 2026**: Added Excel (.xlsx) file upload for bulk parts import - columns: Product SKU, Product Name, Original Price
- **Jan 2026**: Added search functionality to Parts tab - filter by SKU or name
- **Jan 2026**: Added brand selection step to quote wizard (Type → Brand → Device → Service → Contact → Success)
- **Jan 2026**: Enhanced admin panel with full CRUD operations (Create, Read, Update, Delete) for all entities
- **Jan 2026**: Added SKU-based part lookup in device-service link creation - enter SKU to auto-find part
- **Jan 2026**: Server-side quote calculation - all pricing computed on server via `/api/calculate-quote/:deviceServiceId`
- **Jan 2026**: Improved error handling with user-friendly messages for duplicate name/SKU violations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (supports light/dark mode)
- **Build Tool**: Vite with React plugin

The frontend follows a pages-based structure with reusable UI components. Path aliases are configured (`@/` for client source, `@shared/` for shared code).

### Backend Architecture
- **Framework**: Express.js 5 running on Node.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints under `/api/` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod for type-safe validation

The server uses a storage abstraction layer (`server/storage.ts`) that implements database operations, making it easier to swap storage implementations if needed.

### Data Model
The application manages:
- **Device Types**: Categories like smartphone, tablet, laptop
- **Devices**: Specific models within each type
- **Service Categories**: Hierarchical grouping for services (e.g., "Battery Replacement", "Screen Replacement")
- **Services**: Repair services offered, optionally grouped by category
- **Parts**: Inventory with SKU and pricing
- **Device Services**: Links devices to services with pricing
- **Quote Requests**: Customer quote submissions

### Development vs Production
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Static files served from `dist/public`, server bundled with esbuild

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Connection**: Uses `pg` (node-postgres) Pool with Drizzle ORM
- **Migrations**: Managed via `drizzle-kit push`

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm / drizzle-zod**: Type-safe database operations and schema validation
- **express**: HTTP server framework
- **zod**: Runtime type validation
- **lucide-react**: Icon library
- **Radix UI**: Accessible UI primitives (dialog, dropdown, tabs, etc.)

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment banner

### Quote Delivery Integrations
- **Gmail**: Sends quote emails via Replit Gmail connector (configured in server/gmail.ts)
- **OpenPhone/Zapier SMS**: Sends quote SMS via Zapier webhook
  - Requires `ZAPIER_WEBHOOK_URL` environment variable
  - Set up a Zap in Zapier: Webhook (Catch Hook) → OpenPhone (Send Message)
  - The webhook receives: phone, message, customerName, deviceName, serviceName, price, repairTime, warranty