package com.betrace.compliance.models;

import java.util.List;

/**
 * Base interface for all compliance control model classes.
 *
 * <p>This interface ensures consistent API across all frameworks and enables
 * polymorphic handling of controls from different frameworks.</p>
 */
public interface ComplianceControl {
    /** @return the unique control ID */
    String getId();

    /** @return the human-readable control name */
    String getName();

    /** @return the control category */
    String getCategory();

    /** @return the detailed control description */
    String getDescription();

    /** @return the risk level (low, medium, high, critical) */
    String getRiskLevel();

    /** @return list of specific requirements */
    List<String> getRequirements();

    /** @return list of evidence types needed */
    List<String> getEvidenceTypes();
}
