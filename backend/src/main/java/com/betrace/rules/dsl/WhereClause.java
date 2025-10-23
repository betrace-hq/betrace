package com.betrace.rules.dsl;

/**
 * .where(attribute op value) clause
 */
public record WhereClause(String attribute, String operator, Object value) {
}
