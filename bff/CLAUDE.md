# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **FLUO Frontend** - a pure React application built with the Tanstack ecosystem. The project uses Vite, React, and Tanstack Router for a modern, type-safe development experience with no deployment dependencies.

## Architecture Decisions

The frontend follows FLUO's documented architectural decisions:

- **[ADR-011: Pure Application Framework](../ADRs/011-pure-application-framework.md)** - Frontend as deployment-agnostic application
- **[ADR-006: Tanstack Ecosystem for Frontend Architecture](../ADRs/006-tanstack-frontend-architecture.md)** - Comprehensive frontend technology choices
- **[ADR-002: Nix Flakes as Build System Foundation](../ADRs/002-nix-flakes-build-system.md)** - Reproducible builds and development environments

📋 **See [ADR Index](../ADRs/README.md) for complete architectural documentation**

## Architecture

The frontend is built using the Tanstack ecosystem and serves three main sections:
- **Marketing Site**: Public-facing pages for FLUO promotion
- **FLUO Web Dashboard**: Real-time signal monitoring and rule management interface
- **Account/Billing Site**: Tenant and subscription management

### Technology Stack
- **Build Tool**: Vite 6.x for fast development and optimized builds
- **Framework**: React 18.x with TypeScript
- **Routing**: Tanstack Router for type-safe, file-based routing
- **State Management**: Reactive Architecture with React Context + Background Workers
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom FLUO design system
- **Authentication**: WorkOS integration with JWT tokens

### Reactive Architecture ✅ IMPLEMENTED
The application uses a high-performance reactive architecture designed for optimal user experience:

#### 🚀 Performance-First Design
- **Reactive UI Controller**: React Context-based state management with background workers
- **Non-Blocking Main Thread**: All heavy operations delegated to background workers
- **Signal-Based Communication**: Workers notify UI via signals for instant updates
- **Instant Demo Mode**: Immediate UI activation without async setup
- **Background Data Loading**: Pre-loaded mock data for snappy interactions

#### ⚡ Background Worker Architecture
```
UI Controller (Main Thread)    Background Workers
├── ui-controller.ts          ├── auth-worker.ts
├── auth state                ├── data-worker.ts
├── data display state        └── signals/messaging
└── UI actions only
```

#### 🔄 Reactive Data Flow
1. **UI Controller** manages only display state (never blocks)
2. **Auth Worker** handles authentication off-main-thread
3. **Data Worker** fetches and caches data in background
4. **Signal Communication** updates UI reactively via requestAnimationFrame
5. **Graceful Degradation** when services are unavailable

#### 📁 Reactive Architecture Files
```
src/lib/reactive-engine/
├── ui-controller.ts       # Main UI controller (Zustand store)
└── useAuth, useSignals, useRules, useAnalytics selectors

src/lib/workers/
├── auth-worker.ts         # Authentication off main thread
└── data-worker.ts         # Data fetching and caching
```

#### ✅ React Hooks Best Practices Compliance
The reactive architecture follows 2024 React best practices:

**🔍 Exhaustive Dependencies**: All useEffect hooks include complete dependency arrays
- Context dispatch functions have stable references and are safely included in dependencies
- No artificial omission of dependencies to "fix" infinite loops
- Follows React's exhaustive-deps ESLint rule strictly

**🎯 Optimized Context Usage**: React Context selectors avoid unnecessary re-renders
- Selective context consumption with custom hooks
- Memoization of context values to prevent unnecessary re-renders
- Split contexts for different concerns (UI state vs auth state)

**⚡ Stable References**: Dispatch functions maintain consistency
- useReducer dispatch doesn't change between renders (similar to React setState)
- Safe to include in dependency arrays without causing infinite loops
- Follows React's guidance on stable function references

### Key Integration Points

- **FLUO Backend API**: Documented in `openapi-schema.json` - primary integration for signals (`/signals`) and rules (`/api/v1/rules`)
- **WebSocket Integration**: Real-time signal updates from FLUO backend
- **WorkOS Authentication**: OIDC/SAML integration for enterprise authentication
- **Multi-tenant Architecture**: Must maintain tenant isolation when proxying to FLUO

## Development Commands

### Using Nix with Locked Dependencies (Recommended - Supply Chain Security) ✅ IMPLEMENTED
```bash
# Enter development environment with Nix-managed npm dependencies
nix develop

# Build the application (all npm dependencies locked in flake.lock)
nix build

# Build Docker image with Nix-locked dependencies
nix build .#docker

# Load Docker image (dependencies locked for reproducible builds)
nix build .#docker && docker load < result
```

**🔒 Supply Chain Security**: All dependencies are cryptographically locked in `flake.lock` with SHA256 hashes. npm dependencies are managed through `package-lock.json` and the Nix build environment provides complete dependency provenance and reproducible builds.

### Using npm directly
```bash
# Development
npm run dev          # Start Vite development server
npm run build        # Build for production with Vite
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # Run TypeScript compiler checks
npm run format       # Format code with Prettier
npm run format:check # Check code formatting

# Testing
npm run test         # Run unit tests with Vitest
npm run test:ui      # Run Vitest with UI
npm run test:e2e     # Run end-to-end tests with Playwright

# Tanstack Router
npx @tanstack/router-cli generate  # Generate route tree
```

### Docker
```bash
# Build and load Docker image with Nix
npm run docker:load

# Run the container
docker run -p 3000:3000 fluo-tanstack-bff:latest
```

## Key Technical Requirements

### Build and dependency management ✅ SUPPLY CHAIN SECURED

- **Primary**: Use Nix Flakes with cryptographic dependency locking (./flake.nix file)
  - devShell with consistent Node.js environment
  - docker image output with Nix-locked dependencies
  - npm dependencies managed through package-lock.json and locked in flake.lock
  - All dependencies locked with SHA256 hashes for immutable builds
  - Complete dependency provenance through Nix store
  - Reproducible build environment across all systems (dev/staging/prod identical)
  - Development and production builds use identical toolchain and dependency versions

### Security & Authentication
- JWT-based authentication with WorkOS OIDC/SAML integration
- Role-based access control (RBAC) for different FLUO application levels
- Tenant context propagation to maintain data isolation

### API Design
- RESTful APIs with JSON payloads
- API versioning strategy
- Comprehensive OpenAPI/Swagger documentation

### Performance & Reliability
- Caching strategies (server-side and client-side with Tanstack Query)
- WebSocket proxying for real-time signal updates
- Stateless architecture for horizontal scaling
- Error handling with graceful degradation from FLUO API failures

### Frontend Development
- Built with Vite + React + TypeScript
- Tanstack Router for type-safe, file-based routing
- shadcn/ui components for consistency and accessibility
- Tanstack Query for server state management
- WCAG accessibility compliance
- Responsive design across screen sizes
- FLUO branding with custom Tailwind design system

## Data Flow

1. **Signal Management**: Real-time display of FLUO signals (OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE) with live status updates
2. **Rule Management**: CRUD operations for OGNL-based behavioral rules with versioning and validation
3. **Tenant Management**: Multi-tenant user/team management with proper isolation

## Deployment

- Designed for Kubernetes deployment (Cloud Native)
- Integration with logging aggregation (ELK stack consideration)
- Metrics integration (Prometheus, Grafana)
- CI/CD automation pipeline

## Security Features

### Enterprise-Grade Security Framework ✅ IMPLEMENTED
The application now includes a comprehensive security system with multiple layers of protection:

#### 🔒 Multi-Layered Security Architecture
- **Input Validation & Sanitization**: XSS protection, SQL injection prevention, OGNL security validation
- **Authentication & Authorization**: WorkOS integration with RBAC (viewer → member → admin → owner hierarchy)
- **CSRF Protection**: Cryptographically secure tokens with 30-minute rotation
- **Rate Limiting**: Client-side and API-level abuse prevention (100 requests/minute default)
- **Secure Headers**: CSP, HSTS, X-Frame-Options, and other security headers

#### 🔴 Red Team Testing Framework ✅ IMPLEMENTED
Automated security validation with comprehensive test suite:
- **XSS Protection Tests**: Validates HTML sanitization against common payloads
- **SQL Injection Tests**: Prevents database injection attacks
- **OGNL Injection Tests**: Secures rule engine against code execution
- **Authentication Security**: Session validation and permission bypass detection
- **CSRF Protection Tests**: Token generation and validation testing
- **Rate Limiting Tests**: Brute force and abuse prevention validation

#### 📊 Security Monitoring & Audit System ✅ IMPLEMENTED
- **Comprehensive Audit Logging**: All user actions, security events, system operations
- **Real-time Security Monitoring**: Failed logins, permission denials, suspicious activities
- **Security Metrics Dashboard**: Live threat tracking and incident response (accessible at `/security`)
- **Compliance Ready**: CSV export, immutable logs, PII redaction

#### 🛡️ Professional Error Handling ✅ IMPLEMENTED
- **Categorized Error Management**: Network, auth, validation, security, server errors
- **Security-Aware Recovery**: Automatic incident response and recovery actions
- **Information Disclosure Prevention**: User-friendly messages without technical leakage
- **Global Error Handling**: Unhandled exceptions and promise rejections

### Security Architecture Files
```
src/lib/security/
├── validation.ts       # Input validation & sanitization
├── auth-guard.ts      # RBAC & session security
├── csrf.ts           # CSRF protection & secure headers
└── red-team.ts       # Automated security testing

src/lib/monitoring/
└── audit-logger.ts    # Comprehensive audit system

src/lib/errors/
└── error-handler.ts   # Professional error management

src/components/security/
└── security-dashboard.tsx  # Admin security interface
```

### Security Testing
```bash
# Run comprehensive security tests
npm run security:test

# Access security dashboard (admin only)
http://localhost:3000/security
```

## Implementation Status

### ✅ Completed Features
1. **API Client & Integration**: Type-safe FLUO backend integration with OpenAPI types
2. **WebSocket Client**: Real-time signal updates with auto-reconnection
3. **Authentication System**: WorkOS integration with demo mode for development
4. **Signal Management**: Complete dashboard with filtering, status updates, real-time sync
5. **Rule Management**: OGNL rule editor with validation and lifecycle management
6. **Tenant Management**: Organization settings, usage tracking, team management
7. **Security Framework**: Enterprise-grade security with red-team testing
8. **Audit & Monitoring**: Comprehensive logging and security metrics

### 🏗️ Architecture Highlights
- **Type Safety**: Full TypeScript coverage with OpenAPI-generated types
- **Real-time Updates**: WebSocket integration for live signal status changes
- **Security First**: Multi-layered defense with automated testing
- **Professional UX**: Responsive design with shadcn/ui components
- **Scalable**: Stateless architecture ready for Kubernetes deployment

### 🔐 Security Posture
- **Input Validation**: All user inputs sanitized and validated
- **Authentication**: WorkOS enterprise SSO with JWT tokens
- **Authorization**: Fine-grained RBAC with permission matrix
- **Audit Trail**: Complete logging for compliance and forensics
- **Threat Detection**: Real-time monitoring with automated alerts
- **Red Team Validated**: Comprehensive security testing framework

## Development Workflow

### Regular Maintenance
```bash
# Add files to git (required for Nix)
git add .

# Update documentation
# Update CLAUDE.md when adding features
# Document security changes in security sections

# Run security validation
npm run security:test  # Run red team tests
npm run type-check     # Validate TypeScript
npm run lint          # Code quality checks
```

## Future Development Notes

### ✅ Recently Completed
- Fixed React mounting issue preventing app display
- All TypeScript compilation issues resolved
- Complete UI component library setup finished
- Development server running successfully on localhost:3000
- Landing page fully visible and interactive

### Immediate Priorities
- Implement dashboard with real-time signal monitoring
- Complete signal management CRUD operations
- Add investigation workflow with collaborative features
- Finalize API response type handling
- Polish security dashboard UX

### Next Phase Development
- Advanced rule testing and simulation
- Signal correlation and analytics
- Advanced tenant billing integration
- Performance monitoring and alerting
- Integration with external SIEM systems

When implementing new features:
- Always run security tests first: `npm run security:test`
- Update audit logging for new user actions
- Validate all inputs using `SecurityValidator`
- Check permissions using `AuthGuard.hasPermission()`
- Update CLAUDE.md documentation