

## Plan: Update `docs/API_CONTRACTS.md` with Full Contract Spec

### Single change

Replace the placeholder content in `docs/API_CONTRACTS.md` with the complete contract specification the user just provided. This covers all 6 sections: Core Principles, Global Rules, Shared Data Types, Endpoint Contracts, AI Endpoints, and Definition of Done.

No other files need to change -- the Zod schemas in `src/lib/contracts.ts`, the health edge function, and the client fetcher are already implemented and aligned with this spec.

### Notable detail from the spec

The AI endpoints section specifies using `OPENAI_API_KEY_NBA` (already configured as a secret) with model `gpt-4.1-mini` and web search enabled -- not the Lovable AI gateway. This will be relevant when implementing those endpoints later.

