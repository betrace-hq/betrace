package com.betrace.compliance.models;

import java.util.*;

/**
 * Type-safe enumeration of all soc2 controls.
 *
 * <p>This enum provides compile-time type safety when working with controls
 * and enables exhaustive switch statements.</p>
 *
 * @see com.compliance.annotations.SOC2Controls
 */
public enum SOC2Control {
    /** Logical Access - Authorization */
CC6_1("CC6.1", "Logical Access - Authorization", "Logical and Physical Access Controls", RiskLevel.HIGH)
,
    /** Access Control - User Registration */
CC6_2("CC6.2", "Access Control - User Registration", "Logical and Physical Access Controls", RiskLevel.MEDIUM)
,
    /** Access Control - De-provisioning */
CC6_3("CC6.3", "Access Control - De-provisioning", "Logical and Physical Access Controls", RiskLevel.HIGH)
,
    /** Encryption - Data at Rest */
CC6_6("CC6.6", "Encryption - Data at Rest", "Logical and Physical Access Controls", RiskLevel.CRITICAL)
,
    /** Encryption - Data in Transit */
CC6_7("CC6.7", "Encryption - Data in Transit", "Logical and Physical Access Controls", RiskLevel.CRITICAL)
,
    /** System Operations - Detection */
CC7_1("CC7.1", "System Operations - Detection", "System Operations", RiskLevel.HIGH)
,
    /** System Operations - Monitoring */
CC7_2("CC7.2", "System Operations - Monitoring", "System Operations", RiskLevel.MEDIUM)
,
    /** Change Management - Authorization */
CC8_1("CC8.1", "Change Management - Authorization", "Change Management", RiskLevel.MEDIUM)
;

    private final String id;
    private final String name;
    private final String category;
    private final RiskLevel riskLevel;

    SOC2Control(String id, String name, String category, RiskLevel riskLevel) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.riskLevel = riskLevel;
    }

    /** @return the control ID */
    public String getId() { return id; }

    /** @return the control name */
    public String getName() { return name; }

    /** @return the control category */
    public String getCategory() { return category; }

    /** @return the risk level */
    public RiskLevel getRiskLevel() { return riskLevel; }

    /**
     * Find a control by its ID.
     *
     * @param id the control ID
     * @return the control enum value
     * @throws IllegalArgumentException if no control exists with the given ID
     */
    public static SOC2Control fromId(String id) {
        for (SOC2Control control : values()) {
            if (control.id.equals(id)) {
                return control;
            }
        }
        throw new IllegalArgumentException("Unknown control ID: " + id);
    }

    /**
     * Get all controls in a specific category.
     *
     * @param category the category name
     * @return list of controls in that category
     */
    public static List<SOC2Control> getByCategory(String category) {
        List<SOC2Control> result = new ArrayList<>();
        for (SOC2Control control : values()) {
            if (control.category.equals(category)) {
                result.add(control);
            }
        }
        return result;
    }

    /**
     * Get all controls with a specific risk level.
     *
     * @param riskLevel the risk level
     * @return list of controls with that risk level
     */
    public static List<SOC2Control> getByRiskLevel(RiskLevel riskLevel) {
        List<SOC2Control> result = new ArrayList<>();
        for (SOC2Control control : values()) {
            if (control.riskLevel == riskLevel) {
                result.add(control);
            }
        }
        return result;
    }

    /** Risk level enumeration */
    public enum RiskLevel {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}
