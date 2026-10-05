# StajPilot support site

A static support site for StajPilot (iOS/iPadOS/Android), built for GitHub
Pages. Plain HTML/CSS/JavaScript, no build step, no external fonts or CDNs,
no analytics, no cookies, and no server-side forms.

The Song Editor lives at `editor/index.html`. It keeps a local browser draft
and can import/export a song-only JSON document. The current mobile builds do
not yet import this file directly. No test song list is bundled with the site.

Song files use `{ "format": "stajpilot-songs", "version": 1, "songs": [...] }`.
Each song has a bank (1-125), songName, and exactly five slots with name,
subName, and ampImage (1-100). The editor can also read a raw songs array or
the existing controller-state JSON; it exports only song data. Run
`node --test editor/model.test.cjs` to check the file model.

## 1. Create the GitHub repository

1. On GitHub, click **New repository**.
2. Name it `stajpilot` (this name becomes part of the final URL).
3. Set visibility to **Public** (GitHub Pages on the free plan requires a
   public repo, unless you're on GitHub Pro/Enterprise).
4. Don't initialize with a README — this folder already has one.

## 2. Upload the files

Keep the folder structure exactly as-is:

```
/
├── index.html
├── ios/index.html
├── android/index.html
├── editor/index.html
├── editor/editor.css
├── editor/editor.js
├── editor/model.js
├── privacy/index.html
├── support/index.html
├── assets/
│   ├── styles.css
│   └── images/
└── README.md
```

Either push with git from this folder:

```bash
git init
git add .
git commit -m "Initial StajPilot support site"
git branch -M main
git remote add origin https://github.com/staJD/stajpilot.git
git push -u origin main
```

...or upload the files directly through GitHub's web UI ("Add file" →
"Upload files"), making sure the folder structure above is preserved.

## 3. Turn on GitHub Pages

1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a
   branch**.
3. Under **Branch**, select **`main`** and folder **`/ (root)`**.
4. Click **Save**.
5. Wait a minute or two, then reload the Pages settings page — it will
   show the live URL once deployment finishes.

## 4. Confirm the public URL

Your site will be live at:

```
https://staJD.github.io/stajpilot/
```

Open it in a private/incognito browser window to confirm it loads with no
sign-in and that `ios/`, `android/`, `privacy/`, and `support/` all load
correctly at that base URL.

## 5. URLs for App Store Connect

- **Support URL:** `https://staJD.github.io/stajpilot/ios/`
- **Privacy Policy URL:** `https://staJD.github.io/stajpilot/privacy/`

## 6. URLs for Google Play Console

- **Website / Support URL:** `https://staJD.github.io/stajpilot/android/`
- **Privacy Policy URL:** `https://staJD.github.io/stajpilot/privacy/`

## 7. Before submitting to either store

Click through every link on every page in an incognito window:

- Header nav on all 5 pages (Home, iPhone & iPad, Android, Support,
  Privacy)
- Footer Privacy link and the `mailto:` support email link on all 5 pages
- The two platform cards on the home page
- The two guide buttons on the Support page

If a link 404s, the most common cause is a missing trailing `index.html`
being served — GitHub Pages handles `/ios/` → `/ios/index.html`
automatically as long as the folder structure above was preserved exactly.

## 8. If the Privacy Policy ever changes

Edit only `privacy/index.html`. Update the **Effective date** line near
the top of that page to the date of the change. Nothing else needs to be
touched — the other pages link to `privacy/index.html`, not to a copy of
its content.
