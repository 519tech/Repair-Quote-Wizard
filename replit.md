# RepairQuote - Device Repair Estimate Application

## Overview

RepairQuote is a full-stack multi-tenant web application designed to provide instant repair quotes for electronic devices, including smartphones, tablets, and laptops. It features a customer-facing quote wizard for generating estimates and an administrative panel for comprehensive management of device types, devices, services, parts, and pricing. The application aims to streamline the repair quoting process, improve customer engagement, and provide efficient backend management for repair businesses. Key capabilities include multi-service quote selection, "I don't know my device" functionality, embeddable widgets for external websites, and complete multi-tenant shop isolation.

### URL Structure
- `/` - Shop selection page (lists all active shops)
- `/:slug` - Quote wizard for a specific shop (e.g., `/519-tech`, `/test-shop`)
- `/:slug/internal` - Internal counter lookup for shop staff
- `/:slug/embed` - Embeddable widget for external websites
- `/admin` - Admin panel login
- `/super-admin` - Super admin dashboard for managing all shops

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

### Multi-Tenant Architecture
The application supports multiple shops (tenants) with complete data isolation:

- **Shops Table**: Each shop has its own settings including name, slug, optional custom domain, logo, brand color, OpenPhone API key, RepairDesk API key, Gmail settings, quote settings (price rounding, hide prices, discounts), and SMS/email templates.
- **Data Isolation**: All main data tables include a `shop_id` column (device_types, brands, devices, services, service_categories, parts, device_services, device_service_parts, quote_requests). Each API endpoint filters data by the session's shopId.
- **getShopId Helper**: Routes use `getShopId(req)` to extract the shop ID from the session, defaulting to 'default-shop' for backward compatibility.
- **Ownership Validation**: PATCH/DELETE endpoints verify that entities belong to the current shop before allowing mutations.
- **Super Admin Role**: Platform-level super admins can manage all shops, view statistics, and impersonate shop admins via `/super-admin`.
- **Admin Authentication**: Shop admins authenticate via username/password. Sessions store shopId and isSuperAdmin flags.

### Authentication
- **Username/Password Auth**: The admin panel uses simple username/password authentication. Sessions are stored in PostgreSQL and persist for 1 week. Login endpoint: `/api/admin/login`, logout: `/api/admin/logout`.
- **Super Admin Access**: Super admins access `/super-admin` for cross-shop management and can impersonate shop admins.
- **Password Reset**: Shops can reset forgotten passwords via email. The `/api/admin/forgot-password` endpoint sends a temporary password to the shop's email address. Users must change the temporary password on their next login (forced password change screen).
- **New Shop Welcome Email**: When creating a new shop via super admin, a welcome email with temporary credentials is automatically sent to the shop's email address. The shop admin must change their password on first login.

### Quote Delivery Integrations
- **Gmail**: Utilized for sending quote confirmation emails through the Replit Gmail connector.
- **OpenPhone/Quo SMS**: Integrates directly with OpenPhone (Quo) API to send SMS notifications. Each shop can have its own OpenPhone API key and phone number stored in the shops table. Falls back to global `OPENPHONE_API_KEY` environment variable.
- **Shop-Specific Templates**: SMS and email templates can be customized per shop via the shops table fields (smsTemplate, emailSubjectTemplate, emailBodyTemplate, etc.).

### RepairDesk Integration
- **API Key Authentication**: The application integrates with RepairDesk POS software using API key authentication. Each shop can have its own RepairDesk API key.
- **Inventory Checking**: When connected, the application queries RepairDesk's inventory API to check parts stock levels by SKU.
- **Stock Status Display**: Services with parts in stock (quantity > 0) display a green "In Stock" badge in the quote flow.
- **Admin Management**: Connection status is shown in the Settings tab. The API key can be per-shop or global via `REPAIRDESK_API_KEY` secret.
- **API Endpoint**: Uses the RepairDesk Public API v1 (`https://api.repairdesk.co/api/web/v1/inventory`).

### Public Shop Detection API
- **GET /api/shops/detect**: Detects shop from request domain or slug query parameter, returns public shop settings.
- **GET /api/shops/by-slug/:slug**: Gets shop public settings by URL slug.
- **Security**: Public endpoints do not accept client-provided shopId to prevent spoofing. Shop context is derived from authenticated session or device data.