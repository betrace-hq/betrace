package com.fluo.kms;

import com.fluo.kms.adapters.*;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Optional;

/**
 * Factory: Creates appropriate KMS adapter based on configuration.
 *
 * Supports pluggable KMS providers via ports-and-adapters architecture:
 * - "local" → LocalKmsAdapter (development only, in-memory)
 * - "aws" → AwsKmsAdapter (AWS KMS with CloudHSM)
 * - "vault" → VaultKmsAdapter (HashiCorp Vault Transit)
 * - "gcp" → GcpKmsAdapter (Google Cloud KMS)
 * - "azure" → AzureKmsAdapter (Azure Key Vault)
 *
 * Configuration:
 * ```properties
 * # Select KMS provider
 * fluo.kms.provider=${KMS_PROVIDER:local}
 *
 * # Provider-specific configuration
 * # AWS KMS:
 * aws.kms.region=us-east-1
 * aws.kms.master-key-id=arn:aws:kms:...
 * aws.kms.endpoint=  # Optional: LocalStack
 *
 * # Vault:
 * vault.addr=http://localhost:8200
 * vault.token=...
 * vault.transit.key-name=fluo-master-key
 *
 * # GCP KMS:
 * gcp.kms.project-id=my-project
 * gcp.kms.location=us-east1
 * gcp.kms.keyring=fluo-keyring
 * gcp.kms.key-name=fluo-master-key
 *
 * # Azure Key Vault:
 * azure.keyvault.uri=https://myvault.vault.azure.net
 * azure.keyvault.key-name=fluo-master-key
 * ```
 *
 * Usage:
 * ```java
 * @Inject
 * KeyManagementService kms;  // CDI injects correct provider
 *
 * Map<String, String> context = Map.of("tenant_id", tenantId);
 * byte[] encrypted = kms.encrypt(plaintext, context);
 * ```
 *
 * ADR Compliance:
 * - ADR-011 (Pure Application): Deployment-agnostic, no vendor lock-in
 * - Ports-and-Adapters: Clean separation between domain and infrastructure
 */
@ApplicationScoped
public class KmsAdapterFactory {

    private final String provider;
    private final String awsMasterKeyId;
    private final String awsRegion;
    private final Optional<String> awsEndpoint;

    public KmsAdapterFactory(
            @ConfigProperty(name = "fluo.kms.provider", defaultValue = "local") String provider,
            @ConfigProperty(name = "aws.kms.master-key-id", defaultValue = "") String awsMasterKeyId,
            @ConfigProperty(name = "aws.kms.region", defaultValue = "us-east-1") String awsRegion,
            @ConfigProperty(name = "aws.kms.endpoint") Optional<String> awsEndpoint) {

        this.provider = provider.toLowerCase();
        this.awsMasterKeyId = awsMasterKeyId;
        this.awsRegion = awsRegion;
        this.awsEndpoint = awsEndpoint;
    }

    /**
     * Produces KeyManagementService implementation based on configuration.
     *
     * @return KMS adapter for configured provider
     * @throws IllegalArgumentException if provider unknown or misconfigured
     */
    @Produces
    @ApplicationScoped
    public KeyManagementService createKmsAdapter() {
        Log.infof("Initializing KMS provider: %s", provider);

        return switch (provider) {
            case "local" -> {
                Log.warnf("⚠️  Using LocalKmsAdapter - NOT FOR PRODUCTION USE");
                yield new LocalKmsAdapter();
            }

            case "aws" -> {
                if (awsMasterKeyId.isBlank()) {
                    throw new IllegalArgumentException(
                        "AWS KMS requires 'aws.kms.master-key-id' configuration"
                    );
                }
                Log.infof("Using AWS KMS - region: %s, key: %s", awsRegion, awsMasterKeyId);
                yield new AwsKmsAdapter(awsMasterKeyId, awsRegion, awsEndpoint);
            }

            case "vault" -> {
                Log.warnf("⚠️  VaultKmsAdapter not yet implemented - falling back to LocalKmsAdapter");
                Log.warnf("⚠️  See VaultKmsAdapter.java javadoc for implementation guide");
                yield new LocalKmsAdapter();
                // TODO: yield new VaultKmsAdapter(...);
            }

            case "gcp" -> {
                Log.warnf("⚠️  GcpKmsAdapter not yet implemented - falling back to LocalKmsAdapter");
                Log.warnf("⚠️  See GcpKmsAdapter.java javadoc for implementation guide");
                yield new LocalKmsAdapter();
                // TODO: yield new GcpKmsAdapter(...);
            }

            case "azure" -> {
                Log.warnf("⚠️  AzureKmsAdapter not yet implemented - falling back to LocalKmsAdapter");
                Log.warnf("⚠️  See AzureKmsAdapter.java javadoc for implementation guide");
                yield new LocalKmsAdapter();
                // TODO: yield new AzureKmsAdapter(...);
            }

            default -> throw new IllegalArgumentException(
                String.format(
                    "Unknown KMS provider: '%s'. Supported: local, aws, vault, gcp, azure",
                    provider
                )
            );
        };
    }
}
