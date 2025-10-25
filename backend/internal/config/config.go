package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all application configuration
type Config struct {
	HTTP    HTTPConfig    `mapstructure:"http"`
	GRPC    GRPCConfig    `mapstructure:"grpc"`
	Storage StorageConfig `mapstructure:"storage"`
	Limits  LimitsConfig  `mapstructure:"limits"`
}

// HTTPConfig contains HTTP server settings
// Respects Go stdlib net/http defaults where appropriate
type HTTPConfig struct {
	Port              int `mapstructure:"port"`
	ReadTimeout       int `mapstructure:"read_timeout"`        // seconds, default 30
	WriteTimeout      int `mapstructure:"write_timeout"`       // seconds, default 30
	IdleTimeout       int `mapstructure:"idle_timeout"`        // seconds, default 120
	MaxHeaderBytes    int `mapstructure:"max_header_bytes"`    // bytes, stdlib default 1MB
	MaxBodyBytes      int `mapstructure:"max_body_bytes"`      // bytes, NO stdlib default!
	ShutdownTimeout   int `mapstructure:"shutdown_timeout"`    // seconds, default 10
}

// GRPCConfig contains gRPC server settings
// Configures vendor limits explicitly (gRPC has dangerous unlimited defaults)
type GRPCConfig struct {
	Port                 int `mapstructure:"port"`
	MaxRecvMsgSize       int `mapstructure:"max_recv_msg_size"`        // bytes, gRPC default 4MB
	MaxSendMsgSize       int `mapstructure:"max_send_msg_size"`        // bytes, gRPC default unlimited!
	MaxConcurrentStreams int `mapstructure:"max_concurrent_streams"`   // gRPC default unlimited!
	ConnectionTimeout    int `mapstructure:"connection_timeout"`       // seconds, gRPC default none!
	KeepaliveTime        int `mapstructure:"keepalive_time"`           // seconds, default 120
	KeepaliveTimeout     int `mapstructure:"keepalive_timeout"`        // seconds, default 20
}

// StorageConfig contains storage limits
type StorageConfig struct {
	MaxViolations int `mapstructure:"max_violations"` // Maximum violations in memory
	MaxRules      int `mapstructure:"max_rules"`      // Maximum rules (enforced by engine)
}

// LimitsConfig contains application-level limits
// These are enforced BEFORE data reaches vendors (defense in depth)
type LimitsConfig struct {
	Spans SpanLimits `mapstructure:"spans"`
	Rules RuleLimits `mapstructure:"rules"`
	Trace TraceLimits `mapstructure:"trace"`
}

// SpanLimits for span ingestion
type SpanLimits struct {
	MaxBatchSize            int `mapstructure:"max_batch_size"`              // Spans per batch request
	MaxAttributesPerSpan    int `mapstructure:"max_attributes_per_span"`     // Attributes per span
	MaxAttributeKeyLength   int `mapstructure:"max_attribute_key_length"`    // Bytes
	MaxAttributeValueLength int `mapstructure:"max_attribute_value_length"`  // Bytes
}

// RuleLimits for rule management
type RuleLimits struct {
	MaxExpressionLength  int `mapstructure:"max_expression_length"`   // Bytes (Participle has no limit!)
	MaxDescriptionLength int `mapstructure:"max_description_length"`  // Bytes
	MaxNameLength        int `mapstructure:"max_name_length"`         // Bytes
	MaxRulesPerImport    int `mapstructure:"max_rules_per_import"`    // Rules per YAML import
}

// TraceLimits for trace evaluation
type TraceLimits struct {
	MaxSpansPerTrace   int `mapstructure:"max_spans_per_trace"`    // For evaluation context
	EvaluationTimeout  int `mapstructure:"evaluation_timeout"`     // Milliseconds
}

// Load reads configuration from file and environment variables
// Priority: env vars > config file > defaults
func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Set defaults (respecting vendor defaults where safe)
	setDefaults(v)

	// Read config file if provided
	if configPath != "" {
		v.SetConfigFile(configPath)
		if err := v.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	// Environment variables override everything
	// BETRACE_HTTP_PORT, BETRACE_GRPC_MAX_RECV_MSG_SIZE, etc.
	v.SetEnvPrefix("BETRACE")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

// setDefaults configures default values
// Explicit about vendor defaults vs. our additions
func setDefaults(v *viper.Viper) {
	// HTTP defaults (respecting Go stdlib where it has them)
	v.SetDefault("http.port", 12011)
	v.SetDefault("http.read_timeout", 30)        // stdlib has no default
	v.SetDefault("http.write_timeout", 30)       // stdlib has no default
	v.SetDefault("http.idle_timeout", 120)       // stdlib has no default
	v.SetDefault("http.max_header_bytes", 32768) // Override stdlib 1MB default (too large)
	v.SetDefault("http.max_body_bytes", 10485760) // 10MB - stdlib has NO limit!
	v.SetDefault("http.shutdown_timeout", 10)

	// gRPC defaults (OVERRIDE dangerous unlimited defaults!)
	v.SetDefault("grpc.port", 12012)
	v.SetDefault("grpc.max_recv_msg_size", 4194304)      // 4MB - gRPC default, make explicit
	v.SetDefault("grpc.max_send_msg_size", 4194304)      // 4MB - gRPC default UNLIMITED, we limit!
	v.SetDefault("grpc.max_concurrent_streams", 1000)    // gRPC default UNLIMITED, we limit!
	v.SetDefault("grpc.connection_timeout", 120)         // gRPC default NONE, we add!
	v.SetDefault("grpc.keepalive_time", 120)
	v.SetDefault("grpc.keepalive_timeout", 20)

	// Storage limits
	v.SetDefault("storage.max_violations", 1000000) // 1M violations (~500MB)
	v.SetDefault("storage.max_rules", 100000)       // 100K rules (~90MB) - also enforced by engine

	// Span limits (no vendor limits - pure application layer)
	v.SetDefault("limits.spans.max_batch_size", 1000)
	v.SetDefault("limits.spans.max_attributes_per_span", 128)
	v.SetDefault("limits.spans.max_attribute_key_length", 256)
	v.SetDefault("limits.spans.max_attribute_value_length", 4096)

	// Rule limits (Participle parser has NO limits - we enforce)
	v.SetDefault("limits.rules.max_expression_length", 65536)   // 64KB
	v.SetDefault("limits.rules.max_description_length", 4096)   // 4KB
	v.SetDefault("limits.rules.max_name_length", 256)
	v.SetDefault("limits.rules.max_rules_per_import", 1000)

	// Trace evaluation limits
	v.SetDefault("limits.trace.max_spans_per_trace", 10000)
	v.SetDefault("limits.trace.evaluation_timeout", 5000) // 5 seconds
}
