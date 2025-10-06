# What is FLUO?

FLUO is a Real-time Behavioral Assurance System for OpenTelemetry span attributes analysis and
signal management. It's built with Quarkus and Apache Camel to provide real-time
monitoring and alerting for distributed systems.

## Core Purpose
FLUO analyzes OpenTelemetry traces and spans in real-time to detect behavioral anomalies
and generate signals when predefined rules are violated. It serves as an early warning
system for distributed applications by monitoring telemetry data and alerting on
suspicious patterns.

## Key Components

### Rule Engine
- **OGNL-based Rules**: Uses Object-Graph Navigation Language expressions to define
behavioral conditions
- **Rule Versioning**: Supports multiple versions of rules with activation/deactivation
controls
- **Rule Stacks**: Groups rule versions by ID for easier management
- **Dynamic Evaluation**: Real-time evaluation of incoming telemetry against active
rules

### Signal Management
- **Signal Generation**: Creates signals when telemetry violates rule conditions
- **Status Tracking**: Manages signal lifecycle (OPEN, INVESTIGATING, RESOLVED,
FALSE_POSITIVE)
- **Metadata Association**: Links signals to incidents, adds notes, tracks investigation
progress
- **Severity Classification**: Categorizes signals as ERROR, WARNING, or INFO level
- **Real-time Updates**: WebSocket-based live updates for signal status changes

### Data Processing Pipeline
- **OpenTelemetry Integration**: Native OTLP (OpenTelemetry Protocol) ingestion
- **Apache Camel Routes**: Processing pipelines for trace/span analysis
- **DuckDB Storage**: High-performance analytical database for signal and metadata
storage
- **Multi-tenant Architecture**: Supports multiple organizations with isolated data

### Web Interface
- **Responsive UI**: Mobile-friendly interface built with Tailwind CSS and HTMX
- **Real-time Dashboard**: Live updating signal lists and status displays
- **Rule Management**: Create, edit, and manage behavioral rules through web UI
- **Signal Investigation**: Detailed signal views with trace/span context and
investigation tools
- **Filtering & Search**: Advanced filtering by service, severity, time range, and rule
ID

## Technical Stack
- **Framework**: Quarkus (Java/Groovy)
- **Integration**: Apache Camel for data processing pipelines
- **Database**: DuckDB for analytical workloads
- **Messaging**: NATS for real-time event distribution
- **Frontend**: Server-side rendered templates with HTMX for reactivity
- **Observability**: Prometheus metrics, OpenTelemetry tracing, health checks
- **Testing**: Spock framework for BDD-style testing

## Use Cases
1. **Microservices Monitoring**: Detect when services exhibit unusual behavior patterns
2. **Performance Anomaly Detection**: Alert on latency spikes, error rate increases, or
throughput drops
3. **Security Monitoring**: Identify suspicious access patterns or authentication
anomalies
4. **Business Logic Validation**: Ensure business rules are followed in distributed
transactions
5. **SLA Compliance**: Monitor service level agreement violations in real-time
6. **Incident Management**: Provide early detection and investigation tools for
operational issues

## API Structure
- **Rules API** (`/api/v1/rules`): RESTful API for rule management (CRUD operations)
- **Signals Interface** (`/signals`): Web-based signal management and investigation
- **Health & Metrics** (`/q/health`, `/metrics`): Standard observability endpoints
- **Real-time Updates**: WebSocket endpoints for live signal status changes

## Deployment
- **Cloud Native**: Designed for Kubernetes deployment
- **Docker Support**: Complete containerization with Docker Compose for development
- **SSL/TLS**: Built-in HTTPS support with configurable certificates
- **Authentication**: OIDC/SAML integration via WorkOS for enterprise authentication

FLUO bridges the gap between raw OpenTelemetry span attributes and actionable insights, providing
operations teams with the tools needed to maintain system reliability and performance in
complex distributed environments.

FLUO works only on span data. It does not use metrics or logs.

FLUO lets SREs and other technical people define invariants so that system behaviors that should never happen can be caught and mitigated.

---

# Tanstack BFF for FLUO

This is the Frontend/BFF (Backend for Frontend) application for FLUO, built with Next.js 14 and the Tanstack ecosystem.

## Getting Started

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

This BFF serves three main sections:
- **Marketing Site**: Public-facing pages for FLUO
- **FLUO Dashboard**: Real-time signal monitoring and rule management
- **Account/Billing**: Tenant and subscription management

## Development

- Built with Next.js 14 (App Router) + TypeScript
- UI Components: shadcn/ui + Tailwind CSS
- State Management: Tanstack Query + Zustand
- Authentication: WorkOS integration
- Testing: Vitest + Playwright