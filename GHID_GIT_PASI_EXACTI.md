# PAȘI EXACȚI - Cum pui repo-ul pe GitHub

## 0. Ce ai nevoie
- Cont GitHub (github.com)
- Git instalat (https://git-scm.com/download/win) - verifici cu `git --version` în CMD
- Fișierul ZIP descărcat de la mine

## 1. Dezarhivezi
Click dreapta pe ZIP → Extract All → intră în folderul `ai-cooldown-final`
Trebuie să vezi `index.html`, `src`, `README.md`, etc.

## 2. Creezi repo pe GitHub
1. Intri pe https://github.com/new
2. Repository name: `ai-cooldown-tracker`
3. Description: `Tracker limite AI cu voce RO+EN - countdown, titlu dinamic Chrome, alarmă calmă`
4. Public
5. NU bifa "Add a README" (îl avem deja)
6. Create repository
7. COPIAZĂ link-ul care apare: https://github.com/USERNAME/ai-cooldown-tracker.git

## 3. Deschizi terminal în folderul repo-ului
Pe Windows: click dreapta în folder → Open in Terminal / Git Bash Here
Pe Mac: click dreapta → New Terminal at Folder

## 4. Rulezi COMENZILE astea, una câte una (copy-paste):

```bash
git init
git add .
git commit -m "feat: v1.3.0 - voce RO+EN, fix ChatGPT ceas gbt, alarmă calmă, titlu dinamic"
git branch -M main
git remote add origin https://github.com/DanielAlbuta/ai-cooldown-tracker.git
git push -u origin main
```

ÎNLOCUIEȘTE USERNAME cu numele tău de GitHub! Ex: danialbuta

Dacă îți cere login: loghează-te cu browser-ul (GitHub va deschide fereastră).

## 5. Verifici
Intră pe https://github.com/USERNAME/ai-cooldown-tracker - trebuie să vezi toate fișierele.

## 6. Activezi GitHub Pages (ca să ai link live)

1. În repo-ul tău pe GitHub → Settings (tab sus)
2. În stânga → Pages
3. La "Build and deployment" → Source: `Deploy from a branch`
4. Branch: `main` + `/ (root)` → Save
5. Aștepți 1-2 minute, apoi refresh la pagină - apare link-ul:
   `https://USERNAME.github.io/ai-cooldown-tracker/`

Acel link e aplicația ta LIVE - o poți deschide pe telefon, da Add to Home Screen.

## 7. (Opțional) Vrei domeniu custom sau Vercel?

Vercel (mai rapid decât Pages):
1. https://vercel.com → Import Project → alegi repo-ul → Deploy
2. Primești link instant: `ai-cooldown-tracker.vercel.app`

## Probleme comune

- `git not found` → instalează Git de la git-scm.com și restartează PC-ul
- `remote origin already exists` → rulează `git remote remove origin` apoi re-adaugă
- `failed to push` → `git pull --rebase origin main` apoi `git push`
- Vrei să actualizezi după modificări:
```bash
git add .
git commit -m "update: descriere modificare"
git push
```

Gata! Ai repo public cu README, licență și aplicație funcțională.
