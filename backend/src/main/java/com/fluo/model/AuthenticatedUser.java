package com.fluo.model;

import java.util.List;
import java.util.UUID;

/**
 * Authenticated user profile returned from WorkOS validation.
 *
 * @param userId Unique user identifier (WorkOS user ID)
 * @param email User email address
 * @param tenantId Tenant/organization ID (WorkOS organization ID)
 * @param roles User roles (admin, developer, sre, compliance-viewer, viewer)
 */
public record AuthenticatedUser(
    UUID userId,
    String email,
    UUID tenantId,
    List<String> roles
) {
    public AuthenticatedUser {
        if (userId == null) {
            throw new IllegalArgumentException("userId cannot be null");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email cannot be null or blank");
        }
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }
        if (roles == null || roles.isEmpty()) {
            throw new IllegalArgumentException("roles cannot be null or empty");
        }
    }

    public boolean isAdmin() {
        return roles.contains("admin");
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
