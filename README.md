# Veil — sensitivity masking prototype

A company-challenge prototype for reviewing potentially sensitive details before creating an edited text copy.

The submitted walkthrough is available at `demo/Veil-Challenge-Walkthrough.mp4`.

## Quick start on Windows

### 1. Install Python

1. Go to the official [Python downloads page](https://www.python.org/downloads/).
2. Download and run the recommended Windows installer or Python Install Manager.
3. If the installer shows **Add Python to PATH**, select it before installing.
4. Close and reopen PowerShell after installation.
5. Check that Python is available:

```powershell
py --version
```

If `py` is not recognised, try:

```powershell
python --version
```

On a company-managed computer, install Python through your approved Software Center or ask IT if installation is restricted.

### 2. Clone and open Veil

```powershell
git clone https://github.com/chuazhengsheng/AiBuilder.git
cd AiBuilder
py -m http.server 8765 --directory dist
```

If the `py` command did not work in step 1 but `python` did, start the app with:

```powershell
python -m http.server 8765 --directory dist
```

Open <http://localhost:8765> in a browser and select **Open example memo**. Keep the PowerShell window open while using Veil. Press **Ctrl+C** in that window when you want to stop the app.

## Use

Open the private hosted app, or serve `dist/` with any static web server and open its local address. Try the fictional example memo first. Import TXT, Markdown, DOCX or a PDF with selectable text, review every suggested detail, add internal terms, inspect the preview and confirm a full-document review before exporting.

The browser performs all document processing locally. No document history, analytics, remote AI, or document API is used. Refreshing clears the review. Dependencies are included locally.

## Scope and limits

- Pattern checks: emails, Singapore-format phone numbers and ID-like strings, monetary values, and names following supported labels such as Prepared by, Name, Employee, Applicant, Officer, Patient, Contact person.
- Names without labels, indirect identifiers, organisation-specific secrets and many other sensitive details may be missed. Add custom exact terms and review unmarked text.
- ID patterns are not identity validation. Replacements do not guarantee anonymity, change classification or authorise release.
- Maximum input: 8 MB, 200,000 extracted characters, 100 PDF pages. Scanned/image-only PDFs need OCR elsewhere. No image redaction is provided.
- Output is a new text copy. Original PDF/Word layout, images, comments, metadata and embedded objects are not copied. The original file remains unchanged.
- A separate HTML review record includes aggregate decisions, excludes original values, source text and source filename, and is not a release approval.
- Designed for a fictional challenge demonstration. Company approval and evaluation are still needed before using it for actual sensitive work.

## Implementation

Plain HTML/CSS/JavaScript with local PDF.js and Mammoth readers. `core.js` implements repeat grouping, overlap-aware replacement and HTML escaping. `app.js` provides review gating, local imports and export. No backend or API keys are required.

## Validation

Tested sample detection, repeated names, custom terms, review gating, removal in text exports, review-record exclusions, invalidation after edits, hostile HTML rendering, empty/oversized input errors, PDF/DOCX imports, no external document-processing requests, and mobile overflow. No measured workplace time saving or detector accuracy claim is made.
