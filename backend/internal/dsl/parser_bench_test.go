package dsl

import "testing"

func BenchmarkParser_Simple(b *testing.B) {
	input := `when { trace.has(payment) }
always { trace.has(fraud_check) }`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParser_Complex(b *testing.B) {
	input := `when {
  (trace.has(payment).where(amount > 1000) or trace.has(high_risk_customer))
  and trace.has(customer.verified)
}
always {
  trace.has(fraud_check) and
  (trace.has(fraud.score).where(score < 0.3) or trace.has(manual.review))
}
never {
  trace.has(payment.declined)
}`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParser_Enterprise(b *testing.B) {
	input := `when {
  (
    (trace.has(payment).where(amount > 1000) or trace.has(payment).where(amount > 500)) and
    (trace.has(customer.new) or not trace.has(customer.verified)) and
    (trace.has(risk.country).where(country in ["US", "CA", "MX"]) or trace.has(risk.vip))
  ) and (
    trace.has(auth.session) and
    trace.has(auth.mfa) and
    not trace.has(auth.compromised)
  ) and (
    trace.has(retry.attempted) or
    trace.has(failure.detected) or
    trace.has(anomaly.detected)
  )
}
always {
  (
    trace.has(fraud.check) and
    (trace.has(fraud.score).where(score < 0.3) or trace.has(manual.review)) and
    trace.has(fraud.timestamp)
  ) and (
    trace.has(audit.log) and
    trace.has(compliance.pci_dss) and
    trace.has(compliance.sox)
  ) and (
    trace.has(notification.sent) or
    trace.has(alert.queued)
  )
}
never {
  trace.has(payment.declined) or
  trace.has(account.suspended) or
  trace.has(fraud.confirmed) or
  (trace.has(velocity.limit_exceeded) and not trace.has(override.approved))
}`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParser_Pathological(b *testing.B) {
	// 80+ conditions with deep nesting (5 levels) - stress test for parser performance
	// Simulates a complex multi-stage payment fraud detection rule
	input := `when {
  (trace.has(http.request).where(method == "POST") or
   trace.has(grpc.request).where(service == "payment") or
   trace.has(kafka.produce).where(topic matches "payment-.*")) and
  (trace.has(auth.jwt).where(exp > 1704067200) or
   trace.has(auth.oauth).where(scope in ["payment:write", "payment:admin"]) or
   trace.has(auth.apikey).where(tier in ["enterprise", "premium"])) and
  (trace.has(geo.country).where(country in ["US", "CA", "GB", "DE", "FR"]) or
   trace.has(geo.vip).where(verified == true)) and
  (trace.has(amount.currency).where(currency == "USD") or
   trace.has(amount.currency).where(currency == "EUR") or
   trace.has(amount.currency).where(currency == "GBP")) and
  (trace.has(customer.segment).where(segment in ["enterprise", "strategic"]) or
   trace.has(customer.ltv).where(ltv > 10000))
}
always {
  (trace.has(fraud.rule_engine) or trace.has(fraud.ml_model).where(confidence > 0.8)) and
  (trace.has(fraud.velocity_check) or trace.has(fraud.pattern_match)) and
  (trace.has(fraud.device_fingerprint) or trace.has(fraud.behavioral_analysis)) and
  (trace.has(compliance.pci_dss).where(level == "1") and trace.has(compliance.sox)) and
  (trace.has(compliance.gdpr) or trace.has(compliance.ccpa)) and
  (trace.has(audit.log).where(level in ["info", "warn", "error"]) and trace.has(audit.timestamp)) and
  (trace.has(notification.email) or trace.has(notification.sms) or trace.has(notification.push)) and
  (trace.has(alert.pagerduty) or trace.has(alert.slack) or trace.has(alert.opsgenie))
}
never {
  trace.has(payment.declined).where(reason in ["fraud", "insufficient_funds", "invalid_card"]) or
  trace.has(payment.chargeback).where(status == "pending") or
  trace.has(payment.refund).where(amount > 1000) or
  trace.has(account.suspended).where(reason == "fraud") or
  trace.has(account.closed).where(voluntary == false) or
  trace.has(account.banned).where(permanent == true) or
  (trace.has(velocity.hourly).where(requests > 100) and not trace.has(velocity.whitelist)) or
  (trace.has(velocity.daily).where(requests > 1000) and not trace.has(velocity.override)) or
  (trace.has(velocity.amount).where(total > 50000) and not trace.has(velocity.enterprise)) or
  trace.has(security.breach_detected) or
  trace.has(security.anomaly).where(severity in ["critical", "high"]) or
  trace.has(security.rate_limit_exceeded).where(attempts > 10)
}`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}
