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
The application's data model includes Device Types, Devices, Service Categories, Services, Parts, Device-Service Links (connecting devices to services with pricing and part associations), Quote Requests, and Parts Price Cache (for persisting Mobilesentrix API prices). Database indexes exist on devices (name, brandId, deviceTypeId), device_services (deviceId, serviceId, repairDeskServiceId), and parts/supplier_parts (sku via unique constraint).

### Core Features
- **Quote Generation**: Customers can search for devices, select multiple services, and receive itemized quotes.
- **Admin Panel**: Provides comprehensive CRUD operations for all data entities, including bulk import (Excel), image uploads, and management of service links.
- **Embeddable Widget**: A simplified quote wizard for external website integration.
- **"I Don't Know My Device" Flow**: Allows customers to describe issues for manual follow-up, supported by customizable templates.
- **Internal Counter Lookup**: A staff interface for quick service and price lookups.
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
- **Username/Password Auth**: Admin panel uses username/password with sessions stored in PostgreSQL.

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