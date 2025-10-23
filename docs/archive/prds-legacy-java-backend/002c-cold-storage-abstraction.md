# PRD-002c: Cold Storage Abstraction

**Priority:** P1 (Not Blocking MVP)
**Complexity:** Simple
**Personas:** All
**Dependencies:** None (standalone abstraction)
**Implementation Status:** ✅ READY - Clear interface, simple implementation

## Problem

BeTrace needs **long-term trace storage** beyond the 7-day hot retention, but:
- **Deployment Variance:** Different deployments need different backends (local filesystem, S3, MinIO, on-prem NFS)
- **No Abstraction:** Hardcoding S3 violates ADR-011 (Pure Application Framework)
- **Cost Optimization:** Hot storage (DuckDB) is expensive for long-term retention
- **Compliance Requirements:** Need to retain traces for 1-365 days for audit

**Impact:**
- ❌ Cannot provide long-term trace retention without violating ADR-011
- ❌ Deployment-specific logic mixed into application code
- ❌ Cannot test archival without real S3/MinIO
- ❌ High storage costs (DuckDB files keep growing)

**Current State:**
- No cold storage implementation
- DuckDB files grow indefinitely
- No archival pipeline

## Solution

### Technology Choice

**Interface-Based Abstraction** with default implementation:
- **ColdStorageService Interface:** Deployment-agnostic contract
- **Default Implementation:** Local filesystem (for dev/small deployments)
- **Consumer Implementations:** S3, MinIO, GCS, Azure Blob, NFS (external flake projects)

**Storage Format:** Parquet
- **Columnar:** Efficient compression (10x savings over JSON)
- **Query-Ready:** DuckDB can query Parquet directly
- **Standard:** All cloud providers support Parquet
- **Immutable:** Write-once, read-many (audit compliance)

**Out of Scope for this PRD:**
- ❌ Archival scheduling logic (see PRD-002d)
- ❌ Query federation (hot + cold) (see PRD-002d)
- ❌ Retention policies (see PRD-002d)

### Storage Interface

**`com/fluo/services/storage/ColdStorageService.java`:**
```java
/**
 * Cold storage abstraction for long-term trace retention.
 *
 * Implementations:
 * - FilesystemColdStorage (default, local dev)
 * - S3ColdStorage (external consumer implementation)
 * - MinIOColdStorage (external consumer implementation)
 * - GCSColdStorage (external consumer implementation)
 *
 * Per ADR-011: BeTrace provides interface only, deployments choose implementation.
 */
public interface ColdStorageService {

    /**
     * Store Parquet file for long-term retention.
     *
     * @param tenantId Tenant ID (for partitioning)
     * @param date Date of traces in this file (YYYY-MM-DD)
     * @param parquetFile Local Parquet file to upload
     * @return Storage URI (e.g., "s3://bucket/tenant-a/2025/01/15.parquet")
     * @throws IOException if upload fails
     */
    String storeParquet(UUID tenantId, LocalDate date, Path parquetFile) throws IOException;

    /**
     * Retrieve Parquet file from cold storage.
     *
     * @param storageUri URI returned by storeParquet()
     * @return Local path to downloaded Parquet file
     * @throws IOException if download fails or file doesn't exist
     */
    Path retrieveParquet(String storageUri) throws IOException;

    /**
     * Check if Parquet file exists in cold storage.
     *
     * @param tenantId Tenant ID
     * @param date Date of traces
     * @return true if file exists, false otherwise
     */
    boolean exists(UUID tenantId, LocalDate date);

    /**
     * List all archived dates for a tenant.
     *
     * @param tenantId Tenant ID
     * @return List of dates with archived traces (sorted descending)
     */
    List<LocalDate> listArchivedDates(UUID tenantId);

    /**
     * Delete archived file (for retention policy).
     *
     * @param storageUri URI returned by storeParquet()
     * @throws IOException if delete fails
     */
    void delete(String storageUri) throws IOException;

    /**
     * Get storage backend metadata (for observability).
     *
     * @return Metadata describing backend (type, region, bucket, etc.)
     */
    StorageMetadata getMetadata();
}

/**
 * Storage backend metadata.
 */
record StorageMetadata(
    String backendType,      // "filesystem", "s3", "minio", "gcs"
    String location,         // "/path/to/data", "s3://bucket", etc.
    Map<String, String> attributes  // Backend-specific metadata
) {}
```

### Default Implementation (Filesystem)

**`com/fluo/services/storage/FilesystemColdStorage.java`:**
```java
@ApplicationScoped
@DefaultBean
public class FilesystemColdStorage implements ColdStorageService {

    @ConfigProperty(name = "fluo.storage.cold.path", defaultValue = "./data-cold-storage")
    String coldStoragePath;

    private static final Logger log = LoggerFactory.getLogger(FilesystemColdStorage.class);

    @PostConstruct
    public void initialize() {
        try {
            Files.createDirectories(Path.of(coldStoragePath));
            log.info("Initialized filesystem cold storage: {}", coldStoragePath);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create cold storage directory", e);
        }
    }

    @Override
    public String storeParquet(UUID tenantId, LocalDate date, Path parquetFile) throws IOException {
        // Storage structure: {base}/{tenant-id}/{YYYY}/{MM}/{DD}.parquet
        Path tenantDir = Path.of(coldStoragePath, tenantId.toString(),
                                 String.format("%04d", date.getYear()),
                                 String.format("%02d", date.getMonthValue()));
        Files.createDirectories(tenantDir);

        Path destination = tenantDir.resolve(String.format("%02d.parquet", date.getDayOfMonth()));

        // Atomic move (rename) for safety
        Files.move(parquetFile, destination, StandardCopyOption.REPLACE_EXISTING);

        String uri = "file://" + destination.toAbsolutePath();
        log.info("Stored Parquet for tenant {} date {}: {}", tenantId, date, uri);

        return uri;
    }

    @Override
    public Path retrieveParquet(String storageUri) throws IOException {
        if (!storageUri.startsWith("file://")) {
            throw new IllegalArgumentException("Invalid filesystem URI: " + storageUri);
        }

        Path path = Path.of(URI.create(storageUri));

        if (!Files.exists(path)) {
            throw new FileNotFoundException("Parquet file not found: " + storageUri);
        }

        return path;
    }

    @Override
    public boolean exists(UUID tenantId, LocalDate date) {
        Path path = buildPath(tenantId, date);
        return Files.exists(path);
    }

    @Override
    public List<LocalDate> listArchivedDates(UUID tenantId) {
        Path tenantDir = Path.of(coldStoragePath, tenantId.toString());

        if (!Files.exists(tenantDir)) {
            return Collections.emptyList();
        }

        try (Stream<Path> paths = Files.walk(tenantDir, 3)) {
            return paths
                .filter(Files::isRegularFile)
                .filter(p -> p.toString().endsWith(".parquet"))
                .map(this::extractDateFromPath)
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());
        } catch (IOException e) {
            log.error("Failed to list archived dates for tenant {}", tenantId, e);
            return Collections.emptyList();
        }
    }

    @Override
    public void delete(String storageUri) throws IOException {
        Path path = Path.of(URI.create(storageUri));
        Files.deleteIfExists(path);
        log.info("Deleted archived Parquet: {}", storageUri);
    }

    @Override
    public StorageMetadata getMetadata() {
        return new StorageMetadata(
            "filesystem",
            coldStoragePath,
            Map.of(
                "writable", Files.isWritable(Path.of(coldStoragePath)) ? "true" : "false",
                "free_space_gb", String.valueOf(Path.of(coldStoragePath).toFile().getFreeSpace() / (1024 * 1024 * 1024))
            )
        );
    }

    private Path buildPath(UUID tenantId, LocalDate date) {
        return Path.of(coldStoragePath, tenantId.toString(),
                      String.format("%04d", date.getYear()),
                      String.format("%02d", date.getMonthValue()),
                      String.format("%02d.parquet", date.getDayOfMonth()));
    }

    private LocalDate extractDateFromPath(Path path) {
        // Extract date from path: .../2025/01/15.parquet
        Path parent = path.getParent();
        int month = Integer.parseInt(parent.getFileName().toString());
        int year = Integer.parseInt(parent.getParent().getFileName().toString());
        int day = Integer.parseInt(path.getFileName().toString().replace(".parquet", ""));

        return LocalDate.of(year, month, day);
    }
}
```

### Configuration

**`application.properties`:**
```properties
# Cold Storage (Filesystem default)
fluo.storage.cold.path=./data-cold-storage
fluo.storage.cold.retention-days=365
```

### Example Consumer Implementation (S3)

**External flake project: `fluo-s3-storage/S3ColdStorage.java`:**
```java
@ApplicationScoped
@Alternative
@Priority(1)  // Override default filesystem implementation
public class S3ColdStorage implements ColdStorageService {

    @ConfigProperty(name = "fluo.storage.s3.bucket")
    String bucket;

    @ConfigProperty(name = "fluo.storage.s3.region")
    String region;

    private S3Client s3Client;

    @PostConstruct
    public void initialize() {
        this.s3Client = S3Client.builder()
            .region(Region.of(region))
            .build();
    }

    @Override
    public String storeParquet(UUID tenantId, LocalDate date, Path parquetFile) throws IOException {
        String key = String.format("%s/%04d/%02d/%02d.parquet",
                                   tenantId,
                                   date.getYear(),
                                   date.getMonthValue(),
                                   date.getDayOfMonth());

        PutObjectRequest request = PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType("application/parquet")
            .build();

        s3Client.putObject(request, RequestBody.fromFile(parquetFile));

        return String.format("s3://%s/%s", bucket, key);
    }

    @Override
    public Path retrieveParquet(String storageUri) throws IOException {
        // Parse S3 URI: s3://bucket/key
        String[] parts = storageUri.replace("s3://", "").split("/", 2);
        String bucket = parts[0];
        String key = parts[1];

        Path tempFile = Files.createTempFile("parquet-", ".parquet");

        GetObjectRequest request = GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build();

        s3Client.getObject(request, ResponseTransformer.toFile(tempFile));

        return tempFile;
    }

    @Override
    public boolean exists(UUID tenantId, LocalDate date) {
        String key = buildKey(tenantId, date);

        try {
            HeadObjectRequest request = HeadObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

            s3Client.headObject(request);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    // ... similar implementations for listArchivedDates, delete, getMetadata
}
```

**External flake project: `fluo-s3-storage/flake.nix`:**
```nix
{
  inputs.betrace.url = "github:org/fluo";

  outputs = { fluo, ... }: {
    packages.x86_64-linux.s3-storage = buildJavaLibrary {
      name = "fluo-s3-storage";
      src = ./.;
      dependencies = [
        betrace.packages.x86_64-linux.backend
        "software.amazon.awssdk:s3:2.20.0"
      ];
    };
  };
}
```

### Development Setup

**No changes to `flake.nix`** - Filesystem implementation works out-of-box

**For S3 testing (optional):**
```nix
process-compose.yaml = {
  processes = {
    minio = {
      command = "${pkgs.minio}/bin/minio server ./data-minio --console-address :9001";
      availability.restart = "on_failure";
      readiness_probe = {
        http_get = {
          host = "127.0.0.1";
          port = 9000;
          path = "/minio/health/live";
        };
        initial_delay_seconds = 2;
      };
    };
  };
};
```

## Success Criteria

**Interface:**
- [ ] ColdStorageService interface defined
- [ ] All methods documented with contracts
- [ ] StorageMetadata supports observability

**Default Implementation:**
- [ ] FilesystemColdStorage works locally
- [ ] Parquet files organized by tenant/date
- [ ] Atomic operations (no partial writes)
- [ ] List archived dates works correctly

**Extensibility:**
- [ ] Consumers can provide alternative implementations
- [ ] @Alternative + @Priority correctly override default
- [ ] External implementations tested with Testcontainers

**Testing:**
- [ ] Interface contract tests (all implementations must pass)
- [ ] Filesystem implementation unit tests (90% coverage)
- [ ] Example S3 implementation (external project)

## Testing Requirements

**Contract Tests (Interface):**
```java
/**
 * Abstract test suite that all ColdStorageService implementations must pass.
 */
public abstract class ColdStorageServiceContractTest {

    protected abstract ColdStorageService createService();

    @Test
    @DisplayName("Should store and retrieve Parquet file")
    void testStoreAndRetrieve() throws IOException {
        ColdStorageService storage = createService();
        UUID tenantId = UUID.randomUUID();
        LocalDate date = LocalDate.now();

        // Create test Parquet file
        Path parquetFile = createTestParquet();

        // Store
        String uri = storage.storeParquet(tenantId, date, parquetFile);
        assertNotNull(uri);

        // Verify exists
        assertTrue(storage.exists(tenantId, date));

        // Retrieve
        Path retrieved = storage.retrieveParquet(uri);
        assertTrue(Files.exists(retrieved));
        assertEquals(Files.size(parquetFile), Files.size(retrieved));
    }

    @Test
    @DisplayName("Should list archived dates in descending order")
    void testListArchivedDates() throws IOException {
        ColdStorageService storage = createService();
        UUID tenantId = UUID.randomUUID();

        // Store files for multiple dates
        List<LocalDate> dates = List.of(
            LocalDate.of(2025, 1, 15),
            LocalDate.of(2025, 1, 10),
            LocalDate.of(2025, 1, 20)
        );

        for (LocalDate date : dates) {
            storage.storeParquet(tenantId, date, createTestParquet());
        }

        // List should return dates in descending order
        List<LocalDate> archived = storage.listArchivedDates(tenantId);

        assertEquals(3, archived.size());
        assertEquals(LocalDate.of(2025, 1, 20), archived.get(0));
        assertEquals(LocalDate.of(2025, 1, 15), archived.get(1));
        assertEquals(LocalDate.of(2025, 1, 10), archived.get(2));
    }

    @Test
    @DisplayName("Should delete archived file")
    void testDelete() throws IOException {
        ColdStorageService storage = createService();
        UUID tenantId = UUID.randomUUID();
        LocalDate date = LocalDate.now();

        String uri = storage.storeParquet(tenantId, date, createTestParquet());
        assertTrue(storage.exists(tenantId, date));

        storage.delete(uri);
        assertFalse(storage.exists(tenantId, date));
    }

    @Test
    @DisplayName("Should handle missing file gracefully")
    void testRetrieveNonExistent() {
        ColdStorageService storage = createService();

        assertThrows(FileNotFoundException.class, () -> {
            storage.retrieveParquet("file:///nonexistent.parquet");
        });
    }
}
```

**Filesystem Implementation Tests:**
```java
public class FilesystemColdStorageTest extends ColdStorageServiceContractTest {

    private Path tempDir;
    private FilesystemColdStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        tempDir = Files.createTempDirectory("cold-storage-test");
        storage = new FilesystemColdStorage();
        storage.coldStoragePath = tempDir.toString();
        storage.initialize();
    }

    @AfterEach
    void tearDown() throws IOException {
        Files.walk(tempDir)
            .sorted(Comparator.reverseOrder())
            .forEach(path -> path.toFile().delete());
    }

    @Override
    protected ColdStorageService createService() {
        return storage;
    }

    @Test
    @DisplayName("Should create directory structure on store")
    void testDirectoryStructure() throws IOException {
        UUID tenantId = UUID.randomUUID();
        LocalDate date = LocalDate.of(2025, 1, 15);

        storage.storeParquet(tenantId, date, createTestParquet());

        Path expected = Path.of(tempDir.toString(), tenantId.toString(), "2025", "01", "15.parquet");
        assertTrue(Files.exists(expected));
    }

    @Test
    @DisplayName("Should return correct metadata")
    void testGetMetadata() {
        StorageMetadata metadata = storage.getMetadata();

        assertEquals("filesystem", metadata.backendType());
        assertEquals(tempDir.toString(), metadata.location());
        assertTrue(metadata.attributes().containsKey("writable"));
        assertTrue(metadata.attributes().containsKey("free_space_gb"));
    }
}
```

## Minimum Test Coverage Targets

- **Overall Instruction Coverage:** 90%
- **Overall Branch Coverage:** 80%
- **ColdStorageService Contract:** 100% (all implementations must pass)
- **FilesystemColdStorage:** 95%

## Files to Create

**Interface:**
- `backend/src/main/java/com/fluo/services/storage/ColdStorageService.java`
- `backend/src/main/java/com/fluo/services/storage/StorageMetadata.java`

**Default Implementation:**
- `backend/src/main/java/com/fluo/services/storage/FilesystemColdStorage.java`

**Tests:**
- `backend/src/test/java/com/fluo/services/storage/ColdStorageServiceContractTest.java`
- `backend/src/test/java/com/fluo/services/storage/FilesystemColdStorageTest.java`

**Example Implementations (External Projects):**
- Document in README: `docs/COLD_STORAGE_BACKENDS.md`

## Files to Modify

**Backend:**
- `backend/src/main/resources/application.properties` - Add cold storage config

## Implementation Notes

**Interface Design:**
- **Idempotent:** `storeParquet()` with same tenantId/date replaces existing file
- **URI-Based:** Return storage URI (not implementation details)
- **Stateless:** No session management, each call is independent

**Filesystem Implementation:**
- **Atomic Operations:** Use `Files.move()` for atomic writes
- **Directory Structure:** `{tenant-id}/{YYYY}/{MM}/{DD}.parquet` for easy navigation
- **No Locking:** Rely on filesystem atomicity (suitable for single-writer archival process)

**Parquet Format:**
- **Compression:** ZSTD (best compression ratio)
- **Schema:** Same as DuckDB traces table
- **Partitioning:** One file per tenant per day (reasonable size: ~10-100MB)

**Extensibility:**
- Consumers create `@Alternative` implementation with `@Priority(1)`
- CDI automatically selects alternative over default
- No BeTrace code changes required

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - Interface abstraction, deployment chooses impl
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant file partitioning
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Future: Camel S3 component integration

## Dependencies

**Requires:** None (standalone abstraction)

**Blocks:**
- PRD-002d: Trace Archival Pipeline (uses ColdStorageService)

## Future Enhancements

- **Encryption at Rest:** Integrate with KMS for per-tenant keys
- **Object Versioning:** Support for immutable object stores (S3 versioning)
- **Multi-Region:** Replicate Parquet files across regions
- **Pre-Signed URLs:** Generate pre-signed URLs for external analytics tools
