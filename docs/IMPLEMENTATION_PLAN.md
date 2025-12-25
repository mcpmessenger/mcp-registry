# Implementation Plan - Stack Analysis Recommendations

Based on the **Project Stack Analysis and Playwright Test Report** dated December 22, 2025, this document outlines the action plan to address the key recommendations.

## Priority 1: Define Clear API Contracts

### Current State
- ✅ MCP v0.1 types defined in `backend/src/types/mcp.ts`
- ✅ Zod schemas for validation in routes
- ✅ Tool schemas stored in database (`toolSchemas` field)

### Actions Required
1. **Create Central Tool Schema Repository**
   - [ ] Create `docs/MCP_TOOL_SCHEMAS.md` or `tools/schemas/` directory
   - [ ] Document all tool definitions (generate_svg, refine_design, etc.)
   - [ ] Include JSON Schema examples for each tool
   - [ ] Add OpenAPI/Swagger specification for registry API

2. **Formalize API Contracts**
   - [ ] Create `docs/API_CONTRACTS.md` documenting:
     - Registry → Server communication protocol
     - Tool invocation contracts
     - Event/message formats
   - [ ] Add TypeScript interfaces exported from a shared package
   - [ ] Version API contracts (v0.1, v0.2, etc.)

### Files to Create/Update
- `docs/MCP_TOOL_SCHEMAS.md` - Central repository for tool definitions
- `docs/API_CONTRACTS.md` - API contract documentation
- `backend/src/types/api-contracts.ts` - Shared TypeScript interfaces

---

## Priority 2: Standardize Deployment

### Current State
- ✅ `backend/cloudbuild.yaml` exists for GCP Cloud Build
- ✅ `backend/Dockerfile` and `backend/Dockerfile.debian` exist
- ⚠️ Frontend deployed to Vercel (separate from backend)
- ⚠️ No unified deployment pipeline

### Actions Required
1. **Unified Cloud Deployment**
   - [ ] Standardize on GCP Cloud Run for all services:
     - Backend (Node.js/Express) → Cloud Run
     - playwright-mcp (Node.js/Express) → Cloud Run  
     - LangchainMCP (Python/FastAPI) → Cloud Run
   - [ ] Create unified `cloudbuild.yaml` or separate ones with consistent structure
   - [ ] Document deployment process in `docs/DEPLOYMENT.md`

2. **CI/CD Pipeline**
   - [ ] Set up GitHub Actions or Cloud Build triggers
   - [ ] Automated testing before deployment
   - [ ] Environment-specific configurations (dev/staging/prod)

3. **Infrastructure as Code**
   - [ ] Consider Terraform or Cloud Deployment Manager for infrastructure
   - [ ] Document resource requirements for each service

### Files to Create/Update
- `docs/DEPLOYMENT.md` - Comprehensive deployment guide
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD
- `docker-compose.prod.yml` - Production deployment configuration

---

## Priority 3: Prioritize Documentation

### Current State
- ✅ Multiple README files exist
- ✅ Some feature-specific documentation
- ⚠️ Documentation scattered across multiple files
- ⚠️ No centralized developer onboarding guide

### Actions Required
1. **Developer Onboarding**
   - [ ] Create `docs/ONBOARDING.md` with:
     - Quick start guide
     - Development environment setup
     - Project structure overview
     - Team structure (Frontend/Node.js/Python)
   - [ ] Add `CONTRIBUTING.md` enhancements

2. **MCP Tool Consumer Documentation**
   - [ ] Create `docs/MCP_TOOL_CONSUMERS.md`:
     - How to discover tools via registry
     - How to invoke tools
     - Tool-specific usage examples
     - Authentication/OAuth setup
   - [ ] Add code examples for each tool

3. **Architecture Documentation**
   - [ ] Create `docs/ARCHITECTURE.md`:
     - System architecture diagram
     - Data flow diagrams
     - Service interaction patterns
     - Event-driven architecture overview

### Files to Create/Update
- `docs/ONBOARDING.md` - Developer onboarding guide
- `docs/MCP_TOOL_CONSUMERS.md` - Tool consumer documentation
- `docs/ARCHITECTURE.md` - System architecture documentation
- Update `README.md` with better navigation

---

## Priority 4: Tool Definition Repository

### Current State
- ✅ Tool definitions stored in database (`tools` field)
- ✅ Seed script with tool examples (`backend/src/scripts/seed-mcp-server.ts`)
- ⚠️ No centralized schema repository

### Actions Required
1. **Create Schema Repository**
   - [ ] Create `tools/schemas/` directory structure:
     ```
     tools/
     ├── schemas/
     │   ├── generate_svg.json
     │   ├── refine_design.json
     │   └── index.json
     ├── README.md
     └── validator.ts
     ```
   - [ ] JSON Schema files for each tool
   - [ ] Schema validation utilities
   - [ ] Schema versioning strategy

2. **Schema Validation**
   - [ ] Add pre-commit hooks to validate schemas
   - [ ] Integrate schema validation in publish endpoint
   - [ ] Document schema evolution process

### Files to Create/Update
- `tools/schemas/` directory with JSON Schema files
- `tools/validator.ts` - Schema validation utilities
- `docs/SCHEMA_EVOLUTION.md` - Schema versioning guide

---

## Priority 5: Testing Strategy

### Current State
- ✅ Some Playwright scripts exist (`scripts/` directory)
- ✅ Integration test scripts (`test-integration.ps1`)
- ❌ No formal E2E test suite for tool-use lifecycle
- ❌ No test framework setup (Jest, Playwright Test, etc.)

### Actions Required
1. **E2E Test Suite**
   - [ ] Set up Playwright Test framework
   - [ ] Create test suite structure:
     ```
     tests/
     ├── e2e/
     │   ├── registry-discovery.spec.ts
     │   ├── tool-invocation.spec.ts
     │   ├── full-lifecycle.spec.ts
     │   └── playwright-mcp.spec.ts
     ├── integration/
     │   └── api-tests.spec.ts
     └── playwright.config.ts
     ```
   - [ ] Test scenarios:
     - Registry → Agent discovery
     - Tool invocation workflow
     - End-to-end SVG generation
     - Error handling and recovery

2. **Test Infrastructure**
   - [ ] Set up test database (separate from dev/prod)
   - [ ] Mock external services (Google APIs)
   - [ ] CI/CD integration for automated testing

### Files to Create/Update
- `tests/playwright.config.ts` - Playwright configuration
- `tests/e2e/full-lifecycle.spec.ts` - Complete tool-use lifecycle test
- `.github/workflows/test.yml` - Automated test runner

---

## Priority 6: Monitoring & Security (Operational Focus)

### Actions Required
1. **Monitoring for playwright-mcp**
   - [ ] Set up Cloud Monitoring for:
     - CPU/Memory usage
     - Browser session lifespan
     - Request latency
     - Error rates
   - [ ] Create dashboards and alerts

2. **Security Audit**
   - [ ] Security review of browser automation server
   - [ ] Rate limiting configuration review
   - [ ] Input sanitization audit
   - [ ] OAuth security review

### Files to Create/Update
- `docs/MONITORING.md` - Monitoring setup guide
- `docs/SECURITY.md` - Security guidelines and audit checklist

---

## Implementation Timeline

### Phase 1: Documentation (Week 1)
- [ ] Developer onboarding guide
- [ ] API contracts documentation
- [ ] Tool consumer documentation

### Phase 2: Testing (Week 2)
- [ ] E2E test suite setup
- [ ] Full lifecycle tests
- [ ] CI/CD integration

### Phase 3: Deployment Standardization (Week 3)
- [ ] Unified deployment pipeline
- [ ] GCP Cloud Run migration (if needed)
- [ ] Environment configurations

### Phase 4: Tool Schema Repository (Week 4)
- [ ] Centralized schema repository
- [ ] Validation utilities
- [ ] Schema documentation

---

## Success Metrics

- [ ] New developers can set up environment in < 30 minutes
- [ ] API contracts documented with 100% endpoint coverage
- [ ] E2E test suite covers core tool-use workflows
- [ ] All services deployable via single pipeline
- [ ] Tool schemas versioned and validated automatically

---

## Notes

- This plan aligns with the recommendations in the Stack Analysis Report
- Priorities can be adjusted based on team capacity and business needs
- Each task should have an owner assigned
- Regular review and updates to this plan as progress is made





