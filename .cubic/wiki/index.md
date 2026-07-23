# blixten85/politiker-kontakter Wiki

> This directory is machine-managed by cubic. Edit wiki content through [cubic wiki settings](https://www.cubic.dev/wiki/blixten85/politiker-kontakter) and custom instructions.

Wiki version: 2
Source commit: fb90f70fe5cf9a010de8dfbef330819898bdd810
Source branch: main
Generated: 2026-07-20T06:16:50.651Z

## Contents

### Overview

- [Introduction](01-section-overview/01-page-introduction.md)
- [Getting Started](01-section-overview/02-page-getting-started.md)
- [Unsupported Municipalities](01-section-overview/03-page-unsupported-municipalities.md)

### System Architecture

- [Architecture Overview](02-section-architecture/01-page-architecture-overview.md)
- [Cloudflare D1 Integration](02-section-architecture/02-page-d1-integration.md)

### Backend Systems (Scraper Engine)

- [Main Scraper Pipeline](03-section-backend-scrapers/01-page-main-scraper.md)
- [Scraper Types and Strategies](03-section-backend-scrapers/02-page-scraper-types.md)
- [European Parliament Scraper](03-section-backend-scrapers/03-page-eu-meps-scraper.md)
- [Swedish Parliament Scraper](03-section-backend-scrapers/04-page-riksdagen-scraper.md)
- [Church of Sweden Scraper](03-section-backend-scrapers/05-page-kyrka-scraper.md)
- [Government Departments Scraper](03-section-backend-scrapers/06-page-regeringen-scraper.md)

### Core Features

- [VCF Contact Card Generation](04-section-core-features/01-page-vcf-generation.md)
- [Automated Email Verification](04-section-core-features/02-page-email-verification.md)
- [Party Matching and Synchronization](04-section-core-features/03-page-party-matching.md)
- [Quarterly Refresh Script](04-section-core-features/04-page-quarterly-refresh.md)

### Data Management & Flow

- [Synchronizing Data to D1](05-section-data-management/01-page-d1-sync.md)
- [D1 Data Export Process](05-section-data-management/02-page-data-export.md)
- [Municipal/Regional Backfilling](05-section-data-management/03-page-kommun-backfilling.md)
- [Riksdagen Role Backfilling](05-section-data-management/04-page-riksdagen-backfilling.md)
- [Common Data Utilities](05-section-data-management/05-page-data-utilities.md)

### Testing and Quality Assurance

- [Test Suite Overview](06-section-testing/01-page-test-suite-overview.md)
- [Testing Scraper Helpers](06-section-testing/02-page-testing-helpers.md)
- [Testing Synchronization Logic](06-section-testing/03-page-testing-sync-d1.md)

### Deployment and Infrastructure

- [Docker Infrastructure](07-section-infrastructure/01-page-docker-setup.md)
- [CI/CD and Automation Workflows](07-section-infrastructure/02-page-ci-cd-workflows.md)
- [Security and Error Tracking](07-section-infrastructure/03-page-security-error-tracking.md)

### Extensibility and Customization

- [Adding New Regions](08-section-extensibility/01-page-adding-regions.md)
- [AI Agent Development Guidelines](08-section-extensibility/02-page-ai-agent-guidelines.md)
