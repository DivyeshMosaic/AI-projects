---
title: "AEP / AJO SkillStudio"
emoji: 🧪
colorFrom: blue
colorTo: indigo
sdk: static
pinned: false
app_file: index.html
---
# AEP SkillStudio (Static)
This is a full static front-end simulator intended for practicing AEP/AJO flows locally.

## Files included
- index.html
- simulator.css
- app.js

## How to deploy on Hugging Face Spaces (Static)
1. Create a new Space, choose 'Static' template and blank.
2. Upload these three files to the root of the Space repository.
3. Make sure filenames match exactly: `index.html`, `simulator.css`, `app.js`.
4. After uploading, open the Space App tab. If styles don't update, rename `simulator.css` and update the `link` query param in index.html (versioning) or hard refresh (Ctrl+Shift+R).

## Features
- Schema create / edit / delete (with fields, types, identity flag)
- Ingestion simulator: generate fake profiles from schemas
- Profiles viewer (JSON)
- Segments (simple rule-based audience)
- Export data as JSON
- Fully client-side (localStorage)
