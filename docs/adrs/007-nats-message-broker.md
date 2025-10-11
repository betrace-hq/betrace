# ADR-007: NATS as Message Broker Architecture

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

FLUO requires a message broker to handle communication between services and support asynchronous job processing:

1. **Inter-service Communication**: BFF ↔ Backend, Backend ↔ Workers
2. **Job Queuing**: Reliable task distribution to worker pods
3. **Real-time Events**: Signal status updates and system notifications
4. **Stream Processing**: Persistent event streams for audit and replay
5. **Scalability**: Handle high message throughput with low latency
6. **Resilience**: Message persistence and delivery guarantees
7. **Cloud Native**: Kubernetes-native deployment and management

### Problem Statement

Traditional messaging solutions have limitations:
- **Database Polling**: Inefficient, high latency, doesn't scale
- **HTTP-only Communication**: No persistence, delivery guarantees, or pub/sub
- **Heavy Message Brokers**: Complex setup, resource overhead (Kafka, RabbitMQ)
- **Cloud Vendor Lock-in**: Tied to specific cloud provider services
- **Operational Complexity**: Difficult cluster management and monitoring

## Decision

We will use **NATS with JetStream** as the primary message broker for all inter-service communication and job queuing in FLUO.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    NATS Cluster                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │    NATS     │    NATS     │    NATS     │  JetStream  │  │
│  │   Server    │   Server    │   Server    │   Storage   │  │
│  │      1      │      2      │      3      │             │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
    │  BFF   │   │Backend │   │Workers │
    │        │   │        │   │ (3x)   │
    │        │   │        │   │        │
    └────────┘   └────────┘   └────────┘
```

### Message Patterns

1. **Request-Reply**: Synchronous communication (BFF → Backend)
2. **Publish-Subscribe**: Event broadcasting (status updates)
3. **Work Queues**: Job distribution to workers with load balancing
4. **Streaming**: Persistent event streams with replay capability

## Implementation Details

### NATS Configuration

```yaml
# NATS Server Configuration
jetstream: {
  store_dir: "/data/jetstream"
  max_memory_store: 1GB
  max_file_store: 10GB
}

# Clustering for high availability
cluster: {
  name: "fluo-cluster"
  routes: [
    "nats://nats-1:6222"
    "nats://nats-2:6222"
    "nats://nats-3:6222"
  ]
}
```

### Stream Configuration

```typescript
// Job processing stream
const jobStream = await jsm.streams.add({
  name: 'JOBS',
  subjects: ['jobs.>'],
  retention: 'WorkQueue',
  max_age: 24 * 60 * 60 * 1000, // 24 hours
  storage: 'File',
  replicas: 3,
  discard: 'Old'
});

// Signal events stream
const signalStream = await jsm.streams.add({
  name: 'SIGNALS',
  subjects: ['signals.>'],
  retention: 'Interest',
  max_age: 7 * 24 * 60 * 60 * 1000, // 7 days
  storage: 'File',
  replicas: 3
});
```

### Subject Naming Convention

```
jobs.trace_analysis      # Job queue for trace analysis
jobs.rule_validation     # Job queue for rule validation
jobs.data_export         # Job queue for data export

signals.status.open      # Signal status changes
signals.status.resolved  # Signal resolutions
signals.created          # New signal creation

events.user.login        # User authentication events
events.system.startup    # System lifecycle events
```

### Producer Example (BFF)

```typescript
// Submit job for background processing
export class JobService {
  async submitTraceAnalysis(traceData: TraceData): Promise<string> {
    const jobId = generateId();

    await nc.publish('jobs.trace_analysis', JSON.stringify({
      id: jobId,
      type: 'trace_analysis',
      data: traceData,
      timestamp: Date.now(),
      priority: 1
    }));

    return jobId;
  }
}
```

### Consumer Example (Workers)

```typescript
// Worker consuming jobs from queue
export class TraceWorker {
  async start() {
    const consumer = await js.consumers.get('JOBS', 'trace-workers');

    await consumer.consume({
      callback: async (msg) => {
        try {
          const job = JSON.parse(msg.string());
          await this.processTraceAnalysis(job);
          msg.ack();
        } catch (error) {
          console.error('Job processing failed:', error);
          msg.nak(); // Requeue for retry
        }
      }
    });
  }
}
```

## Alternatives Considered

### 1. Apache Kafka
**Rejected**:
- **Operational Complexity**: Requires Zookeeper, complex cluster management
- **Resource Overhead**: High memory and disk requirements
- **Over-engineering**: Too complex for current message volume
- **Kubernetes Integration**: More complex to deploy and manage

### 2. RabbitMQ
**Rejected**:
- **Memory Usage**: High memory overhead for clustering
- **Management UI**: Additional operational surface area
- **Clustering Complexity**: Split-brain scenarios in Kubernetes
- **Performance**: Lower throughput compared to NATS

### 3. Redis Streams
**Rejected**:
- **Persistence**: Less robust durability guarantees
- **Clustering**: Complex Redis Cluster setup
- **Memory-focused**: Not optimized for persistent workloads
- **Limited Features**: Fewer messaging patterns supported

### 4. Cloud Provider Services (SQS, Service Bus, Pub/Sub)
**Rejected**:
- **Vendor Lock-in**: Tied to specific cloud provider
- **Network Latency**: External service adds latency
- **Cost**: Pay-per-message pricing at scale
- **Local Development**: Complex local testing setup

### 5. Database-based Queues
**Rejected**:
- **Performance**: Polling introduces latency and load
- **Scalability**: Database becomes bottleneck
- **Reliability**: No built-in retry or dead letter patterns
- **Operational**: Adds complexity to database operations

## Consequences

### Positive
- **High Performance**: Sub-millisecond latency, high throughput
- **Lightweight**: Minimal resource footprint compared to alternatives
- **Kubernetes Native**: Simple deployment with standard K8s resources
- **Persistence**: JetStream provides durable message storage
- **Clustering**: Built-in clustering with no external dependencies
- **Delivery Guarantees**: At-least-once and exactly-once delivery options
- **Stream Replay**: Ability to replay messages for debugging/recovery
- **Security**: TLS encryption and authentication built-in
- **Monitoring**: Comprehensive metrics and health endpoints

### Negative
- **Maturity**: JetStream is newer than alternatives (though stable)
- **Ecosystem**: Smaller ecosystem compared to Kafka/RabbitMQ
- **Learning Curve**: Team needs to learn NATS concepts and patterns
- **Tooling**: Fewer third-party management tools available

### Mitigation Strategies
- **Documentation**: Comprehensive NATS guides and examples
- **Monitoring**: Grafana dashboards for NATS metrics
- **Testing**: Thorough integration tests for message patterns
- **Fallback**: HTTP endpoints as backup communication method
- **Training**: Team workshops on NATS patterns and operations

## Implementation Status

- ✅ **NATS Deployment**: 3-node cluster in `fluo-queue` namespace
- ✅ **JetStream Setup**: Persistent storage with file backend
- ✅ **Stream Configuration**: Job and signal streams configured
- ✅ **BFF Integration**: Job submission and event publishing
- ✅ **Worker Integration**: Job consumption with retry logic
- ✅ **Monitoring**: Prometheus metrics and Grafana dashboards
- ✅ **Health Checks**: Readiness and liveness probes
- ⏳ **Backend Integration**: Core service NATS integration (planned)
- ⏳ **WebSocket Bridge**: Real-time events to frontend (planned)

## Operational Considerations

### Monitoring and Alerting

```yaml
# Prometheus alerts for NATS health
groups:
- name: nats
  rules:
  - alert: NATSServerDown
    expr: up{job="nats"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "NATS server is down"

  - alert: JetStreamConsumerLag
    expr: nats_jetstream_consumer_num_pending > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "JetStream consumer lag is high"
```

### Backup and Recovery

```bash
# Backup JetStream data
kubectl exec -it nats-0 -n fluo-queue -- \
  nats stream backup JOBS /backup/jobs-$(date +%Y%m%d).tar

# Restore JetStream data
kubectl exec -it nats-0 -n fluo-queue -- \
  nats stream restore JOBS /backup/jobs-20250921.tar
```

### Security Configuration

```yaml
# NATS authentication
authorization: {
  users: [
    {
      user: "fluo-bff"
      password: "$2a$11$..."
      permissions: {
        publish: ["jobs.>", "signals.>"]
        subscribe: ["signals.>", "_INBOX.>"]
      }
    }
    {
      user: "fluo-workers"
      password: "$2a$11$..."
      permissions: {
        publish: ["signals.>"]
        subscribe: ["jobs.>", "_INBOX.>"]
      }
    }
  ]
}
```

## Performance Characteristics

### Benchmarks
- **Latency**: < 1ms for core NATS, < 5ms for JetStream
- **Throughput**: > 10M messages/sec for core NATS
- **Memory**: ~50MB base + message storage
- **CPU**: Minimal overhead, scales with message rate

### Capacity Planning
```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 1Gi

# JetStream storage
volumeClaimTemplate:
  spec:
    resources:
      requests:
        storage: 10Gi
```

## Future Considerations

1. **Multi-tenancy**: Subject-based tenant isolation
2. **Geographic Distribution**: Leaf nodes for multi-region deployment
3. **Schema Registry**: Message schema validation and evolution
4. **Dead Letter Queues**: Failed message handling patterns
5. **Observability**: Distributed tracing for message flows
6. **Disaster Recovery**: Cross-region replication strategies

## References

- [NATS Component Implementation](../infra/components/nats/)
- [NATS Configuration Module](../infra/components/nats/lib/config.nix)
- [NATS Kubernetes Manifests](../infra/components/nats/lib/kubernetes.nix)
- [NATS Grafana Dashboard](../infra/k8s/manifests/grafana-nats-dashboard.yaml)
- [Worker NATS Integration](../infra/components/workers/)
- [ADR-004: Kubernetes-Native Infrastructure](./004-kubernetes-native-infrastructure.md)
- [ADR-005: Component-Based Infrastructure](./005-component-based-infrastructure.md)