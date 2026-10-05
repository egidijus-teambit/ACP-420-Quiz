# ACP-420 Practice Exam

A static practice-exam site for **Atlassian ACP-420: Managing Jira Service Projects for Cloud**. It needs no build step and no server code.

- 145-question bank, weighted by the official V2 exam topics (April 2025)
- 75 questions per attempt with a **180-minute timer**; the exam submits itself when time runs out
- Single-answer (radio) and multiple-answer (checkbox) questions
- **Variants A, B and C** always use the same question set, which makes results comparable between people. **Random** draws a new set each time. Question order and answer order are shuffled on every attempt.
- Asks for your name before the exam starts
- Flag questions for review, use the question grid, and navigate with ← / →
- If you refresh the page mid-exam, the exam resumes where you left off
- Results include a score by topic and a full review with the correct answers and explanations
- **Statistics page**
  - Every attempt is stored
  - Filter by person
  - Score trend
  - Averages by topic
  - Most-missed questions
  - Compare any two attempts (question overlap, what improved, what was missed both times)
  - Export / import JSON
- Light and dark themes; works on mobile

See [STUDY_NOTES.md](STUDY_NOTES.md) for the study summary.

## Project structure

```
index.html          page shell
css/styles.css      styles (light/dark)
js/questions.js     question bank — edit or add questions here
js/app.js           exam engine, results, statistics
STUDY_NOTES.md      condensed study notes and sources
```

### Adding questions

Append an object to `window.QUESTIONS` in `js/questions.js`:

```js
{ id: "d4-30", d: 4, type: "single",          // d = domain 1–8, type = single | multi
  q: "Question text…",
  o: ["Option A", "Option B", "Option C", "Option D"],
  a: [1],                                        // 0-based index(es) of the correct option(s)
  e: "Explanation shown in review." }
```

For `multi` questions, put "(Choose two.)" or "(Choose three.)" in the question text and list that many indexes in `a`. The exam takes questions from each domain in proportion to its weight. Settings such as the pass mark, duration and number of questions are in `CONFIG` at the top of `js/app.js`.

### Where results are stored

Results are kept in each browser's `localStorage`, so every person or browser has its own history. To build one combined report, have everyone use **Statistics → Export JSON**, then use **Import JSON** in one browser. Duplicate attempts are skipped automatically.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
cd acp420-quiz
python3 -m http.server 8000     # then open http://localhost:8000
```

## Push to GitHub

### Option A: new repository (recommended for hosting)

1. Create an empty repository on GitHub, for example `acp420-quiz`. Don't add a README, so the first push is clean.
2. In a terminal on your computer:

```bash
cd path/to/acp420-quiz
git init
git add .
git commit -m "ACP-420 practice exam site"
git branch -M main
git remote add origin https://github.com/egidijus-teambit/acp420-quiz.git
git push -u origin main
```

When git asks for a password, use a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens). GitHub no longer accepts account passwords for git. You can also use SSH: `git@github.com:egidijus-teambit/acp420-quiz.git`.

### Option B: add it to your existing `Jira` repository

```bash
git clone https://github.com/egidijus-teambit/Jira.git
cd Jira
mkdir -p acp420-quiz && cp -R path/to/acp420-quiz/* acp420-quiz/
git add acp420-quiz
git commit -m "Add ACP-420 practice exam site"
git push
```

## Host it

All of these work with plain static files:

| Host | How |
|---|---|
| **GitHub Pages** | Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save. The site appears at `https://egidijus-teambit.github.io/acp420-quiz/` within a minute or two. Pages on a **private** repo needs GitHub Pro/Team/Enterprise; on the free plan the repo must be public. For Option B, choose the root; the site is then at `…/Jira/acp420-quiz/`. |
| **Netlify** | Add new site → Import from GitHub → choose the repo. Leave the build command empty and set the publish directory to `/` (or `acp420-quiz`). |
| **Cloudflare Pages** | Create project → Connect to Git → Framework preset: *None*, build command empty, output directory `/`. |
| **Vercel** | Import the repo → Framework: *Other* → no build command. |

Every `git push` to `main` updates the hosted site automatically.

## Disclaimer

These are original practice questions written from Atlassian's public documentation and the official exam topics. They aren't real exam questions and aren't affiliated with Atlassian. Jira Cloud changes often, so check details against the current docs at support.atlassian.com.
