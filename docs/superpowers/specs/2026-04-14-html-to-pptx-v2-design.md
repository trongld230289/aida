# HTML → PPTX Hybrid Converter v2 Design

## Problem

The v1 converter fills PPTX placeholders with raw extracted text, producing slides that look terrible:
- Placeholder sizes are tiny (Cover ph[11] is 37×7% of slide) — content overflows or is cut
- Raw text dump: no curation, too many bullets, bilingual text mixed randomly
- Slides with rich visual content (stat cards, flow diagrams) become walls of plain text
- No visual resemblance to the original HTML presentation

## Goal

Produce PowerPoint slides that:
1. Use the CEP template's background, branding, and layout styles
2. Have **editable titles** in the template's title placeholder
3. For text-heavy slides: LLM-curated 3–5 bullet points in body placeholder (editable)
4. For visual/diagram slides: crop the HTML content area as a screenshot → embed as image

## Architecture

Five phases, three of which change from v1:

```
Phase 0: Template Analysis (cached)        — unchanged
Phase 1: HTML Extraction                   — minor fix (lang-en already done)
Phase 2: Screenshot Capture (Puppeteer)    — NEW: crop content area per slide
Phase 3: LLM Reasoning (per slide)         — NEW: content_mode + body curation + language
Phase 4: PPTX Assembly                     — NEW: image insertion for diagram slides
```

## Phase 2 — Screenshot Capture

For each `.slide` element Puppeteer:
1. Captures a **full-slide screenshot** (1920×1080, deviceScaleFactor=1)
2. Queries `titleEl.getBoundingClientRect().bottom` to find where the title ends
3. Crops the image from `(0, title_bottom + 16px)` to `(1920, 1080)` using Pillow
4. Saves both paths: `{full: "slide-N-full.png", crop: "slide-N-crop.png"}`

The crop preserves the HTML dark background, stat card colors, flow step styling.

### Server.js changes

`captureSlideScreenshotsToFiles()` returns an array of `{full, crop}` objects (previously just a flat path array). The crop PNG is passed to Python as `--screenshots`.

## Phase 3 — LLM Reasoning

### New per-slide decision schema

```json
{
  "layout_name": "<exact name from catalog>",
  "title": "<title text — EN or EN+VI per language decision>",
  "content_mode": "text" | "image",
  "body": "<3–5 bullet lines if content_mode='text', else null>",
  "language": "en" | "bilingual",
  "speaker_notes": "<1–2 sentence summary>"
}
```

### content_mode selection rule (LLM guided)

Choose `"image"` when `element_types` includes any of: `stat-cards`, `flow-steps`, `table`, and when the HTML contains complex multi-column card layouts.

Choose `"text"` when the slide is primarily prose, bullets, or simple list content.

### Body curation rules (for text mode)

- Maximum 5 bullet points
- Each bullet ≤ 15 words
- Remove duplicate EN/VI pairs — keep the language version decided by `language` field
- For `"bilingual"`: keep short EN phrase + VI equivalent on same line, e.g. `"Faster release cycles / Release nhanh hơn"`

### Language decision rule

- `"en"` — slide is for an English-primary audience or content is self-evident in English
- `"bilingual"` — slide has unique bilingual context where both languages add value (e.g. client-facing Vietnamese audience)

### Layout selection (updated prompt)

The prompt now shows a per-layout capacity summary (title ✓/✗, body ✓/✗). LLM is instructed:
- If `content_mode="image"`: choose any layout with `title ✓` (body placeholder unused)
- If `content_mode="text"`: choose layout with both `title ✓` AND `body ✓`

## Phase 4 — PPTX Assembly

### Text mode (unchanged from v1 core)

Fill title placeholder (by idx) and body placeholder (by idx) from `decision.title` and `decision.body`.

### Image mode (new)

1. Fill title placeholder from `decision.title`
2. Open crop PNG with Pillow; get `(img_w, img_h)` in pixels
3. Determine placement rectangle:
   - `left` = body placeholder left (or 5% of slide width if no body placeholder)
   - `top` = body placeholder top (or title placeholder bottom + 0.1 inches)
   - `width` = slide width − left − right margin (5%)
   - `height` = auto-calculated to preserve aspect ratio, capped at slide bottom − top − 0.1 in
4. Call `slide.shapes.add_picture(crop_path, left, top, width, height)`

If no crop screenshot is available (e.g., screenshot failed), fall back to text mode.

## Data Flow

```
HTML file
  └─► slide_extractor.py → [{title, body_text, element_types}]  (Phase 1)
  └─► Puppeteer (server.js) → [{full.png, crop.png}]            (Phase 2)

Per slide: (slide_data, crop_path, catalog) → LLM
  └─► slide_reasoner.py → decision {layout, title, content_mode, body}  (Phase 3)

decisions[] + template.pptx → pptx_assembler.py → output.pptx           (Phase 4)
```

## Files Changed

| File | Change |
|------|--------|
| `convert-to-pdf/server.js` | `captureSlideScreenshotsToFiles()`: add content-area crop; return `{full, crop}` per slide; pass `crop` paths to Python `--screenshots` |
| `pptx_converter/slide_reasoner.py` | New prompt with `content_mode`, language, body curation (3–5 bullets, ≤15 words each), capacity-aware layout selection |
| `pptx_converter/pptx_assembler.py` | Add `_insert_image()`: `add_picture()` positioned at body placeholder area |
| `pptx_converter/main.py` | Handle `{full, crop}` screenshot structure; pass `crop` to `reason_slide()` and decision to assembler |

## Out of Scope

- Re-theming HTML elements to match CEP color palette (light mode re-render)
- Multi-language slide variants (separate EN and VI exports)
- Editing images inside PPTX after generation
- Support for templates other than CEP in this iteration
