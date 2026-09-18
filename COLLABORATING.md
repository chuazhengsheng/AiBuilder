# First draft handoff

This repository preserves the first working Veil challenge prototype. Application behaviour is unchanged. Hosting-account configuration is excluded so a colleague can develop independently.

## Run locally

Install Python first if it is not already available:

1. Download the recommended Windows installer or Python Install Manager from <https://www.python.org/downloads/>.
2. Run it. If the installer shows **Add Python to PATH**, select that option.
3. Close and reopen PowerShell, then run `py --version` to verify the installation. If `py` is unavailable, try `python --version`.
4. On a company-managed computer, use the approved Software Center or ask IT if software installation is restricted.

From the cloned repository, serve `dist` with:

```
py -m http.server 8765 --directory dist
```

If only the `python` command worked during verification, use:

```
python -m http.server 8765 --directory dist
```

Then visit http://localhost:8765 and select Open example memo. Keep the terminal open while using the app and press Ctrl+C to stop it. PDF import requires an HTTP server rather than opening index.html as a local file. All document-processing dependencies are included.

## Develop a version

Keep the `draft-v1` tag as the reference version. Create a development branch and make changes there. The app uses ordinary HTML, CSS and JavaScript; no API keys or backend are required. See README.md for supported formats and limitations.

Use fictional documents for development and demonstrations. Do not commit company documents, passwords, access tokens, or source documents used for a real review. Publishing and licensing decisions remain with the team and any applicable company owner; no new open-source licence is assigned by this handoff. Preserve the bundled third-party notices.

## Files

- `dist/index.html`: interface structure
- `dist/style.css`: layout and styling
- `dist/app.js`: imports, review interactions and exports
- `dist/core.js`: detection, grouping and replacement
- `dist/vendor/`: local readers and their licence notices

## Next product discussion

Define one real workflow: the document type, intended audience, information to protect, information that must remain useful, current manual steps and required output. An audience checklist is a review aid, not an automatic classification or release decision.

After implementing the chosen workflow, run a small colleague trial using comparable fictional examples. Measure time, planted details missed, unnecessary removals and whether the output remains useful. Functional checks do not establish detector accuracy or workplace productivity benefits.
