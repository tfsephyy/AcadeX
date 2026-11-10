# Unified AI Capstone Research Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AcadeX chatbot into a unified, context-aware AI Capstone Research Assistant that automatically switches between Smart Mode, PDF Only Mode, and General AI Mode based on navigation while honoring manual overrides, providing page-grounded citations, clickable PDF navigation, and research tools (summaries, gaps, suggestions, comparisons).

**Architecture:** 
- Frontend: Single floating assistant component with React Context (`ChatbotContext.jsx`) tracking active document context, current mode, and manual mode override. Segmented mode switcher, active PDF banner, and quick-action toolbar. Inline markdown rendering transforms `[PAGE:n]` into clickable links targeting `[data-document-page="n"]` in the PDF reader.
- Backend: Unified API controller (`ChatbotController.php`) accepting `mode`, `action`, and `capstone_id`. Enhances `ChatbotAiService.php` and `PdfTextService.php` to maintain page-delimited document text, query-relevant passage retrieval, and strict mode system prompts (PDF Only, Smart, General AI), supported by deterministic local fallbacks when AI keys are absent.

**Tech Stack:** React 19, React Router 7, Vite 7, Tailwind/CSS variables, Laravel 12, MySQL, Groq API (gpt-oss-120b), Google Gemini API (gemini-3.5-flash-lite), PDF.js.

**Spec:** User request: "Improve the Existing AI Capstone Research Assistant" (One unified chatbot, automatic & manual mode switching, 3 AI modes, research features with clickable page citations, capstone comparisons).

## Global Constraints

- Preserve all existing user permissions, roles, and approval rules (`CapstoneAccess`, `CapstonePolicy`).
- Non-destructive database operations only: no schema dropping or destructive mutations; work within existing columns (`capstones.pdf_text`).
- No hardcoded secrets or API keys in source code.
- Grounded citations: Never hallucinate or invent page numbers; cite actual document pages.
- Fallback resilience: All features must function deterministically when external AI provider keys are not configured.
- Existing tests must remain passing.

## Review Focus

1. **Route transitions:** Navigating from a capstone back to the library must automatically revert to Smart Mode and drop the active document context; navigating to a different capstone must replace the active document context and set mode to PDF Only (unless manually overridden).
2. **Manual Mode Override Persistence:** If a user manually changes mode while viewing a PDF (e.g. switches from PDF Only to General AI), subsequent questions must remain in General AI without reverting to PDF Only until navigating away.
3. **Disabled PDF Only Mode:** When no capstone is active, PDF Only Mode must be disabled in the UI and rejected/gracefully downgraded if requested.
4. **Clickable Citations:** Clicking `[PAGE:12]` must scroll the PDF container smoothly to `data-document-page="12"` in both normal view and fullscreen mode without reloading or crashing.
5. **PDF Only Strict Boundary:** In PDF Only Mode, the model must refuse to invent information not found in the document, explicitly stating that it was not found.

---

### Task 1: Chatbot Context & Navigation Lifecycle

**Files:**
- Modify: `EduArchive-Frontend-React/src/context/ChatbotContext.jsx`
- Modify: `EduArchive-Frontend-React/src/context/useChatbotContext.js`
- Modify: `EduArchive-Frontend-React/src/pages/admin/CapstoneMainPage.jsx`
- Modify: `EduArchive-Frontend-React/src/pages/student/StudentCapstoneMainPage.jsx`
- Modify: `EduArchive-Frontend-React/src/pages/visitor/VisitorCapstoneMainPage.jsx`
- Test: `EduArchive-Frontend-React/tests/chatbotContext.test.js`

**Interfaces:**
- Consumes: Route params and capstone state from detail pages.
- Produces: `useChatbotContext()` returning:
  - `activeCapstone`: `{ id, title, author, year, program, category, total_pages, abstract } | null`
  - `mode`: `'smart' | 'pdf_only' | 'general'`
  - `setMode(mode, isManual = true)`
  - `setActiveCapstone(capstone)`
  - `clearActiveCapstone()`
  - `isManualMode`: `boolean`
  - `scrollToPdfPage(pageNumber)`

- [ ] **Step 1: Write the failing unit test for ChatbotContext mode switching and manual persistence**

```javascript
// EduArchive-Frontend-React/tests/chatbotContext.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutoMode } from '../src/context/chatbotModeManager.js';

test('resolveAutoMode switches to pdf_only when capstone opens and no manual override', () => {
    const next = resolveAutoMode({ prevCapstoneId: null, nextCapstoneId: 10, currentMode: 'smart', isManual: false });
    assert.equal(next.mode, 'pdf_only');
    assert.equal(next.isManual, false);
});

test('resolveAutoMode preserves manual mode when switching capstones or chatting', () => {
    const next = resolveAutoMode({ prevCapstoneId: 10, nextCapstoneId: 10, currentMode: 'general', isManual: true });
    assert.equal(next.mode, 'general');
    assert.equal(next.isManual, true);
});

test('resolveAutoMode reverts to smart when closing capstone', () => {
    const next = resolveAutoMode({ prevCapstoneId: 10, nextCapstoneId: null, currentMode: 'pdf_only', isManual: false });
    assert.equal(next.mode, 'smart');
    assert.equal(next.isManual, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test EduArchive-Frontend-React/tests/chatbotContext.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `chatbotModeManager.js` and update `ChatbotContext.jsx`**

Implement pure mode resolution helper `resolveAutoMode` in `src/context/chatbotModeManager.js`.
Update `ChatbotContext.jsx` to maintain `activeCapstone`, `mode`, `isManual`, `setMode`, `setActiveCapstone`, and a custom window event dispatcher for `scrollToPdfPage(pageNumber)`.
Update `CapstoneMainPage.jsx`, `StudentCapstoneMainPage.jsx`, and `VisitorCapstoneMainPage.jsx` to pass the full capstone object to `setActiveCapstone` on mount and clear on unmount.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test EduArchive-Frontend-React/tests/chatbotContext.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Frontend-React/src/context/ EduArchive-Frontend-React/src/pages/ EduArchive-Frontend-React/tests/
git commit -m "feat(chatbot): context lifecycle and automatic mode management"
```

---

### Task 2: Mode Switcher UI & Active Document Header

**Files:**
- Modify: `EduArchive-Frontend-React/src/components/Chatbot.jsx`
- Modify: `EduArchive-Frontend-React/src/index.css`
- Test: `EduArchive-Frontend-React/tests/chatbotUI.test.js`

**Interfaces:**
- Consumes: `mode`, `setMode`, `activeCapstone`, `isManual` from `useChatbotContext()`.
- Produces: Visual segmented control in `Chatbot.jsx` header with modes `Smart`, `PDF Only`, `General AI`. Active Document info banner showing document title and clear/switch indicator.

- [ ] **Step 1: Write test for mode switcher button states and accessibility**

```javascript
// EduArchive-Frontend-React/tests/chatbotUI.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableModes } from '../src/components/chatbotHelpers.js';

test('getAvailableModes disables pdf_only when activeCapstone is null', () => {
    const modes = getAvailableModes(null);
    const pdfOnly = modes.find(m => m.id === 'pdf_only');
    assert.equal(pdfOnly.disabled, true);
});

test('getAvailableModes enables pdf_only when activeCapstone is present', () => {
    const modes = getAvailableModes({ id: 1, title: 'Sample' });
    const pdfOnly = modes.find(m => m.id === 'pdf_only');
    assert.equal(pdfOnly.disabled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test EduArchive-Frontend-React/tests/chatbotUI.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `chatbotHelpers.js` and UI in `Chatbot.jsx`**

Add `getAvailableModes(activeCapstone)` returning mode definitions with labels, descriptions, and disabled states.
Add segmented control in `Chatbot.jsx` header below title bar.
Add Active Document banner displaying the current PDF title with a badge indicating active PDF context.
Add styling in `src/index.css` for mode pill buttons, active states, and document banner with theme compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test EduArchive-Frontend-React/tests/chatbotUI.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Frontend-React/src/components/ EduArchive-Frontend-React/src/index.css EduArchive-Frontend-React/tests/
git commit -m "feat(chatbot): mode switcher and active document header"
```

---

### Task 3: Backend Chatbot Modes & Request Validation

**Files:**
- Modify: `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotIntentService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotResponseService.php`
- Test: `EduArchive-Backend-Laravel/tests/Feature/ChatbotModeValidationTest.php`

**Interfaces:**
- Consumes: POST `/api/v1/chatbot/message` payload with:
  `message: string`, `capstone_id: ?int`, `mode: ?string (smart|pdf_only|general)`, `action: ?string`, `compare_capstone_id: ?int`.
- Produces: JSON response with `{ reply, suggested_capstones, intent, provider, mode, references }`.

- [ ] **Step 1: Write failing feature test for mode validation and restrictions**

```php
// EduArchive-Backend-Laravel/tests/Feature/ChatbotModeValidationTest.php
namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class ChatbotModeValidationTest extends SecurityTestCase
{
    public function test_rejects_invalid_mode(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'Hello',
            'mode' => 'invalid_mode',
        ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['mode']);
    }

    public function test_pdf_only_mode_without_capstone_returns_helpful_guidance(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'Who authored this?',
            'mode' => 'pdf_only',
            'capstone_id' => null,
        ]);
        $response->assertOk();
        $response->assertJsonPath('data.mode', 'smart');
        $this->assertStringContainsString('No capstone PDF is currently open', $response->json('data.reply'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotModeValidationTest`
Expected: FAIL (validation error / 422 mismatch)

- [ ] **Step 3: Update `ChatbotController.php` validation and mode handling**

Update `$request->validate()` to accept:
- `'mode' => 'nullable|string|in:smart,pdf_only,general'`
- `'action' => 'nullable|string|in:summary,gaps,suggested_questions,similar,compare'`
- `'compare_capstone_id' => 'nullable|integer|exists:capstones,id'`
Normalize mode: default to `'smart'`. If `'pdf_only'` is passed with no `$openCapstone`, degrade to `'smart'` and return guidance.
Pass `$mode` and `$action` to `handleIntent()` and `ChatbotAiService`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotModeValidationTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php EduArchive-Backend-Laravel/tests/Feature/ChatbotModeValidationTest.php
git commit -m "feat(chatbot): backend mode validation and parameter handling"
```

---

### Task 4: Page-Delimited PDF Text Indexing & Relevant Passage Retrieval

**Files:**
- Modify: `EduArchive-Backend-Laravel/app/Services/PdfTextService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAiService.php`
- Create: `EduArchive-Backend-Laravel/app/Services/Chatbot/PdfPassageRetriever.php`
- Test: `EduArchive-Backend-Laravel/tests/Unit/PdfPassageRetrieverTest.php`

**Interfaces:**
- Consumes: `pdf_text` containing page delimiters `--- [PAGE:n] ---` or raw page strings.
- Produces: `PdfPassageRetriever::retrieve(string $pdfText, string $query, int $maxPages = 5): array` returning:
  `[['page' => int, 'text' => string, 'score' => float]]`.

- [ ] **Step 1: Write unit test for passage retrieval with page markers**

```php
// EduArchive-Backend-Laravel/tests/Unit/PdfPassageRetrieverTest.php
namespace Tests\Unit;

use App\Services\Chatbot\PdfPassageRetriever;
use PHPUnit\Framework\TestCase;

class PdfPassageRetrieverTest extends TestCase
{
    public function test_parses_page_markers_and_ranks_by_relevance(): void
    {
        $text = "--- [PAGE:1] ---\nTitle: Student Record System\nIntroduction to project.\n\n"
              . "--- [PAGE:2] ---\nMethodology: We implemented an agile Scrum methodology with React and Laravel.\n\n"
              . "--- [PAGE:3] ---\nResults: User testing showed a 95% satisfaction rate.";

        $retriever = new PdfPassageRetriever();
        $results = $retriever->retrieve($text, 'What methodology was used in this study?');

        $this->assertNotEmpty($results);
        $this->assertEquals(2, $results[0]['page']);
        $this->assertStringContainsString('Methodology: We implemented an agile Scrum', $results[0]['text']);
    }

    public function test_fallback_when_no_markers_present(): void
    {
        $text = "Plain un-delimited text without page headers.";
        $retriever = new PdfPassageRetriever();
        $results = $retriever->retrieve($text, 'sample query');
        $this->assertNotEmpty($results);
        $this->assertEquals(1, $results[0]['page']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=PdfPassageRetrieverTest`
Expected: FAIL (class not found)

- [ ] **Step 3: Implement `PdfPassageRetriever.php` and update `PdfTextService.php`**

In `PdfTextService.php`, add `--- [PAGE:{$pageNumber}] ---` delimiters during text layer and OCR page extraction.
In `PdfPassageRetriever.php`, parse text into pages using delimiter regex `/(?:---\s*\[PAGE:(\d+)\]\s*---|\f)/i`. Compute token frequency / keyword overlap score against query. Return top N scored pages.
In `ChatbotAiService.php`, use `PdfPassageRetriever` to select relevant pages for the prompt instead of a blind 6,000 character prefix.

- [ ] **Step 4: Run test to verify it passes**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=PdfPassageRetrieverTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Backend-Laravel/app/Services/Chatbot/PdfPassageRetriever.php EduArchive-Backend-Laravel/app/Services/PdfTextService.php EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAiService.php EduArchive-Backend-Laravel/tests/Unit/PdfPassageRetrieverTest.php
git commit -m "feat(chatbot): page-delimited passage retrieval for PDF grounding"
```

---

### Task 5: Clickable Page References & PDF Viewer Navigation

**Files:**
- Modify: `EduArchive-Frontend-React/src/components/Chatbot.jsx`
- Modify: `EduArchive-Frontend-React/src/index.css`
- Modify: `EduArchive-Frontend-React/src/components/ViewportPdfPage.jsx`
- Test: `EduArchive-Frontend-React/tests/pageReferenceLink.test.js`

**Interfaces:**
- Consumes: Assistant text containing `[PAGE:n]`, `[Page n]`, or `(p. n)`.
- Produces: Interactive `<button className="chatbot-page-link">` that triggers page scrolling via DOM selector `[data-document-page="n"]`.

- [ ] **Step 1: Write test for markdown citation parser**

```javascript
// EduArchive-Frontend-React/tests/pageReferenceLink.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPageCitations } from '../src/components/citationParser.js';

test('extractPageCitations identifies [PAGE:n] and [Page n] patterns', () => {
    const text = 'The methodology used Scrum [PAGE:14] and testing showed 90% [Page 25].';
    const citations = extractPageCitations(text);
    assert.deepEqual(citations, [14, 25]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test EduArchive-Frontend-React/tests/pageReferenceLink.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `citationParser.js` and renderer in `Chatbot.jsx`**

Implement `extractPageCitations` and tag replacer in `citationParser.js`.
In `Chatbot.jsx`:
- Extend `renderMarkdown()` to parse `[PAGE:n]` into a clickable citation button:
  `<button onClick={() => navigateToPage(n)} className="chatbot-page-ref-btn">📄 Page {n}</button>`.
- In `navigateToPage(pageNumber)`:
  Target `document.querySelector('[data-document-page="' + pageNumber + '"]')` and call `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- Style citation badge in `src/index.css` with distinct hover, focus, and dark/light mode colors.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test EduArchive-Frontend-React/tests/pageReferenceLink.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Frontend-React/src/components/ EduArchive-Frontend-React/src/index.css EduArchive-Frontend-React/tests/
git commit -m "feat(chatbot): clickable page citations scrolling to PDF pages"
```

---

### Task 6: AI Summary & Grounded PDF Answering (Smart vs PDF Only vs General)

**Files:**
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAiService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotResponseService.php`
- Modify: `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php`
- Test: `EduArchive-Backend-Laravel/tests/Feature/ChatbotModesExecutionTest.php`

**Interfaces:**
- Consumes: Prompt with mode contracts.
- Produces:
  - In `pdf_only` mode: Answers strictly from PDF text with page numbers; refuses to invent missing facts.
  - In `smart` mode: Prioritizes PDF for document queries, uses general AI knowledge for conceptual queries, clearly prefixing with `[Document Source (p. X)]` or `[AI Knowledge]`.
  - In `general` mode: Unrestricted general knowledge AI.
  - Action `summary`: Returns structured summary (Objectives, Methodology, Technologies, Findings, Page References).

- [ ] **Step 1: Write feature tests for the 3 modes and AI summary**

```php
// EduArchive-Backend-Laravel/tests/Feature/ChatbotModesExecutionTest.php
namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class ChatbotModesExecutionTest extends SecurityTestCase
{
    public function test_pdf_only_mode_refuses_to_answer_unsupported_facts(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $capstone = Capstone::factory()->create([
            'title' => 'Inventory System',
            'pdf_text' => "--- [PAGE:1] ---\nTitle: Inventory System\nAuthors: Jane Doe",
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'What was the total budget for this project?',
            'mode' => 'pdf_only',
            'capstone_id' => $capstone->id,
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertTrue(
            str_contains(strtolower($reply), 'not found in the document') ||
            str_contains(strtolower($reply), 'does not contain')
        );
    }

    public function test_summary_action_returns_structured_capstone_summary(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $capstone = Capstone::factory()->create([
            'title' => 'RFID Attendance System',
            'abstract' => 'This project implements an automated RFID attendance system.',
            'pdf_text' => "--- [PAGE:1] ---\nRFID Attendance\n--- [PAGE:2] ---\nMethodology: Scrum, PHP, Arduino.",
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'Summarize this capstone',
            'action' => 'summary',
            'mode' => 'pdf_only',
            'capstone_id' => $capstone->id,
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('Objectives', $reply);
        $this->assertStringContainsString('Methodology', $reply);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotModesExecutionTest`
Expected: FAIL

- [ ] **Step 3: Implement prompt builders and deterministic local response fallbacks**

In `ChatbotAiService.php`:
- Implement mode-specific system prompts:
  - `pdf_only`: Strict grounding, zero speculation, explicit refusal sentence when query is not grounded.
  - `smart`: Dual capability, document-first, clear `[Document Reference]` vs `[AI Explanation]` tags.
  - `general`: Standard assistant prompt without document bias.
- When `action === 'summary'`, instruct the model to produce sections:
  `### 🎯 Objectives`, `### 🛠 Methodology & Technologies`, `### 📊 Major Findings`, `### 📄 Page Citations`.
In `ChatbotResponseService.php`:
- Implement deterministic fallback for `summary`, `pdf_only` factual lookup, and general knowledge when AI provider keys are not configured.

- [ ] **Step 4: Run test to verify it passes**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotModesExecutionTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Backend-Laravel/app/Services/Chatbot/ EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ EduArchive-Backend-Laravel/tests/Feature/ChatbotModesExecutionTest.php
git commit -m "feat(chatbot): mode execution contracts and structured AI summary"
```

---

### Task 7: Dynamic Suggested Questions & Quick Tool Toolbar

**Files:**
- Modify: `EduArchive-Frontend-React/src/components/Chatbot.jsx`
- Modify: `EduArchive-Frontend-React/src/index.css`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotResponseService.php`
- Modify: `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php`
- Test: `EduArchive-Frontend-React/tests/suggestedQuestions.test.js`

**Interfaces:**
- Consumes: Active capstone metadata and document passages.
- Produces: Dynamic suggestion chips in chat and toolbar action buttons in chat drawer.

- [ ] **Step 1: Write test for dynamic question generation from capstone metadata**

```javascript
// EduArchive-Frontend-React/tests/suggestedQuestions.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSuggestedQuestions } from '../src/components/chatbotHelpers.js';

test('generates document-adaptive questions based on capstone metadata', () => {
    const capstone = {
        title: 'IoT Weather Station',
        program: 'BSIT',
        keywords: [{ name: 'IoT' }, { name: 'Sensors' }],
    };
    const questions = generateSuggestedQuestions(capstone);
    assert.ok(questions.length >= 4);
    assert.ok(questions.some(q => q.includes('methodology') || q.includes('technology')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test EduArchive-Frontend-React/tests/suggestedQuestions.test.js`
Expected: FAIL

- [ ] **Step 3: Implement suggested questions generator & toolbar in `Chatbot.jsx`**

Implement `generateSuggestedQuestions(capstone)` in `chatbotHelpers.js`.
In `Chatbot.jsx`:
- When an active capstone exists and conversation is empty or newly focused, display clickable suggested question pills above the input.
- Add quick action toolbar at top of messages or above textarea:
  - 📋 **Summary**
  - 🔍 **Methodology & Tech**
  - ⚠️ **Research Gaps**
  - 💡 **Suggested Questions**
  - 🔗 **Similar Research**
- Clicking a pill triggers `sendMessage()` with corresponding action payload.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test EduArchive-Frontend-React/tests/suggestedQuestions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Frontend-React/src/components/ EduArchive-Frontend-React/src/index.css EduArchive-Frontend-React/tests/
git commit -m "feat(chatbot): suggested questions chips and quick action toolbar"
```

---

### Task 8: Research Gaps & Improvements Analysis

**Files:**
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAiService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotResponseService.php`
- Modify: `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php`
- Test: `EduArchive-Backend-Laravel/tests/Feature/ChatbotResearchGapsTest.php`

**Interfaces:**
- Consumes: Action `gaps` or questions containing "research gaps", "limitations", "improvements".
- Produces: Response clearly distinguishing:
  1. **Documented Limitations** (grounded from text with page references).
  2. **AI-Suggested Future Enhancements** (explicitly marked as prospective research opportunities).

- [ ] **Step 1: Write test for research gaps separation**

```php
// EduArchive-Backend-Laravel/tests/Feature/ChatbotResearchGapsTest.php
namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class ChatbotResearchGapsTest extends SecurityTestCase
{
    public function test_research_gaps_separates_documented_limitations_from_suggestions(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $capstone = Capstone::factory()->create([
            'title' => 'Mobile Health App',
            'pdf_text' => "--- [PAGE:45] ---\nScope and Limitations: The system only operates on Android devices with internet connectivity.",
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'What are the research gaps and improvements?',
            'action' => 'gaps',
            'capstone_id' => $capstone->id,
            'mode' => 'smart',
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('Documented Limitations', $reply);
        $this->assertStringContainsString('Potential Future Improvements', $reply);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotResearchGapsTest`
Expected: FAIL

- [ ] **Step 3: Implement research gaps logic**

In `ChatbotAiService.php`:
- When analyzing gaps, query passages matching `scope`, `limitation`, `future work`, `recommendation`.
- Prompt instructs AI to structure response with:
  - `### 📌 Documented Limitations (from PDF)` (with `[PAGE:n]` citations).
  - `### 💡 AI-Suggested Research Improvements (Future Directions)`.
In `ChatbotResponseService.php`:
- Implement deterministic fallback extracting limitations sections from `pdf_text` or abstract when offline.

- [ ] **Step 4: Run test to verify it passes**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotResearchGapsTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Backend-Laravel/app/Services/Chatbot/ EduArchive-Backend-Laravel/tests/Feature/ChatbotResearchGapsTest.php
git commit -m "feat(chatbot): research gaps and improvements analysis"
```

---

### Task 9: Similar Capstones & Side-by-Side Comparison

**Files:**
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotQueryService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotResponseService.php`
- Modify: `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAiService.php`
- Modify: `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php`
- Modify: `EduArchive-Frontend-React/src/components/Chatbot.jsx`
- Test: `EduArchive-Backend-Laravel/tests/Feature/ChatbotComparisonTest.php`

**Interfaces:**
- Consumes: Action `similar` or `compare`, with `capstone_id` and optional `compare_capstone_id`.
- Produces:
  - `similar`: List of verified related capstones from database with clickable links/cards.
  - `compare`: Side-by-side comparison table/breakdown (Objectives, Methodology, Tech, Results, Citing both sources).

- [ ] **Step 1: Write test for capstone comparison and similar capstones**

```php
// EduArchive-Backend-Laravel/tests/Feature/ChatbotComparisonTest.php
namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class ChatbotComparisonTest extends SecurityTestCase
{
    public function test_compares_two_capstones_without_mixing_sources(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $cap1 = Capstone::factory()->create([
            'title' => 'E-Commerce App A',
            'abstract' => 'Focuses on React frontend and Stripe payments.',
            'pdf_text' => "--- [PAGE:1] ---\nE-Commerce App A\nTech: React, Stripe",
        ]);
        $cap2 = Capstone::factory()->create([
            'title' => 'E-Commerce App B',
            'abstract' => 'Focuses on Flutter mobile and PayPal integration.',
            'pdf_text' => "--- [PAGE:1] ---\nE-Commerce App B\nTech: Flutter, PayPal",
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/chatbot/message', [
            'message' => 'Compare these two capstones',
            'action' => 'compare',
            'capstone_id' => $cap1->id,
            'compare_capstone_id' => $cap2->id,
            'mode' => 'smart',
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('E-Commerce App A', $reply);
        $this->assertStringContainsString('E-Commerce App B', $reply);
        $this->assertCount(2, $response->json('data.suggested_capstones'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotComparisonTest`
Expected: FAIL

- [ ] **Step 3: Implement similarity search and comparison**

In `ChatbotQueryService.php`:
- Implement `findSimilar(Capstone $capstone, int $limit = 4)` matching shared keywords, categories, and program while excluding the current capstone.
In `ChatbotAiService.php` & `ChatbotResponseService.php`:
- Implement comparison prompt and deterministic fallback comparing:
  - Objectives & Scope
  - Methodology
  - Technologies & Tools
  - Findings & Outcomes
In `Chatbot.jsx`:
- When comparison is requested, allow the user to select from similar capstones to compare against.
- Render comparative suggestions as clickable capstone cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `php EduArchive-Backend-Laravel/scripts/run-security-tests.php --filter=ChatbotComparisonTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add EduArchive-Backend-Laravel/app/Services/Chatbot/ EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ EduArchive-Frontend-React/src/ EduArchive-Backend-Laravel/tests/Feature/ChatbotComparisonTest.php
git commit -m "feat(chatbot): similar capstone discovery and side-by-side comparison"
```

---

### Task 10: Full Verification, Documentation & Production Readiness

**Files:**
- Modify: `docs/ACADEX_REQUIREMENTS.md`
- Modify: `docs/ACADEX_PROGRESS.md`
- Modify: `docs/ACADEX_DECISIONS.md`
- Test: Full frontend and backend test suites

**Interfaces:**
- Consumes: All updated components and services.
- Produces: Complete passing test run (frontend vitest/node test + backend PHPUnit) and updated project documentation.

- [ ] **Step 1: Run complete frontend unit tests and lint**

Run:
```bash
cd EduArchive-Frontend-React
npm test -- --run
npm run lint -- --quiet
```
Expected: All tests pass, 0 lint errors.

- [ ] **Step 2: Run complete backend test suite against guarded disposable database**

Run:
```bash
php EduArchive-Backend-Laravel/scripts/run-security-tests.php
```
Expected: PASS.

- [ ] **Step 3: Test production build**

Run:
```bash
cd EduArchive-Frontend-React
npm run build
```
Expected: Build succeeds without errors.

- [ ] **Step 4: Update persistent memory documentation**

Record implementation details, decisions, and local verification results in `docs/ACADEX_REQUIREMENTS.md`, `docs/ACADEX_PROGRESS.md`, and `docs/ACADEX_DECISIONS.md` in accordance with `AGENTS.md`.

- [ ] **Step 5: Final Commit**

```bash
git add docs/
git commit -m "docs(chatbot): record unified ai research assistant implementation and verification"
```
