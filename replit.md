# RepairQuote - Device Repair Estimate Application

## Overview
RepairQuote is a full-stack web application for generating instant repair quotes for electronic devices (smartphones, tablets, laptops). It features a customer-facing quote wizard and a comprehensive administrative panel. The application aims to streamline the repair quoting process, enhance customer engagement, and provide efficient backend management for repair businesses. Key capabilities include multi-service quote selection, a "I don't know my device" functionality, and an embeddable widget for external websites. It also includes integrations for inventory and price syncing with third-party POS systems like RepairDesk and Mobilesentrix.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing, TanStack React Query for state management, and shadcn/ui (based on Radix UI) for components. Styling is handled with Tailwind CSS, supporting light/dark themes. The build process uses Vite. A shared `useQuoteWizard()` hook centralizes quote logic, reducing code duplication. The admin panel is modular, with dedicated components for managing submissions, device types, devices, service categories, parts, device-service links, and global settings.

### Backend Architecture
The backend is an Express.js 5 application on Node.js with TypeScript and ESM modules, exposing RESTful APIs. Data persistence uses Drizzle ORM with PostgreSQL, and schema validation is done with Zod. A storage abstraction layer manages database operations. Backend routes are organized into modules for admin, devices, services, parts, quotes, integrations, and settings. Shared middleware provides authentication and file upload utilities. Structured logging via `server/logger.ts` outputs JSON-formatted log entries with timestamps and levels to stdout/stderr, replacing raw console.log/error calls across all server files.

### Data Model
The application's data model includes Device Types, Devices, Service Categories, Services, Parts, Device-Service Links (connecting devices to services with pricing and part associations), Quote Requests, Quote Views (tracking price views for analytics), and Parts Price Cache (for persisting Mobilesentrix API prices). Database indexes exist on devices (name, brandId, deviceTypeId), device_services (deviceId, serviceId, repairDeskServiceId), parts/supplier_parts (sku via unique constraint), brand_device_types (brandId, deviceTypeId), brand_service_categories (brandId, categoryId), and device_service_parts (deviceServiceId, partId).

### Performance Optimizations
- **Shared Quote Wizard Components**: `client/src/components/quote-wizard/index.tsx` contains shared components (SearchView, PickerFlow, ServicesView, ServicesList, StockBadge, QuoteView, QuoteStockBadge, ContactView, UnknownDeviceView, SuccessView, WizardFooter) imported by both `home.tsx` and `embed.tsx`.
- **Response Compression**: Express uses `compression` middleware for gzip/brotli.
- **Batch SKU Price Lookups**: `getSkuPricesBatch()` fetches multiple SKU prices in parallel via `Promise.all` instead of sequential N+1 queries.
- **Bulk SQL Reorder Operations**: `reorderDeviceTypes`, `reorderBrands`, `reorderServiceCategories` use single SQL `UPDATE ... CASE` statements instead of N individual updates.
- **HTTP Cache Headers**: GET endpoints for device types, brands, and service categories include `Cache-Control: public, max-age=300, stale-while-revalidate=60`.
- **Vite Chunk Splitting**: Manual chunks for vendor-react, vendor-ui, and vendor-query improve browser caching.

### Core Features
- **Quote Generation**: Customers can search for devices, select multiple services, and receive itemized quotes.
- **Admin Panel**: Provides comprehensive CRUD operations for all data entities, including bulk import (Excel), image uploads, and management of service links. The Links tab uses subtabs: "Service Links" (main table) and "Missing Parts" (dedicated view with multi-select, bulk dismiss, brand/service filters). Dismiss durations: 1 month, 3 months, or indefinite.
- **Embeddable Widget**: A simplified quote wizard for external website integration.
- **"I Don't Know My Device" Flow**: Allows customers to describe issues for manual follow-up, supported by customizable templates.
- **Internal Tools Page**: A staff interface with three tabs: "Counter Lookup" (quick service and price lookups), "Quote History" (searchable list of confirmed quote submissions), and "Unconfirmed Quotes" (analytics showing quote views that didn't result in submissions, with date range filtering).
- **Quote View Tracking**: The `quote_views` table records when a customer selects a specific service (clicks on it). Tracked from `toggleServiceSelection` in the `useQuoteWizard` hook (home + embed pages). Internal counter lookup does NOT track views (staff usage). Deduplicated per session via module-level Set. Data powers the Unconfirmed Quotes analytics tab.
- **Multi-Service Selection**: Allows selection of multiple services with a running total.
- **Pricing Logic**: Server-side calculation supports "Labour only" services, multi-part pricing (primary, secondary parts with configurable percentages), and alternative primary parts (choosing the cheapest available).
- **Unique Constraints**: Database-level constraints ensure data integrity.

## External Dependencies
### Database
- **PostgreSQL**: Primary relational database, accessed via Drizzle ORM.

### Key NPM Packages
- `@tanstack/react-query`: Client-side data fetching and caching.
- `drizzle-orm` / `drizzle-zod`: Type-safe ORM and schema validation.
- `express`: Backend web framework.
- `zod`: Runtime schema validation.
- `lucide-react`: Icon library.
- `Radix UI`: Accessible UI components.

### Authentication
- **Username/Password Auth**: Admin panel and internal tools page use username/password with sessions stored in PostgreSQL. Session duration is 8 hours.
- **Route Protection**: All endpoints returning customer data (quote requests, submissions, quote views), internal business data (parts, supplier parts, message templates with API keys), and upload URLs are protected with `requireAdmin` middleware. The `calculate-quote` endpoint is public but sanitized — internal cost details (labor price, markup, part cost) are stripped from responses.
- **Message Template Whitelist**: The `/api/message-templates/:type` endpoint allows public access only to safe template types (email/SMS templates, parts_last_updated). Sensitive types (API keys, tokens) require admin authentication.

### Quote Delivery Integrations
- **Gmail**: For sending quote confirmation emails.
- **OpenPhone/Quo SMS**: For sending SMS notifications via OpenPhone API.

### RepairDesk Integration
- **API Key Authentication**: Integrates with RepairDesk POS for inventory checking.
- **Inventory Checking**: Queries RepairDesk's inventory API for part stock levels.
- **Price Sync**: Calculates service prices (labor + parts with markup) for syncing to RepairDesk services, though direct API price updates are currently limited by RepairDesk. Supports manual price overrides and tracks sync history.

### Mobilesentrix Integration
- **OAuth1 Authentication**: Integrates with Mobilesentrix POS API using OAuth 1.0a.
- **Pricing Source Toggle**: Allows choice between Excel upload (default) or Mobilesentrix API for part prices.
- **24-Hour Parts Price Cache**: Two-level cache — in-memory Map as L1 + `parts_price_cache` PostgreSQL table as L2. Survives server restarts. DB cache loaded into memory on startup via `loadDbCacheIntoMemory()`. Manual clear option clears both levels.
- **Admin Product Search**: Enables searching the Mobilesentrix product catalog from the admin panel.
- **SKU Validation**: Validates service link SKUs against the API with batch processing and progress tracking.
- **API Status Testing**: Provides connection testing and error notifications via email.
- **OAuth Authorization Flow**: Browser-based OAuth for automatic token management.

### AI Integration (Release Date Detection)
- **Provider Selection**: Admin can choose between Replit AI (OpenAI) or Google Gemini for auto-detecting device release dates. Configured via Settings > AI tab.
- **Gemini with Web Search**: When Gemini is selected, uses Google Search grounding to look up real-time release dates from the web. Requires a Gemini API key stored in the `message_templates` table (type `gemini_api_key`).
- **Fallback**: If Gemini fails, automatically falls back to OpenAI. Provider preference stored as `ai_provider` in `message_templates`.
- **NPM Package**: `@google/generative-ai` for Gemini SDK.