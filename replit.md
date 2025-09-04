# Overview

This is a full-stack Tuya Smart Life device monitoring application that provides read-only access to smart home devices. The application displays device lists and current status information without control capabilities. Built with a Node.js/Express backend using the official Tuya connector and a React frontend with modern UI components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent UI design
- **State Management**: TanStack Query (React Query) for server state management and API caching
- **Routing**: Wouter for lightweight client-side routing
- **Components**: Comprehensive shadcn/ui component system with Radix UI primitives

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js 18+
- **API Integration**: Official Tuya connector package (`tuya-connector-nodejs`) for device communication
- **Development Tools**: Hot reload with Vite development server integration
- **Build System**: ESBuild for production bundling with platform-specific optimizations

## Database Architecture
- **ORM**: Drizzle ORM configured for PostgreSQL with schema-first approach
- **Database**: PostgreSQL (configured but not actively used since app is read-only)
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Neon Database serverless driver for PostgreSQL connectivity

## API Design
The application exposes three main REST endpoints:
- `GET /api/health` - System health check with data center information
- `GET /api/devices` - Retrieves list of devices from Tuya's "associated users" API
- `GET /api/devices/:id/status` - Fetches current data point (DP) status for specific devices

## Security Architecture
- **API Security**: All Tuya API credentials are server-side only, never exposed to the browser
- **CORS**: Configured for cross-origin requests during development
- **Environment Variables**: Sensitive configuration managed through environment variables

## Component Architecture
- **UI Components**: Modular shadcn/ui components with consistent theming
- **Custom Components**: Device-specific components (DeviceTable, DeviceStatusPanel) for domain logic
- **Responsive Design**: Mobile-first approach with responsive breakpoints

# External Dependencies

## Core Dependencies
- **Tuya Integration**: `tuya-connector-nodejs` for official Tuya OpenAPI communication
- **Database**: `@neondatabase/serverless` for PostgreSQL connectivity
- **ORM**: `drizzle-orm` with PostgreSQL dialect and Zod integration

## Frontend Dependencies
- **UI Library**: Complete shadcn/ui component suite with Radix UI primitives
- **Data Fetching**: TanStack React Query for API state management
- **Styling**: Tailwind CSS with class-variance-authority for component variants
- **Icons**: Lucide React for consistent iconography

## Development Dependencies
- **Build Tools**: Vite with React plugin and TypeScript support
- **Development**: TSX for TypeScript execution and hot reload capabilities
- **Code Quality**: TypeScript compiler with strict mode enabled

## Environment Configuration
Required environment variables:
- `TUYA_ACCESS_ID` - Tuya OpenAPI access ID (client ID)
- `TUYA_ACCESS_SECRET` - Tuya OpenAPI secret key  
- `TUYA_ENDPOINT` - Tuya data center endpoint URL (e.g., https://openapi.tuyain.com)
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (defaults to 3000)