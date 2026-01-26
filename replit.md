# RepairQuote - Device Repair Estimate Application

## Overview

RepairQuote is a full-stack web application designed to provide instant repair quotes for electronic devices, including smartphones, tablets, and laptops. It features a customer-facing quote wizard for generating estimates and an administrative panel for comprehensive management of device types, devices, services, parts, and pricing. The application aims to streamline the repair quoting process, improve customer engagement, and provide efficient backend management for repair businesses. Key capabilities include multi-service quote selection, "I don't know my device" functionality, and an embeddable widget for external websites.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with **React 18** and **TypeScript**, using **Wouter** for routing and **TanStack React Query** for server state management. **shadcn/ui** provides UI components based on **Radix UI** primitives, and styling is managed with **Tailwind CSS**, supporting light/dark themes. The build process is handled by **Vite**. The architecture follows a pages-based structure with reusable components and uses path aliases for better organization.

### Backend Architecture
The backend is an **Express.js 5** application running on **Node.js** with **TypeScript** and ESM modules. It exposes **RESTful APIs** under the `/api/` prefix. Data persistence is managed using **Drizzle ORM** with a **PostgreSQL** dialect, and schema validation is enforced with **Zod** and `drizzle-zod`. A storage abstraction layer (`server/storage.ts`) facilitates database operations, promoting modularity.

### Data Model
The application's data model includes:
- **Device Types**: Categories (e.g., smartphone, tablet).
- **Devices**: Specific models linked to brands and device types.
- **Service Categories**: Grouping of services (e.g., "Screen Replacement").
- **Services**: Repair services, potentially grouped by category, with support for images and "labour-only" designation.
- **Parts**: Inventory items with SKU, name, and price, supporting both supplier and custom parts.
- **Device-Service Links**: Connects devices to services, defining pricing, repair time, and warranty, including part associations.
- **Quote Requests**: Stores customer-submitted quote inquiries, including device details, selected services, and contact information.

### Core Features
- **Quote Generation**: Customers can search for devices, select multiple services from categorized options, and receive a combined, itemized quote.
- **Admin Panel**: Comprehensive CRUD operations for managing all data entities (device types, brands, devices, services, parts, service categories). Includes features like bulk device and parts import (via Excel), image uploads, and service link management with error highlighting for missing parts.
- **Embeddable Widget**: A simplified version of the quote wizard available at `/embed` for integration into external websites.
- **"I Don't Know My Device" Flow**: Allows customers to describe their issue for a manual follow-up, supported by customizable email and SMS templates.
- **Internal Counter Lookup**: A streamlined interface at `/internal` for staff to quickly look up service options and prices for devices.
- **Multi-Service Selection**: Customers can select multiple services within a repair category or across categories, with a running total displayed.
- **Pricing Logic**: Server-side quote calculation ensures accurate pricing. Services without parts can be marked as "Labour only" to display prices.
- **Multi-Part Pricing**: Services can require multiple parts. Primary parts are charged at 100%, while additional parts are charged at the service's "Secondary Part %" (configurable, default 50%). Quote calculation sums: labor + (primary part cost × markup) + (sum of additional parts × secondary% × markup).
- **Alternative Primary Parts**: Device-service links can specify multiple alternative primary parts via the `alternativePartSkus` array. The quote calculation automatically uses the cheapest available option for pricing. Stock status shows "In Stock" if ANY primary part is available, while ALL secondary parts must be in stock.
- **Unique Constraints**: Database-level constraints prevent duplicate entries for devices, services, and device-service links.

## External Dependencies

### Database
- **PostgreSQL**: The primary relational database, accessed via `DATABASE_URL` and managed with Drizzle ORM.

### Key NPM Packages
- `@tanstack/react-query`: For client-side data fetching, caching, and synchronization.
- `drizzle-orm` / `drizzle-zod`: For type-safe ORM operations and schema validation with PostgreSQL.
- `express`: The foundational web framework for the backend.
- `zod`: Used for runtime schema validation throughout the application.
- `lucide-react`: An icon library for UI elements.
- `Radix UI`: Provides accessible and unstyled UI components as building blocks.

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Enhances development with an error overlay.
- `@replit/vite-plugin-cartographer`: Development tooling.
- `@replit/vite-plugin-dev-banner`: Displays development environment information.

### Authentication
- **Username/Password Auth**: The admin panel uses simple username/password authentication. Sessions are stored in PostgreSQL and persist for 1 week. Login endpoint: `/api/admin/login`, logout: `/api/admin/logout`.

### Quote Delivery Integrations
- **Gmail**: Utilized for sending quote confirmation emails through the Replit Gmail connector.
- **OpenPhone/Quo SMS**: Integrates directly with OpenPhone (Quo) API to send SMS notifications, configured via `OPENPHONE_API_KEY` environment variable. Automatically fetches available phone numbers from the account.

### RepairDesk Integration
- **API Key Authentication**: The application integrates with RepairDesk POS software using API key authentication.
- **Inventory Checking**: When connected, the application queries RepairDesk's inventory API to check parts stock levels by SKU.
- **Stock Status Display**: Services with parts in stock (quantity > 0) display a green "In Stock" badge in the quote flow.
- **Admin Management**: Connection status is shown in the Settings tab. The API key is managed via the `REPAIRDESK_API_KEY` secret.
- **API Endpoint**: Uses the RepairDesk Public API v1 (`https://api.repairdesk.co/api/web/v1/inventory`).