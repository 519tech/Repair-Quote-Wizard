# RepairQuote - Device Repair Estimate Application

## Overview

RepairQuote is a full-stack web application that provides instant repair quotes for electronic devices including smartphones, tablets, laptops, and more. The application features a customer-facing quote wizard and an admin panel for managing device types, devices, services, parts, and pricing.

## Recent Changes

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
- **Services**: Repair services offered
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