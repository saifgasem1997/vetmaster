VetMaster — Bacterial Diseases three-level update

Final structure:
Bacterial Diseases
  - Cattle Diseases
  - Equine Diseases
  - Sheep & Goat Diseases

Each species folder contains its individual disease sections.

Installation:
1. Replace index.html, app.js, and style.css in the GitHub repository.
2. Wait for the Vercel deployment to finish.
3. Open Supabase > SQL Editor > New query.
4. Paste and run VetMaster_Bacterial_Three_Level_Fix.sql once.
5. Refresh VetMaster with Ctrl + F5.

The SQL is idempotent: running it again does not duplicate questions.
It moves existing questions to Bacterial Diseases and preserves their species folder.
Do not run the older bacterial reclassification SQL file.
