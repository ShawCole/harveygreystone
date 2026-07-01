# AI Surface: Document Classification & Contact Extraction

## Purpose

Automatically classify uploaded documents into the correct data room categories and extract stakeholder contact information. When a user batch-uploads files to a deal's data room, the AI reads each document's content, matches it to the best category in the 120-document capital raise template, and identifies any people mentioned who are deal stakeholders.

This replaces manual filing of documents and manual entry of contacts — the two most time-consuming parts of data room setup.

## Infrastructure

| Component | Value |
|-----------|-------|
| Model | Vertex AI `gemini-2.5-flash` |
| GCP Project | `dataroom-500817` |
| Region | `us-central1` |
| Auth | Application Default Credentials (service account on Cloud Run) |
| Endpoint | `POST /api/classify-docs` |
| Backend file | `netlify/functions/classify-docs.js` |
| Frontend trigger | `handleBatchFiles()` in `dataroom.js` (batch upload zone) |
| Fallback | `matchFileToDoc()` fuzzy filename matching (no AI needed) |

## Input

**HTTP Request:**
```json
POST /api/classify-docs
Authorization: session cookie
Content-Type: application/json

{
  "files": [
    {
      "filename": "Articles_of_Incorporation_Acme.pdf",
      "text": "STATE OF DELAWARE\nCERTIFICATE OF INCORPORATION\nOF\nACME CORPORATION..."
    },
    {
      "filename": "Q3_2025_PnL.xlsx",
      "text": "(no text extracted)"
    }
  ],
  "templateSections": [
    {
      "id": "01",
      "name": "Executive Summary",
      "subfolders": [
        {
          "name": "Investment Teaser / One-Pager",
          "documents": [
            { "name": "One-page deal teaser" },
            { "name": "Transaction overview memo" }
          ]
        }
      ]
    }
  ]
}
```

**`files` array:** Each file has a `filename` (original name) and `text` (extracted content, up to 3,000 characters per file). PDFs are extracted client-side using pdf.js. Non-PDF files include only the filename.

**`templateSections` array:** The full data room template structure (10 sections, 28 subfolders, 120 documents) from `data-room-template.json`. Provided so the AI knows every possible category.

## System Prompt

```
You are a document classification assistant for a capital-raising data room. Given a
list of uploaded files (with their extracted text) and a template of document categories,
classify each file into the best matching category and extract any people/stakeholders
mentioned.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "filename": "original filename",
    "matchedSection": "section id (e.g. 01)",
    "matchedSectionName": "section name",
    "matchedSubfolderIndex": 0,
    "matchedDocIndex": 0,
    "matchedDocName": "matched document name",
    "confidence": 85,
    "reasoning": "brief explanation",
    "contacts": [
      { "name": "John Smith", "role": "CEO", "company": "Acme Corp",
        "email": "john@acme.com" }
    ]
  }
]

For contacts, extract any names, roles, titles, companies, emails, and phone numbers
you find in the document text. Only include people who appear to be stakeholders
(executives, board members, investors, lawyers, accountants — not random mentions).

If a file doesn't match any category well, set confidence below 30 and matchedDocName
to "Uncategorized".
```

## User Prompt (Built Server-Side)

The handler constructs the user prompt by combining:

1. **File descriptions** — Each file with its name and text preview (first 3,000 chars)
2. **Template description** — Full template hierarchy formatted as:
   ```
   Section 01: Executive Summary
       Subfolder: Investment Teaser / One-Pager
           [0.0] One-page deal teaser
           [0.1] Transaction overview memo
       Subfolder: Executive Summary Deck
           [1.0] Executive summary presentation
   ```

## Output

**HTTP Response:**
```json
{
  "classifications": [
    {
      "filename": "Articles_of_Incorporation_Acme.pdf",
      "matchedSection": "05",
      "matchedSectionName": "Legal & Compliance",
      "matchedSubfolderIndex": 0,
      "matchedDocIndex": 0,
      "matchedDocName": "Certificate of incorporation / formation",
      "confidence": 95,
      "reasoning": "Document is a Delaware certificate of incorporation for Acme Corporation",
      "contacts": [
        {
          "name": "Jane Doe",
          "role": "Incorporator",
          "company": "Acme Corporation",
          "email": null
        },
        {
          "name": "Robert Chen",
          "role": "Registered Agent",
          "company": "CT Corporation",
          "email": "rchen@ctcorp.com"
        }
      ]
    }
  ]
}
```

## Output Schema

Each classification object:

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | Original uploaded filename |
| `matchedSection` | string | Section ID from template (e.g., "01", "05") |
| `matchedSectionName` | string | Section display name |
| `matchedSubfolderIndex` | number | Index of matched subfolder within section |
| `matchedDocIndex` | number | Index of matched document within subfolder |
| `matchedDocName` | string | Name of the matched document category |
| `confidence` | number (0–100) | AI's confidence in the classification |
| `reasoning` | string | Brief explanation of why this category was chosen |
| `contacts` | array | Extracted stakeholder contacts (see below) |

Each contact object:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name |
| `role` | string | Title or role (CEO, CFO, Board Member, Attorney, etc.) |
| `company` | string | Company or organization |
| `email` | string or null | Email address if found |
| `phone` | string or null | Phone number if found |

## Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing/empty files array | `{ "error": "files array required" }` |
| 400 | Missing template sections | `{ "error": "templateSections required" }` |
| 429 | Rate limited by Vertex AI | `{ "error": "classification failed; please retry" }` |
| 500 | Model error | `{ "error": "classification failed; please retry" }` |
| 502 | Empty response | `{ "error": "empty classification returned" }` |
| 502 | Unparseable JSON | `{ "error": "failed to parse AI response", "raw": "..." }` |

## Frontend Integration

### Batch Upload Flow (`handleBatchFiles()` in `dataroom.js`)

1. User drops multiple files into the batch upload zone
2. UI shows: "Analyzing X documents with AI..."
3. For each file:
   - If PDF: extract text client-side via `extractPdfText()` (up to 50 pages)
   - If non-PDF: use filename only (text = empty)
4. POST all files + template sections to `/api/classify-docs`
5. On success:
   - Map AI classifications back to `pendingBatch` array
   - Build `docId` from `matchedSection.matchedSubfolderIndex.matchedDocIndex`
   - Show preview table: File → AI Category → Section → Confidence → Reasoning
   - Show "Contacts Found" section if any contacts extracted
6. On failure:
   - Fall back to `matchFileToDoc()` — fuzzy filename matching (no AI)
   - Show toast: "AI classification unavailable, using filename matching"
7. User reviews and confirms
8. Files upload to GCS in their matched category slots
9. Extracted contacts (if checkbox checked) are added to global contacts list

### Preview Table Columns

| Column | Description |
|--------|-------------|
| Checkbox | Select/deselect file for upload |
| File | Original filename |
| AI Category | Matched document name from template |
| Section | Section name (e.g., "Legal & Compliance") |
| Confidence | Badge: green (70%+), amber (40–69%), red (<40%) |
| Reasoning | AI's explanation |

### Contacts Found Section

Displayed below the file table when contacts are extracted. Each contact shows:
- Name, Role, Company, Email
- Checkbox to "Add to deal contacts" (checked by default)
- On confirm, contacts are deduplicated by name and added to the `contacts` global array

## Fallback: Fuzzy Filename Matching

When the AI endpoint is unavailable, the system falls back to `matchFileToDoc()`:

1. Normalizes filename: lowercase, replace `-_. ` with spaces, strip file extension
2. Splits into words (minimum 3 characters)
3. Scores each template document by word overlap:
   - Exact word match: +2 points
   - Partial match (substring): +1 point
   - Section name match bonus: +0.5 points
4. Best match with score >= 1 is returned
5. Confidence = min(100, score * 20)
6. No contact extraction in fallback mode

## Quality Requirements

- Must correctly classify common financial/legal documents:
  - Articles of Incorporation → Section 05, Corporate Documents
  - Tax Returns → Section 04, Financials
  - Pitch Deck → Section 01, Executive Summary
  - Rent Roll → Section 10, Operations & Assets
  - Board Resolution → Section 05, Legal & Compliance
- Must not classify unrelated documents (e.g., personal photos) with high confidence
- Contacts must be real stakeholders — not every name mentioned in passing
- Must handle documents in multiple languages
- JSON response must be parseable — no markdown fences

## Performance

- Expected response time: 5–15 seconds (depending on number of files)
- Maximum files per batch: no hard limit, but practical limit ~20 files (prompt size)
- Text preview per file: 3,000 characters (truncated server-side)
- Cloud Run timeout: 600 seconds (more than sufficient)

## Data Flow Diagram

```
User drops files
       │
       ▼
Extract PDF text (client-side, pdf.js)
       │
       ▼
POST /api/classify-docs
  ├── files: [{ filename, text }]
  └── templateSections: [{ id, name, subfolders }]
       │
       ▼
Gemini 2.5 Flash (Vertex AI)
  ├── Classifies each file → template category
  └── Extracts stakeholder contacts
       │
       ▼
Return { classifications: [...] }
       │
       ▼
Frontend shows preview table
  ├── File → Category → Confidence
  └── Contacts Found (with add-to-contacts option)
       │
       ▼
User confirms
  ├── Files upload to GCS in matched slots
  ├── deal.dataRoom[docId] updated
  └── Contacts added to global contacts list
```
