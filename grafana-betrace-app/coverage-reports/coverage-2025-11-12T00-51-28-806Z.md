# BeTrace Coverage Report

**Generated:** 11/11/2025, 4:51:28 PM

## Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| **Use Cases** | 100.0% | 1/1 |
| **Features** | 100.0% | 3/3 |
| **API Routes** | 100.0% | 3/3 |
| **Lines of Code** | 0.0% | 0/0 |

## Use Cases

| ID | Name | Description | Tested By | Status |
|----|------|-------------|-----------|--------|
| `UC-RULES-001` | List Rules | User can retrieve all configured rules | tests/backend-api.spec.ts | ✅ |

## Features

| ID | Name | Component | Interactions | Tested By | Status |
|----|------|-----------|--------------|-----------|--------|
| `backend-health` | Backend Health Check | Backend API | - | tests/backend-api.spec.ts | ✅ |
| `rules-api` | Rules REST API | Backend API | - | tests/backend-api.spec.ts | ✅ |
| `metrics-endpoint` | Prometheus Metrics Endpoint | Backend API | - | tests/backend-api.spec.ts | ✅ |

## API Routes

| Method | Path | Status Codes | Requests | Tested By |
|--------|------|--------------|----------|-----------|
| `GET` | `/health` | 404 | 1 | tests/backend-api.spec.ts |
| `GET` | `/v1/rules` | 200 | 1 | tests/backend-api.spec.ts |
| `GET` | `/metrics` | 200 | 1 | tests/backend-api.spec.ts |

## Lines of Code Coverage

Top covered files:

| File | Lines | Covered | Coverage |
|------|-------|---------|----------|

