# AI Surface: Underwriting Analysis

## Purpose

Perform a rigorous first-pass underwriting screening on uploaded deal documents. This is the primary AI capability of the platform — it reads pitch decks, financial statements, business plans, and other deal documents, then produces a structured JSON extraction of deal fields plus a full underwriter memo.

A licensed broker signs off after the AI — this is a first-pass screening tool, not a final opinion.

## Infrastructure

| Component | Value |
|-----------|-------|
| Model | Vertex AI `gemini-2.5-flash` |
| GCP Project | `dataroom-500817` |
| Region | `us-central1` |
| Auth | Application Default Credentials (service account on Cloud Run) |
| Endpoint | `POST /api/underwrite` |
| Backend file | `netlify/functions/underwrite.js` |
| Frontend trigger | `autoReadDocuments()` in `index.html` (deal creation modal) |
| Frontend trigger | `runUwAnalysis()` in `index.html` (underwriting tab) |

## Input

**HTTP Request:**
```json
POST /api/underwrite
Authorization: session cookie
Content-Type: application/json

{
  "prompt": "<system instructions + document text>"
}
```

The `prompt` field contains the full instruction set and document text, assembled client-side. The system prompt on the backend provides the underwriter persona. The user prompt (built client-side) provides the specific output format and document text.

**Document text** is extracted client-side from uploaded PDFs using pdf.js (`extractPdfText()`), capped at 50 pages. For non-PDF text, the user can paste directly into the textarea.

## System Prompt (Backend)

```
You are a meticulous, skeptical capital-markets underwriter performing a rigorous
first-pass screening for a capital-raising firm. A licensed broker signs off after you.
Be specific, quantitative, and conservative — never fabricate figures; write
"NOT PROVIDED" where data is missing.

Output format is strict: the VERY FIRST line of your response must be the single-line
JSON object the user specifies (raw JSON, no markdown, no code fences, no leading text).
After that JSON line, write the full underwriter memo. Do not wrap the JSON in backticks.
```

## User Prompt (Client-Side, in `autoReadDocuments()`)

The client-side prompt instructs the model to:

### Part 1: JSON Extraction (first line of response)

Extract a single-line JSON object with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Deal/company name |
| `company` | string | Company name |
| `contact` | string | Primary contact person |
| `email` | string | Contact email |
| `phone` | string | Contact phone |
| `capital` | string | Amount sought (e.g., "$50M") |
| `revenue` | string | Trailing revenue (e.g., "$30M") |
| `years` | string | Years in business (number) |
| `description` | string | 1–2 sentence plain description |
| `sourceLanguage` | string | Language of the source documents |
| `valuation` | string | Best valuation estimate + basis |
| `bankerFit` | number (1–100) | Attractiveness as debt/bank deal (cashflow, collateral, DSCR) |
| `investorFit` | number (1–100) | Attractiveness as equity/fund deal (growth, upside, scalability) |
| `riskScore` | number (1–100) | Risk level (higher = riskier) |
| `profitabilityScore` | number (1–100) | Profitability strength |
| `dealType` | string | "DEBT/BANK" or "EQUITY/FUND" or "HYBRID" |
| `roi` | string | Estimated ROI / return profile |
| `loiStatus` | string | LOI / term sheet status |
| `dscr` | string | Debt service coverage ratio if computable |
| `leverage` | string | Existing or implied leverage / debt-to-equity |
| `margins` | string | Gross/EBITDA margin if available |
| `useOfFunds` | string | Stated use of proceeds |
| `exitStrategy` | string | Exit / repayment path |
| `keyTerms` | string | Notable deal terms (rate, equity %, preferences, collateral) |
| `shortTerm` | string | Realistic placeable amount short-term (0–12mo) + reason |
| `longTerm` | string | Realistic placeable amount long-term + reason |
| `greenFlags` | string[] | 3 strong positives |
| `redFlags` | string[] | 3 concerns |
| `score` | number (1–100) | Overall deal quality |
| `execSummary` | string | 3–4 sentence underwriter executive summary |
| `consistency` | string | Plausibility read — do numbers tie out? |

### Part 2: Full Underwriter Memo (after JSON line)

Structured memo with these required sections:

1. **EXECUTIVE SUMMARY**
2. **BUSINESS OVERVIEW**
3. **THE ASK & USE OF FUNDS**
4. **FINANCIAL ANALYSIS** — revenue, growth, margins, profitability, show math
5. **VALUATION ANALYSIS** — multiple basis, comparables logic
6. **RISK ASSESSMENT** — operational, market, financial, concentration, execution
7. **DEAL STRUCTURE** — LOI status, proposed terms, ROI/return math, DSCR, leverage, exit/repayment
8. **BANKER VIEW**
9. **FUND/INVESTOR VIEW**
10. **GREEN FLAGS**
11. **RED FLAGS** — ranked
12. **CAPACITY** — short vs long term
13. **DILIGENCE GAPS** — what the licensed broker must obtain
14. **SCREENING VERDICT** — ADVANCE TO UNDERWRITING / NEEDS MORE INFO / LIKELY PASS + rationale

## Output

**HTTP Response:**
```json
{
  "result": "<JSON line>\n<full memo text>"
}
```

The frontend parses line 1 as JSON to auto-fill deal fields, and renders the remainder as the underwriting memo with section formatting.

## Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing or empty prompt | `{ "error": "prompt required" }` |
| 429 | Rate limited by Vertex AI | `{ "error": "underwriting failed; please retry" }` |
| 500 | Model error or unexpected failure | `{ "error": "underwriting failed; please retry" }` |
| 502 | Empty response from model | `{ "error": "empty analysis returned" }` |

## Frontend Integration

### Deal Creation Modal (`autoReadDocuments()`)
- Triggered after PDF text extraction completes
- Shows "Reading documents..." loading state
- On success: auto-fills deal form fields from JSON, displays memo
- On failure: shows error message, text still available for manual entry

### Underwriting Tab (`runUwAnalysis()`)
- User drops PDFs → text extracted → clicks "Run Underwriting Analysis"
- Shows loading spinner during analysis
- On success: displays structured memo + scores + "Push to Pipeline" button
- Maintains audit log of all analyses run

## Quality Requirements

- Must never fabricate financial figures — use "NOT PROVIDED" when data is missing
- Must be skeptical and conservative in scoring
- Must identify internal inconsistencies (round numbers, unsupported claims, missing audits)
- Must clearly distinguish between data found in documents vs. inferences
- JSON extraction must be parseable — no markdown fences, no leading text
- Memo sections must all be present even if sparse
- Multi-language documents must be read natively but output in English

## Performance

- Expected response time: 10–30 seconds (depending on document length)
- Cloud Run timeout: 600 seconds (sufficient for long documents)
- Maximum input: ~50 pages of extracted PDF text
- Maximum output tokens: not explicitly capped (model default)
