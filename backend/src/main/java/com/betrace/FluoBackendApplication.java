package com.betrace;

import io.quarkus.runtime.Quarkus;
import io.quarkus.runtime.annotations.QuarkusMain;

/**
 * Main application class for FLUO Backend V2.
 *
 * This application uses Quarkus with Apache Camel for:
 * - REST API endpoints
 * - Transformer pattern for data conversion
 * - Integration with custom Camel components (rule, tigerbeetle, tenant)
 */
@QuarkusMain
public class FluoBackendApplication {

    public static void main(String... args) {
        Quarkus.run(args);
    }
}