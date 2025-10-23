# PRD-016c: Report Scheduling & Automation

**Status:** Draft
**Priority:** P1
**Dependencies:** PRD-016a (Evidence API), PRD-016b (Report Generation)
**Relates To:** None

## Problem Statement

Compliance officers need recurring reports (weekly, monthly, quarterly) for continuous monitoring. Manual generation is:
- Time-consuming and error-prone
- Inconsistent (ad-hoc)
- Reactive (issues discovered late)

## Solution

Report scheduling system that:
- Configures recurring reports (cron expressions)
- Automatically generates via PRD-016b
- Delivers via email and webhooks
- Handles failures with retries
- Provides self-service UI

### Scheduler Implementation

```java
@ApplicationScoped
public class ReportScheduler {

    @Inject ReportGenerationService reportService;
    @Inject EmailService emailService;
    @Inject WebhookClient webhookClient;

    @Scheduled(every = "1m")
    public void checkScheduledReports() {
        List<ScheduledReport> due = findDueReports(Instant.now());

        for (ScheduledReport scheduled : due) {
            try {
                // Generate report via PRD-016b
                ReportGenerationResponse report = reportService.generateReport(
                    scheduled.toReportRequest()
                );

                // Email delivery
                emailService.sendReport(scheduled.getEmailRecipients(), report);

                // Webhook notification
                if (scheduled.getWebhookUrl() != null) {
                    webhookClient.notify(scheduled.getWebhookUrl(), report);
                }

                updateSchedule(scheduled, "SUCCESS");

            } catch (Exception e) {
                updateSchedule(scheduled, "FAILED", e.getMessage());
                notifyFailure(scheduled, e);
            }
        }
    }
}
```

### Scheduled Report Model

```java
@Entity
public class ScheduledReport {
    UUID id;
    String tenantId;
    String name;
    ReportTemplate template;
    Framework framework;
    List<String> controls;
    ReportFormat format;
    String cronExpression;        // "0 0 9 * * MON"
    List<String> emailRecipients;
    String webhookUrl;
    boolean enabled;
    Instant lastRunAt;
    Instant nextRunAt;
    String lastRunStatus;
}
```

## Acceptance Criteria

- **AC1**: Cron "0 0 9 * * MON" triggers Monday 9am UTC
- **AC2**: Email includes PDF attachment and download link
- **AC3**: Webhook receives JSON payload
- **AC4**: Failed generation retries 3 times (2s, 4s, 8s backoff)
- **AC5**: Self-service UI for configuration
- **AC6**: Tenant isolation enforced
- **AC7**: Failures alert compliance team
- **AC8**: Last run status visible in UI

## Security Requirements

- **Authentication**: Only compliance_officer can create schedules
- **Tenant Isolation**: Cannot schedule for other tenants
- **Email Validation**: Must be within tenant's domain
- **Webhook Validation**: HTTPS only, no localhost
- **Audit Trail**: Log schedule changes and deliveries

## Performance Requirements

- Scheduler checks: Every 1 minute
- Email delivery: < 10 seconds
- Webhook timeout: 30 seconds
- Support: 100 schedules per tenant, 1000 total

## Test Requirements

- **Unit**: 10 tests (cron parsing, time ranges, retry logic)
- **Integration**: 8 tests (schedule → generate → deliver)
- **Reliability**: 5 tests (retry, failure handling, circuit breaker)

## Dependencies

- PRD-016a Evidence API
- PRD-016b Report Generation
- Quarkus Scheduler
- JavaMail API
- Jersey REST Client (webhooks)
