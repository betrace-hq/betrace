package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for SpanApiRoute class.
 *
 * These tests verify the SpanApiRoute class structure and instantiation.
 * Actual route behavior is tested through integration tests that run a full
 * Quarkus application with Camel routes registered.
 *
 * NOTE: These are UNIT tests of the class, not integration tests of route behavior.
 * We cannot test Camel route configuration without a full Camel/Quarkus context,
 * which is an integration test concern, not a unit test concern.
 */
@DisplayName("SpanApiRoute Unit Tests")
class SpanApiRouteTest {

    @Test
    @DisplayName("SpanApiRoute should be instantiable")
    void testSpanApiRouteCreation() {
        assertDoesNotThrow(() -> {
            SpanApiRoute route = new SpanApiRoute();
            assertNotNull(route, "SpanApiRoute should not be null");
        });
    }

    @Test
    @DisplayName("SpanApiRoute should extend RouteBuilder")
    void testSpanApiRouteInheritance() {
        SpanApiRoute route = new SpanApiRoute();
        assertTrue(route instanceof RouteBuilder,
            "SpanApiRoute should extend RouteBuilder");
    }

    @Test
    @DisplayName("SpanApiRoute should have configure method from RouteBuilder")
    void testConfigureMethodExists() throws Exception {
        SpanApiRoute route = new SpanApiRoute();
        assertNotNull(route.getClass().getMethod("configure"),
            "SpanApiRoute should have configure() method from RouteBuilder");
    }

    @Test
    @DisplayName("Multiple SpanApiRoute instances should be independent")
    void testMultipleInstances() {
        SpanApiRoute route1 = new SpanApiRoute();
        SpanApiRoute route2 = new SpanApiRoute();

        assertNotNull(route1);
        assertNotNull(route2);
        assertNotSame(route1, route2, "Each instance should be independent");
    }

    @Test
    @DisplayName("SpanApiRoute should be annotated with @ApplicationScoped")
    void testApplicationScopedAnnotation() {
        boolean hasApplicationScoped = false;
        for (var annotation : SpanApiRoute.class.getAnnotations()) {
            if (annotation.annotationType().getSimpleName().equals("ApplicationScoped")) {
                hasApplicationScoped = true;
                break;
            }
        }
        assertTrue(hasApplicationScoped,
            "SpanApiRoute should be annotated with @ApplicationScoped for CDI");
    }

    @Test
    @DisplayName("SpanApiRoute should have injected processor fields")
    void testHasInjectedFields() {
        var fields = SpanApiRoute.class.getDeclaredFields();
        boolean hasInjectAnnotation = false;

        for (var field : fields) {
            for (var annotation : field.getAnnotations()) {
                if (annotation.annotationType().getSimpleName().equals("Inject")) {
                    hasInjectAnnotation = true;
                    break;
                }
            }
            if (hasInjectAnnotation) break;
        }

        assertTrue(hasInjectAnnotation,
            "SpanApiRoute should have @Inject annotated fields for processor dependencies");
    }

    @Test
    @DisplayName("SpanApiRoute class should be in correct package")
    void testPackage() {
        assertEquals("com.fluo.routes", SpanApiRoute.class.getPackageName(),
            "SpanApiRoute should be in com.fluo.routes package");
    }

    @Test
    @DisplayName("SpanApiRoute should be a public class")
    void testClassModifiers() {
        assertTrue(java.lang.reflect.Modifier.isPublic(SpanApiRoute.class.getModifiers()),
            "SpanApiRoute should be public");
    }
}
