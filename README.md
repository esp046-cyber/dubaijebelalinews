# Daily Dubai & Jebel Ali News (2026 Edition)

Zero-dependency PWA for Jebel Ali, Discovery Gardens, Al Furjan, JAFZA and Dubai South.
Live URL: https://esp046-cyber.github.io/dubaijebelalinews/

## Deploy to GitHub Pages

1. Create the repository `esp046-cyber/dubaijebelalinews` on GitHub (public, branch `main`).
2. Upload the **contents** of this folder to the repository root (so `index.html` sits at the top level, not inside a subfolder). Drag and drop works in the GitHub web UI, or use git:
   ```bash
   git init -b main
   git add -A && git commit -m "Initial PWA"
   git remote add origin https://github.com/esp046-cyber/dubaijebelalinews.git
   git push -u origin main
   ```
3. In the repository go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then **Save**.
4. Wait 1–2 minutes, then open https://esp046-cyber.github.io/dubaijebelalinews/

## Updating

Edit files, commit, and bump `VERSION` in `sw.js` so installed copies refresh their cache.

## Regenerating icons

Open `tools/generate-assets.html` (any static server) to preview and download every PNG, or `tools/export-zip.html` to build `dubaijebelalinews.zip` in one click.

## Adding or changing news sources

Edit the `FEEDS` array at the top of `js/app.js`.
