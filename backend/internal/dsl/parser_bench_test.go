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

func BenchmarkParser_Ridiculous(b *testing.B) {
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
