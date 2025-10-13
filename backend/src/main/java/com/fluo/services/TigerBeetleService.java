package com.fluo.services;

import com.fluo.model.Signal;
import io.quarkus.logging.Log;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

/**
 * TigerBeetle Event Ledger Service (PRD-002a) - STUB IMPLEMENTATION.
 *
 * <p><b>⚠️ IMPORTANT:</b> This is a STUB implementation using in-memory storage.
 * The actual TigerBeetle integration requires API corrections based on
 * tigerbeetle-java 0.15.3 client library.</p>
 *
 * <p>Provides persistent storage for signals and rules using TigerBeetle's
 * immutable ledger semantics:</p>
 * <ul>
 *   <li><b>Rules:</b> Stored as TigerBeetle Accounts with metadata on filesystem</li>
 *   <li><b>Signals:</b> Stored as immutable TigerBeetle Transfers (WORM)</li>
 *   <li><b>Tenant Isolation:</b> Enforced via TigerBeetle ledgers</li>
 * </ul>
 *
 * <p><b>Schema Mapping (Future):</b></p>
 * <ul>
 *   <li>TigerBeetle Account → Rule (code=2)</li>
 *   <li>TigerBeetle Transfer → Signal (code=3, amount=1)</li>
 *   <li>Rule's debitsPosted → Signal count</li>
 * </ul>
 *
 * <p><b>ADR Compliance:</b></p>
 * <ul>
 *   <li>ADR-011: TigerBeetle is embedded (single binary, no external service)</li>
 *   <li>ADR-012: Tenant isolation via ledger IDs (cryptographically enforced)</li>
 *   <li>PRD-002a: WORM semantics for audit trail</li>
 * </ul>
 *
 * @see com.fluo.repository.SignalRepository
 * @see com.fluo.repository.RuleRepository
 */
@ApplicationScoped
public class TigerBeetleService {

    @ConfigProperty(name = "tigerbeetle.cluster-id", defaultValue = "0")
    int clusterId;

    @ConfigProperty(name = "tigerbeetle.addresses", defaultValue = "127.0.0.1:3000")
    String addresses;

    @ConfigProperty(name = "fluo.rules.storage-path", defaultValue = "./data-rules")
    String rulesStoragePath;

    // Stub: In-memory storage (will be replaced with TigerBeetle client)
    private final Map<UUID, Signal> signalStore = new ConcurrentHashMap<>();
    private final Map<UUID, Long> ruleSignalCounts = new ConcurrentHashMap<>();
    private final Map<UUID, RuleMetadata> ruleMetadataCache = new ConcurrentHashMap<>();

    @PostConstruct
    void initialize() {
        Log.warn("⚠️  TigerBeetle integration is STUB implementation - using in-memory storage");
        Log.warn("⚠️  Signals and rules will be lost on restart");
        Log.infof("TigerBeetle stub config: cluster=%d, addresses=%s, rules-path=%s",
            clusterId, addresses, rulesStoragePath);

        // Load rule metadata from filesystem if exists
        loadRuleMetadataCache();
    }

    @PreDestroy
    void shutdown() {
        Log.info("TigerBeetle stub shutdown - discarding in-memory data");
    }

    /**
     * Create a new rule (stub: persists to filesystem only).
     */
    public void createRule(UUID ruleId, UUID tenantId, String expression, String drl,
                          Signal.SignalSeverity severity, boolean enabled) {
        // Write metadata to filesystem
        writeRuleMetadata(tenantId, ruleId, expression, drl);

        // Cache metadata
        ruleMetadataCache.put(ruleId, new RuleMetadata(expression, drl));

        // Initialize signal count
        ruleSignalCounts.put(ruleId, 0L);

        Log.infof("Created rule (stub): id=%s, tenant=%s, enabled=%b", ruleId, tenantId, enabled);
    }

    /**
     * Create a signal (stub: stores in memory).
     */
    public UUID createSignal(UUID tenantId, UUID ruleId, String traceId, String spanId,
                            Signal.SignalSeverity severity, Signal.SignalStatus status) {
        UUID signalId = UUID.randomUUID();

        Signal signal = new Signal(
            signalId.toString(),
            ruleId.toString(),
            "1", // Version
            spanId,
            traceId,
            Instant.now(),
            severity,
            null, // Message
            Map.of(), // Attributes
            "tigerbeetle-stub",
            tenantId.toString(),
            status
        );

        signalStore.put(signalId, signal);

        // Increment rule signal count
        ruleSignalCounts.merge(ruleId, 1L, Long::sum);

        Log.debugf("Created signal (stub): id=%s, rule=%s, tenant=%s", signalId, ruleId, tenantId);

        return signalId;
    }

    /**
     * Get signals for a tenant (stub: filters in-memory store).
     */
    public List<Signal> getSignalsByTenant(UUID tenantId, int limit) {
        return signalStore.values().stream()
            .filter(s -> s.tenantId().equals(tenantId.toString()))
            .limit(limit)
            .toList();
    }

    /**
     * Get rule signal count (stub: returns cached count).
     */
    public long getRuleSignalCount(UUID ruleId) {
        return ruleSignalCounts.getOrDefault(ruleId, 0L);
    }

    /**
     * Get rule metadata by ID (stub: from cache or filesystem).
     */
    public RuleMetadata getRuleMetadata(UUID ruleId) {
        RuleMetadata cached = ruleMetadataCache.get(ruleId);
        if (cached != null) {
            return cached;
        }

        // Try to load from filesystem
        return loadRuleMetadataFromFile(ruleId);
    }

    /**
     * Get all rules for a tenant (stub: filters cache).
     */
    public List<UUID> getRuleIdsByTenant(UUID tenantId) {
        // Stub: Can't determine tenant from filesystem structure efficiently
        // Return all rule IDs
        return new ArrayList<>(ruleMetadataCache.keySet());
    }

    // ==================== Helper Methods ====================

    /**
     * Load rule metadata cache from filesystem.
     */
    private void loadRuleMetadataCache() {
        Path rulesBase = Path.of(rulesStoragePath);
        if (!Files.exists(rulesBase)) {
            try {
                Files.createDirectories(rulesBase);
                Log.info("Created rules storage directory: " + rulesStoragePath);
            } catch (IOException e) {
                Log.warn("Failed to create rules storage directory", e);
            }
            return;
        }

        try (Stream<Path> paths = Files.walk(rulesBase, 2)) {
            paths.filter(p -> p.toString().endsWith(".json"))
                .forEach(ruleFile -> {
                    try {
                        String fileName = ruleFile.getFileName().toString();
                        UUID ruleId = UUID.fromString(fileName.replace(".json", ""));
                        String json = Files.readString(ruleFile);
                        ruleMetadataCache.put(ruleId, parseRuleMetadata(json));
                        Log.debugf("Loaded rule metadata: %s", ruleId);
                    } catch (Exception e) {
                        Log.warnf("Failed to load rule metadata: %s - %s", ruleFile, e.getMessage());
                    }
                });

            Log.infof("Loaded %d rule metadata entries into cache", ruleMetadataCache.size());
        } catch (IOException e) {
            Log.error("Failed to walk rules storage directory", e);
        }
    }

    /**
     * Write rule metadata to filesystem.
     */
    private void writeRuleMetadata(UUID tenantId, UUID ruleId, String expression, String drl) {
        try {
            Path ruleDir = Path.of(rulesStoragePath, tenantId.toString());
            Files.createDirectories(ruleDir);

            Path ruleFile = ruleDir.resolve(ruleId + ".json");
            String json = String.format(
                "{\"expression\":\"%s\",\"drl\":\"%s\"}",
                escapeJson(expression),
                escapeJson(drl)
            );
            Files.writeString(ruleFile, json);

            Log.debugf("Wrote rule metadata: %s", ruleFile);
        } catch (IOException e) {
            throw new TigerBeetleException("Failed to write rule metadata", e);
        }
    }

    /**
     * Load rule metadata from filesystem.
     */
    private RuleMetadata loadRuleMetadataFromFile(UUID ruleId) {
        Path rulesBase = Path.of(rulesStoragePath);

        try (Stream<Path> paths = Files.walk(rulesBase, 2)) {
            return paths
                .filter(p -> p.getFileName().toString().equals(ruleId + ".json"))
                .findFirst()
                .map(ruleFile -> {
                    try {
                        String json = Files.readString(ruleFile);
                        return parseRuleMetadata(json);
                    } catch (IOException e) {
                        throw new TigerBeetleException("Failed to read rule metadata", e);
                    }
                })
                .orElseThrow(() -> new TigerBeetleException("Rule metadata not found: " + ruleId));
        } catch (IOException e) {
            throw new TigerBeetleException("Failed to search for rule metadata", e);
        }
    }

    /**
     * Simple JSON parser for rule metadata.
     */
    private RuleMetadata parseRuleMetadata(String json) {
        // Simple extraction (production would use Jackson)
        String expression = json.substring(json.indexOf("\"expression\":\"") + 14);
        expression = expression.substring(0, expression.indexOf("\""));

        String drl = json.substring(json.indexOf("\"drl\":\"") + 7);
        drl = drl.substring(0, drl.lastIndexOf("\""));

        return new RuleMetadata(unescapeJson(expression), unescapeJson(drl));
    }

    /**
     * Simple JSON escape.
     */
    private String escapeJson(String str) {
        return str.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    /**
     * Simple JSON unescape.
     */
    private String unescapeJson(String str) {
        return str.replace("\\\"", "\"")
            .replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\t", "\t")
            .replace("\\\\", "\\");
    }

    /**
     * Rule metadata record (expression + compiled DRL).
     */
    public record RuleMetadata(String expression, String drl) {}

    /**
     * TigerBeetle-specific exception.
     */
    public static class TigerBeetleException extends RuntimeException {
        public TigerBeetleException(String message) {
            super(message);
        }

        public TigerBeetleException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
