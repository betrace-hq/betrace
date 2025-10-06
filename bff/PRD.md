# Product Requirements Document: Tanstack BFF for FLUO (Revised)

**1. Introduction**

This document outlines the requirements for the **Tanstack Backend for Frontend (BFF) project for FLUO**, built using Tanstack and leveraging shadcn components. The BFF will serve as a secure, reliable, and performant gateway for the FLUO application, encompassing a marketing site, a web dashboard for FLUO, and an account/billing site for FLUO users/tenants.

**1.1. Purpose**

The purpose of this PRD is to define the scope, features, and technical requirements for the Tanstack BFF for FLUO. It will serve as a guiding document for the development team, ensuring all stakeholders are aligned on the project goals and deliverables.

**1.2. Scope**

The scope of this project includes the development of a BFF that:

*   Consumes and creates data for the FLUO frontend.
*   Provides a secure, reliable, and performant API layer.
*   Integrates with the existing FLUO backend, which is a Real-time Behavioral Assurance System for OpenTelemetry data analysis and signal management (exposed with the API documented at `./openapi-schema.json`).
*   Offers a marketing site, a web dashboard for FLUO, and an account/billing site for FLUO tenants.
*   Utilizes shadcn components for rapid UI development.

**1.3. Goals**

*   **Security:** Protect sensitive user data and ensure secure communication.
*   **Reliability:** Maintain high availability and provide a consistent user experience.
*   **Performance:** Offer fast response times and efficient data handling.
*   **Developer Experience:** Provide an easy-to-use and well-documented API for frontend developers.
*   **Scalability:** Design the BFF to handle future growth and increased user load.

**2. Target Audience**

*   **FLUO Marketing Visitors:** Individuals interested in learning about and potentially using FLUO.
*   **Operations Teams/DevOps:** Users responsible for monitoring and ensuring the reliability of distributed systems using FLUO.
*   **Account Holders:** Users managing their FLUO subscriptions and billing.
*   **Frontend Developers:** Developers building and maintaining the FLUO frontend that consumes this BFF.

**3. Features**

The Tanstack BFF for FLUO will expose endpoints to support the following major site sections:

**3.1. Marketing Site**

The marketing site will showcase FLUO's features, benefits, and pricing. It will include:

*   **Public-facing Pages:**
    *   Home page
    *   Features page
    *   Pricing page
    *   About Us page
    *   Contact Us page
    *   Blog (optional, TBD)
*   **Lead Generation:**
    *   Sign-up/Registration forms
    *   Newsletter subscription
*   **Authentication (for accessing other sections):**
    *   Login
    *   Forgot Password
    *   Password Reset

**3.2. FLUO Web Dashboard**

The FLUO web dashboard will provide a user-friendly interface for interacting with FLUO's Real-time Behavioral Assurance System for OpenTelemetry data. This section will heavily rely on the existing FLUO API documented at `./openapi-schema.json`.

*   **Signals Overview & Real-time Updates:**
    *   Display a real-time list of generated signals (OPEN, INVESTIGATING, RESOLVED, FALSE\_POSITIVE).
    *   Filter and search signals by service, severity (ERROR, WARNING, INFO), time range, and rule ID.
    *   Provide live updates of signal status changes, leveraging FLUO's WebSocket capabilities.
*   **Signal Investigation:**
    *   Detailed view for each signal, showing associated metadata, trace/span context, and investigation tools.
    *   Ability to update signal status (e.g., INVESTIGATING, RESOLVED, FALSE\_POSITIVE).
    *   Add notes or link signals to external incidents/issues.
*   **Rule Management:**
    *   **Rule Stacks:** View and manage groups of rule versions by ID.
    *   **Rule Versioning:** Create, edit, activate, deactivate, and delete OGNL-based behavioral rules.
    *   Display rule definitions and their current active status.
    *   Ability to validate rule syntax before activation.
*   **OpenTelemetry Data Visualization (Basic):**
    *   While FLUO ingests OTLP, the BFF should provide basic visualization or aggregation of telemetry data relevant to current signals (e.g., showing contributing traces/spans). *Further exploration needed on how much raw OpenTelemetry data the BFF should handle vs. relying on FLUO's context for signals.*
*   **Health & Metrics Monitoring (FLUO Specific):**
    *   Access and display FLUO's `/q/health` and `/metrics` endpoints for the health and performance of the FLUO system itself.
    *   *Note: This is about monitoring FLUO's health, not the user's services.*

**3.3. Account/Billing Site**

The account/billing site will allow tenants to manage their FLUO subscriptions, billing information, and user accounts.

*   **Tenant Management:**
    *   View and update tenant profile information.
    *   Manage team members (invite, remove, assign roles within the FLUO application context).
    *   View audit logs for tenant actions.
    *   *Note: FLUO itself has multi-tenant architecture, the BFF will ensure tenant isolation when making calls to FLUO.*
*   **Subscription Management:**
    *   View current subscription plan.
    *   Upgrade/Downgrade subscription.
    *   Manage payment methods.
    *   View billing history and download invoices.
*   **User Profile Management:**
    *   Update user personal details (name, email).
    *   Change password.
    *   Manage two-factor authentication (2FA) settings.

**4. Technical Requirements**

**4.1. Architecture**

*   **Backend For Frontend (BFF):** The core of the project will be a BFF acting as an intermediary between the frontend and various backend services (including FLUO).
*   **Tanstack:** The BFF will be built using the Tanstack ecosystem (e.g., Tanstack Query for data fetching, Tanstack Router for routing).
*   **Monorepo Structure:** The BFF will likely reside within a monorepo alongside the frontend and other related services.

**4.2. API Design**

*   **RESTful APIs:** Adhere to RESTful principles for clear and consistent API design.
*   **JSON Payloads:** All API requests and responses will use JSON.
*   **Versioning:** Implement API versioning to allow for future changes without breaking existing clients.
*   **Documentation:** Comprehensive API documentation (e.g., OpenAPI/Swagger) will be maintained.

**4.3. Security**

*   **Authentication:**
    *   Implement robust user authentication (e.g., JWT-based).
    *   Support for OIDC/SAML integration via WorkOS, as FLUO uses it for enterprise authentication. The BFF should proxy and manage this authentication flow.
    *   Secure password hashing and storage.
*   **Authorization:**
    *   Implement role-based access control (RBAC) for different levels of access to resources across the FLUO application.
    *   Ensure proper authorization is propagated to FLUO's multi-tenant architecture to maintain data isolation.
*   **Data Encryption:**
    *   Encrypt sensitive data in transit (HTTPS/TLS) and at rest (database encryption for BFF-specific data).
*   **Input Validation:**
    *   Strict input validation on all API endpoints to prevent common vulnerabilities (e.g., XSS, SQL injection).
*   **Rate Limiting:**
    *   Implement rate limiting to prevent abuse and denial-of-service attacks.
*   **Cross-Site Request Forgery (CSRF) Protection:**
    *   Implement CSRF protection for all state-changing operations.
*   **Security Audits:**
    *   Regular security audits and penetration testing.

**4.4. Reliability & Performance**

*   **Error Handling:**
    *   Consistent and informative error messages with appropriate HTTP status codes.
    *   Robust logging and monitoring of errors.
*   **Caching:**
    *   Implement caching strategies (e.g., server-side caching, client-side caching with Tanstack Query) to improve performance, especially for frequently accessed but less dynamic FLUO rule data.
*   **Load Balancing:**
    *   Design for deployment behind a load balancer to distribute traffic.
*   **Scalability:**
    *   Stateless BFF architecture for horizontal scaling.
    *   Asynchronous processing where appropriate.
*   **Observability:**
    *   Implement comprehensive logging, metrics, and tracing for monitoring and debugging the BFF.
    *   Integration with a logging aggregation system (e.g., ELK stack).
    *   Integration with a metrics system (e.g., Prometheus, Grafana).
    *   Leverage FLUO's Prometheus metrics and OpenTelemetry tracing for monitoring FLUO itself.

**4.5. Integration with FLUO Backend**

*   **API Consumption:** The BFF will consume the FLUO API as documented at `./openapi-schema.json` (specifically `/api/v1/rules`, `/signals` and potentially WebSockets).
*   **Data Transformation:** The BFF will be responsible for transforming data from the FLUO API into a format suitable for the FLUO frontend. This includes potentially enriching signal data with additional context relevant to the overall FLUO application.
*   **WebSocket Proxying:** The BFF will need to efficiently proxy or integrate with FLUO's WebSocket endpoints for real-time signal updates to the frontend.
*   **Tenant Context:** The BFF must correctly pass tenant context to FLUO's multi-tenant architecture, ensuring that each FLUO tenant only accesses their own FLUO data.
*   **Error Handling:** Proper handling of errors and failures from the FLUO API, with graceful degradation where possible.

**4.6. Frontend Development (using shadcn components)**

*   **Component Library:** All frontend components will be built using shadcn components to ensure consistency and speed of development.
*   **Accessibility:** All UI components will adhere to WCAG accessibility guidelines.
*   **Responsiveness:** The UI will be responsive and adapt to various screen sizes.
*   **Theming:** Support for theming and customization, aligned with FLUO branding.

**5. Non-Functional Requirements**

*   **Usability:** The user interface should be intuitive and easy to navigate for all user types, especially operations teams managing signals.
*   **Maintainability:** The codebase should be well-structured, documented, and easy to maintain.
*   **Testability:** All components and APIs should be easily testable with unit, integration, and end-to-end tests.
*   **Deployment:** Automated deployment pipelines (CI/CD) will be implemented, designed for Kubernetes as FLUO is Cloud Native.
*   **Documentation:** Comprehensive documentation for all aspects of the BFF (code, APIs, deployment).

**6. Future Considerations (Out of Scope for Initial Release)**

*   **Advanced Analytics/Reporting:** More complex data visualization and historical reporting beyond real-time signal displays.
*   **Integration with Alerting Systems:** Direct integration with external alerting systems (e.g., PagerDuty, Slack) based on FLUO signals (currently FLUO generates signals, integration with *external* systems is for later).
*   **Programmatic Rule Creation:** Advanced tools for programmatic or templated rule creation.
*   **FLUO Configuration Management:** Deeper configuration management of FLUO beyond rules (e.g., OTLP ingestion settings).

**7. Open Questions**

*   What are the specific requirements for how FLUO's OIDC/SAML integration via WorkOS should be managed and proxied by the BFF?
*   What is the desired level of OpenTelemetry raw data visualization within the FLUO dashboard vs. relying on FLUO's derived signal context?
*   What are the expected peak load requirements for the BFF, considering FLUO's real-time nature?
*   What logging, metrics, and tracing tools are currently in use or preferred for FLUO's broader ecosystem?
*   What is the desired theme and branding guidelines for the frontend, specifically for the shadcn components?

**8. Milestones (High-Level, TBD with Development Team)**

*   **Phase 1: Foundation & Marketing Site:**
    *   BFF setup and basic API endpoints.
    *   Implementation of core security features (authentication, authorization, WorkOS proxying).
    *   Development of marketing site pages.
*   **Phase 2: FLUO Dashboard Integration - Signals & Investigation:**
    *   Integration with FLUO Signals Interface (`/signals`) via REST and WebSockets.
    *   Development of real-time signal list and detailed signal views.
    *   Ability to update signal status and add notes.
*   **Phase 3: FLUO Dashboard Integration - Rule Management:**
    *   Integration with FLUO Rules API (`/api/v1/rules`).
    *   Development of UI for viewing, creating, editing, activating, and deactivating rules and rule stacks.
*   **Phase 4: Account & Billing:**
    *   Implementation of tenant and subscription management.
    *   Integration with billing provider.
*   **Phase 5: Optimization & Polish:**
    *   Performance tuning and scalability improvements for both BFF and FLUO interactions.
    *   Comprehensive testing and bug fixing.
    *   Final documentation.

**9. Dependencies**

*   **FLUO Backend API:** Stable, performant, and well-documented FLUO API, including WebSocket endpoints.
*   **WorkOS Integration:** Clear understanding and configuration of WorkOS for OIDC/SAML authentication.
*   **Frontend Team:** Collaboration with the frontend team for API consumption and UI implementation.
*   **DevOps Team:** Support for infrastructure, deployment (Kubernetes focus), and monitoring.
*   **Design Team:** UI/UX designs for the marketing, dashboard, and account sites, specifically guiding shadcn component usage and theming.

**10. Success Metrics**

*   **API Uptime:** 99.9% availability for all BFF API endpoints.
*   **Response Times:** Average API response time under X ms (TBD), especially for FLUO-related data fetching.
*   **Security Audits:** No critical or high-severity vulnerabilities found in security audits.
*   **User Satisfaction:** Positive user feedback on performance, reliability, and usability of the FLUO dashboard and account features.
*   **Development Velocity:** Efficient development process facilitated by shadcn components.
