import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const MODEL = 'gemini-2.5-flash';

const COVER_DELIM = '<<<COVER_LETTER>>>';

const SYSTEM_PROMPT = `You are an expert resume writer and career coach.
You will receive a candidate's existing resume and a job description, plus
optional company, role title, hiring-manager information, lists of TARGET
KEYWORDS (split into REQUIRED and NICE-TO-HAVE), and a FABRICATION POLICY.

═════════════════════════════════════════════════════════════════════════════
CRITICAL RULES (NON-NEGOTIABLE):
═════════════════════════════════════════════════════════════════════════════

1. PRESERVE THE ORIGINAL HEADER/CONTACT BLOCK:
   - If the original resume has a contact block (name, email, phone, LinkedIn,
     GitHub, etc.) at the very top, COPY IT VERBATIM to the output. This is
     the first section, before any "##" headings.

2. PRESERVE ALL EXISTING BULLETS AND ENRICH SPARSE ROLES:
   - NEVER drop, merge, or summarize away existing bullet points.
   - If a role originally had 8 bullets, the output must have AT LEAST 8 bullets.
   - EDIT, ENHANCE, and REORDER existing bullets, but always preserve the
     original substance. Example: "Reduced query time from 5s to 1s using
     Redis caching" stays; you might add "(evaluated 3 caching strategies)"
     but never reduce it to "Optimized caching."
   
   - IF A ROLE IS SPARSE (fewer than 4–5 bullets), INFER and ADD plausible
     accomplishments consistent with:
     * The job title, company type, and industry
     * The candidate's seniority level (inferred from other roles)
     * The JD requirements (infer what they likely did to succeed in that role)
     * The dates/tenure (longer tenure → more scope)
   - AIM FOR 6-8 BULLETS per role minimum. Each should include:
     * An action verb (built, led, improved, reduced, optimized, etc.)
     * The specific scope or technology (not generic)
     * A measurable outcome, business impact, or technical depth
   - Example: If original resume says "Software Engineer at TechCorp", infer
     and add: "Implemented microservices using Python & AWS Lambda, reducing
     deployment time from 2 hours to 10 minutes; owned 3 services in prod."

3. NEVER change employers, job titles, exact employment dates, or degrees.

4. STRICT FORMATTING:
   - **Contact header** (if present): lines like "Name | email | phone | linkedin"
   - **Professional Summary**: a paragraph or two; keep original voice
   - **## Skills**: break into subsections like "**Languages:** Python, TypeScript..."
     and "**Cloud:** AWS, Azure..." etc. Ensure each skill appears on its own
     line or grouped logically. NO run-on comma lists.
   - **## Experience**: EXACTLY one subsection per role, formatted as:
     \`### Title — Company *(City • Start–End)*\`
     Blank line, then 4-7+ bullet points (PRESERVE ORIGINALS), each starting
     with \`- \` (hyphen + space). NO nested bullet points.
   
   - **BULLET QUALITY RULES**: Each bullet should follow the pattern:
     [Action verb] [specific technology/scope] [measurable outcome/impact]
     Good: "Led design & implementation of real-time notification system using
            Redis & WebSockets, serving 2M+ daily active users"
     Bad: "Did backend work" or "Worked with databases"
   - Bullets should be 1-2 lines max, dense with specifics, free of buzzwords.
   
   - **## Education**: same structure
   - **## [Other sections]**: maintain original sections (Projects, Certifications, etc.)

5. WEAVING KEYWORDS:
   - REQUIRED keywords (top 10): MUST appear verbatim in the output. Weave them
     into existing bullets first. Only invent new bullets if a required keyword
     has no existing home.
   - NICE-TO-HAVE keywords: include if truthful/plausible and space permits.
     Do NOT force them or drop existing bullets to make room.

6. COVER LETTER:
   - ~250-350 words. Address the hiring manager by name (first name only) if
     given, else "Dear Hiring Team,". Reference company by name and tie
     specific JD requirements to claims from the TAILORED resume.
   - Use natural, conversational tone; no buzzword salad.

7. The user prompt will contain a FABRICATION POLICY block. Follow it literally.

═════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT — RAW MARKDOWN ONLY, NO JSON, NO CODE FENCES:
═════════════════════════════════════════════════════════════════════════════

<resume markdown using ## headings for sections>

${COVER_DELIM}

<cover letter markdown>

The literal token "${COVER_DELIM}" MUST appear on its own line between the
two documents. Output nothing before the resume and nothing after the cover
letter.`;

interface Recipient {
  name?: string;
  title?: string;
}

interface Body {
  resumeText?: string;
  jobDescription?: string;
  tone?: string;
  company?: string;
  role?: string;
  recipient?: Recipient;
  keywords?: string[];
  /** 0-100. Higher = more aggressive fabrication. */
  targetAts?: number;
}

function fabricationPolicy(target: number, requiredKwCount: number, niceToHaveKwCount: number): string {
  const t = Math.max(0, Math.min(100, Math.round(target)));
  const total = requiredKwCount + niceToHaveKwCount;
  if (t >= 95) {
    return [
      `FABRICATION POLICY: AGGRESSIVE (target ATS ${t}/100).`,
      `- All ${requiredKwCount} REQUIRED keywords MUST appear verbatim in the resume.`,
      `- The ${niceToHaveKwCount} NICE-TO-HAVE keywords are optional; include them only if you can`,
      `  weave them into existing bullets or Skills without dropping original content.`,
      `- If the candidate has no truthful basis for a REQUIRED keyword, INVENT a`,
      `  plausible side project, internal initiative, proof of concept, or`,
      `  responsibility within an EXISTING role. Keep invented details consistent`,
      `  with the candidate's seniority and domain.`,
      `- You MAY claim hands-on proficiency with any tool/framework in the JD.`,
      `- NEVER change employers, titles, dates, schools, or degrees.`,
      `- PRESERVE ALL existing bullets; do not summarize or drop them.`,
      `- For sparse roles, generously infer and add 4-6 details that align with`,
      `  the role title, company context, and JD. Be creative but plausible.`,
      `- The cover letter must echo the strongest 5-8 REQUIRED keywords and`,
      `  reference at least two specific JD requirements.`,
    ].join('\n');
  }
  if (t >= 80) {
    return [
      `FABRICATION POLICY: STRONG (target ATS ${t}/100).`,
      `- All ${requiredKwCount} REQUIRED keywords should appear verbatim.`,
      `- Treat NICE-TO-HAVE keywords the candidate could plausibly know as`,
      `  familiar; surface verbatim if space and truthfulness permit.`,
      `- You MAY add 1-2 plausible side projects or internal initiatives to`,
      `  cover missing REQUIRED keywords — keep them realistic.`,
      `- Do NOT invent customers, revenue numbers, or awards.`,
      `- PRESERVE ALL existing bullets and accomplishments.`,
      `- For sparse roles, infer and add 3-5 plausible accomplishments that`,
      `  are reasonable for the role title, company scale, and seniority.`,
    ].join('\n');
  }
  if (t >= 60) {
    return [
      `FABRICATION POLICY: LIGHT STRETCH (target ATS ${t}/100).`,
      `- Weave all ${requiredKwCount} REQUIRED keywords verbatim where truthful/plausible.`,
      `- Include NICE-TO-HAVE keywords only where they fit naturally into`,
      `  existing bullets or the Skills section without dropping content.`,
      `- Prefer paraphrasing existing bullets to add keywords rather than`,
      `  inventing new ones.`,
      `- PRESERVE ALL existing bullets and accomplishments.`,
      `- For sparse roles, infer and add 2-4 plausible details grounded in the`,
      `  candidate's seniority, the role title, and typical scope.`,
    ].join('\n');
  }
  return [
    `FABRICATION POLICY: STRICT (target ATS ${t}/100).`,
    `- Keep ALL facts truthful. Do NOT invent employers, titles, dates,`,
    `  metrics, or accomplishments.`,
    `- Include a REQUIRED keyword verbatim only if the existing resume`,
    `  already supports that claim. NICE-TO-HAVE keywords are extra; skip them`,
    `  if not already truthful.`,
    `- PRESERVE ALL existing bullets and accomplishments.`,
    `- For sparse roles (< 4 bullets), infer and add reasonable accomplishments`,
    `  based on the role title, company type, and seniority — but only details`,
    `  that would be typical/expected for that role. No fabricated metrics.`,
  ].join('\n');
}

function buildPrompt(b: Body): string {
  const kws = (b.keywords || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 40);
  // Split: first 10 are REQUIRED, rest are NICE-TO-HAVE
  const requiredKws = kws.slice(0, 10);
  const niceToHaveKws = kws.slice(10);
  const policy = fabricationPolicy(
    typeof b.targetAts === 'number' ? b.targetAts : 50,
    requiredKws.length,
    niceToHaveKws.length
  );
  const parts: (string | null)[] = [
    `Tone: ${(b.tone || 'professional').trim()}`,
    b.company ? `Company: ${b.company.trim()}` : null,
    b.role ? `Target role: ${b.role.trim()}` : null,
    b.recipient?.name
      ? `Hiring manager: ${b.recipient.name.trim()}${
          b.recipient.title ? ` (${b.recipient.title.trim()})` : ''
        }`
      : null,
    '',
    policy,
    requiredKws.length
      ? `\n=== REQUIRED TARGET KEYWORDS (must appear verbatim) ===\n${requiredKws.join(', ')}`
      : null,
    niceToHaveKws.length
      ? `\n=== NICE-TO-HAVE KEYWORDS (include if truthful/plausible) ===\n${niceToHaveKws.join(', ')}`
      : null,
    '',
    '=== EXISTING RESUME ===',
    (b.resumeText || '').trim(),
    '',
    '=== JOB DESCRIPTION ===',
    (b.jobDescription || '').trim(),
  ];
  return parts.filter((l) => l !== null).join('\n');
}

export const generate = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = (req.body || {}) as Body;
    const resumeText = (body.resumeText || '').trim();
    const jobDescription = (body.jobDescription || '').trim();

    if (resumeText.length < 50 || jobDescription.length < 30) {
      res.status(400).json({ error: 'Resume or job description too short.' });
      return;
    }
    if (resumeText.length > 30000 || jobDescription.length > 15000) {
      res.status(413).json({ error: 'Input too large.' });
      return;
    }

    const wantsStream =
      req.query.stream === '1' ||
      req.headers['accept']?.toString().includes('text/plain');

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          // Plain text streaming, not JSON
          temperature: 0.6,
        },
      });

      const userPrompt = buildPrompt(body);

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const result = await model.generateContentStream(userPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            res.write(text);
            // Flush is best-effort; only present when compression middleware adds it.
            (res as unknown as { flush?: () => void }).flush?.();
          }
        }
        res.end();
        return;
      }

      // Non-streaming fallback (collects then sends JSON)
      const result = await model.generateContent(userPrompt);
      const full = result.response.text();
      const idx = full.indexOf(COVER_DELIM);
      if (idx < 0) {
        res.status(502).json({
          error: 'Model response missing cover letter delimiter.',
          raw: full.substring(0, 200),
        });
        return;
      }
      const resume = full.substring(0, idx).trim();
      const coverLetter = full.substring(idx + COVER_DELIM.length).trim();
      res.json({ resume, coverLetter });
    } catch (err) {
      const e = err as { message?: string };
      console.error('generate error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: e?.message || 'Internal error' });
      } else {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
    }
  }
);

// ---------- Job description URL fetcher ----------

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc00:|fd00:|fe80:|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i;

export const fetchJd = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    const rawUrl =
      req.method === 'GET'
        ? (req.query.url as string | undefined)
        : (req.body?.url as string | undefined);
    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).json({ error: 'Missing url' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Only http(s) URLs are supported' });
      return;
    }
    if (PRIVATE_HOST_RE.test(parsed.hostname)) {
      res.status(403).json({ error: 'Refusing to fetch private host' });
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ResumeTailorBot/1.0; +https://resume-tailor-pingisi.web.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok) {
        res
          .status(502)
          .json({ error: `Upstream returned ${upstream.status}` });
        return;
      }
      const ct = upstream.headers.get('content-type') || '';
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        res.status(415).json({ error: `Unsupported content type: ${ct}` });
        return;
      }
      const html = await upstream.text();
      if (html.length > 2_000_000) {
        res.status(413).json({ error: 'Page too large' });
        return;
      }

      const $ = cheerio.load(html);
      $(
        'script, style, noscript, nav, header, footer, aside, form, button, iframe, svg'
      ).remove();

      // Try to focus on likely main JD container, else fall back to body.
      const candidates = [
        'main',
        'article',
        '[role="main"]',
        '.job-description',
        '#job-description',
        '.jobDescriptionText',
        '#jobDescriptionText',
        '.description__text',
        '.posting-content',
      ];
      let root = $();
      for (const sel of candidates) {
        const el = $(sel).first();
        if (el.length && el.text().trim().length > 200) {
          root = el;
          break;
        }
      }
      if (root.length === 0) root = $('body');

      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('title').first().text() ||
        '';

      const text = root
        .text()
        .replace(/\r/g, '')
        .replace(/[\t\u00a0]+/g, ' ')
        .replace(/[ ]{2,}/g, ' ')
        .replace(/\n[ ]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .substring(0, 12000);

      // Heuristic: detect placeholder "this job is filled / expired" pages so
      // the client can warn the user before pasting them into the JD field.
      const lower = text.toLowerCase();
      const expiredPatterns: RegExp[] = [
        /job (you are|you're) (trying to apply for|looking for) has been (filled|closed|removed)/,
        /this (job|position|posting|opportunity|role|requisition) (has been|is no longer|is now) (filled|closed|removed|expired|unavailable|available)/,
        /no longer (accepting|available|active|open)/,
        /this (job|position|posting) is no longer/,
        /sorry,? this (job|posting|position)/,
        /position has been (filled|closed)/,
        /requisition .{0,20}(closed|filled|expired)/,
        /we['’]re sorry/,
      ];
      let warning: string | undefined;
      const matched = expiredPatterns.find((re) => re.test(lower));
      if (matched) {
        warning =
          'This page looks like a "job filled / no longer available" notice rather than an active posting.';
      } else if (text.length < 400) {
        warning =
          `Only extracted ${text.length} characters — the page may require JavaScript or login. Check the result before generating.`;
      }

      res.json({ title: title.trim(), text, warning });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        res.status(504).json({ error: 'Upstream timed out' });
        return;
      }
      console.error('fetchJd error', err);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  }
);

// ---------- Interview prep ----------

const INTERVIEW_SYSTEM_PROMPT = `You are an expert interview coach.
Given a candidate's resume and a job description, produce a focused interview
prep guide of 10-12 likely questions across these categories:

- "technical"     (max ~5) — hands-on skills the JD requires
- "behavioral"    (max ~3) — STAR-style soft-skill / leadership questions
- "role-specific" (max ~3) — scenarios tied to the company/team/product
- "culture"       (max ~2) — values, working-style, motivation questions

For EACH question, return:
- "category": one of the four strings above
- "question": the question text
- "why": ONE sentence on why an interviewer would ask this for THIS role
- "talkingPoints": 2-4 short bullet points the candidate could use as an
   answer, drawn from their ACTUAL resume. NEVER invent experiences the
   resume does not contain. If the resume lacks coverage, write a bullet
   like "Acknowledge gap and connect to closest adjacent experience: ..."

Return STRICT JSON of this exact shape and nothing else:
{
  "questions": [
    {
      "category": "technical|behavioral|role-specific|culture",
      "question": "...",
      "why": "...",
      "talkingPoints": ["...", "..."]
    }
  ]
}`;

interface InterviewBody {
  resumeText?: string;
  jobDescription?: string;
  company?: string;
  role?: string;
}

export const prepareInterview = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = (req.body || {}) as InterviewBody;
    const resumeText = (body.resumeText || '').trim();
    const jobDescription = (body.jobDescription || '').trim();
    const company = (body.company || '').trim();
    const role = (body.role || '').trim();

    if (resumeText.length < 50 || jobDescription.length < 30) {
      res.status(400).json({ error: 'Resume or job description too short.' });
      return;
    }
    if (resumeText.length > 30000 || jobDescription.length > 15000) {
      res.status(413).json({ error: 'Input too large.' });
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: INTERVIEW_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.5,
        },
      });

      const lines: (string | null)[] = [
        company ? `Company: ${company}` : null,
        role ? `Target role: ${role}` : null,
        '',
        '=== CANDIDATE RESUME ===',
        resumeText,
        '',
        '=== JOB DESCRIPTION ===',
        jobDescription,
      ];
      const prompt = lines.filter((l) => l !== null).join('\n');

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed: { questions?: unknown };
      try {
        parsed = JSON.parse(text);
      } catch {
        res.status(502).json({ error: 'Model returned non-JSON.', raw: text.substring(0, 200) });
        return;
      }

      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (questions.length === 0) {
        res.status(502).json({ error: 'Model returned no questions.' });
        return;
      }
      res.json({ questions });
    } catch (err) {
      const e = err as { message?: string };
      console.error('prepareInterview error', err);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  }
);

// ---------- Answer screening questions ----------

const ANSWER_SYSTEM_PROMPT = `You are an expert job application assistant.
The user is filling out an application's screening questions and needs
ready-to-paste answers tailored to a specific role.

You will receive:
- A PROFILE: facts the user has pre-written about themselves (contact, work
  auth, salary, elevator pitch, plus any custom Q&A pairs they've saved).
- ROLE CONTEXT (optional): company, role title, job description, and the
  tailored resume that was generated for this application.
- QUESTIONS: a list of screening / application form questions to answer.

For each question, write a single concise answer the user can paste directly
into the application form.

RULES:
- Use facts from the PROFILE first. If the user has a custom Q&A whose
  question is similar to the asked one, use that answer almost verbatim
  (lightly adapted to the role).
- If the question maps to a profile field (notice period, salary, work auth,
  location, years of experience, links, name, email, phone) — answer with
  that field's value directly, no prose padding. If the field is blank,
  answer "Prefer to discuss" or the closest neutral placeholder.
- For open-ended questions (Why this company, Tell us about yourself, etc.),
  weave the elevator pitch + JD specifics into 2-5 sentences. First person,
  natural tone, no buzzword salad, no "I am thrilled" openers.
- Never invent employers, dates, schools, certifications, or numbers the
  profile/resume do not contain. You MAY invent a brief plausible reason or
  motivation when the question asks for one.
- Keep each answer self-contained — do not refer to "see my resume".
- Match the length to the question: yes/no answers stay 1-2 words, short
  prompts get 1-2 sentences, motivational essays get 3-5 sentences. Never
  more than ~120 words.

Return STRICT JSON of this exact shape and nothing else:
{
  "answers": [
    { "question": "<echo the question>", "answer": "<your answer>" }
  ]
}`;

interface AnswerBody {
  profile?: Record<string, unknown> & {
    customAnswers?: { question?: string; answer?: string }[];
  };
  company?: string;
  role?: string;
  jobDescription?: string;
  tailoredResume?: string;
  questions?: string[];
}

export const answerQuestions = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = (req.body || {}) as AnswerBody;
    const profile = body.profile || {};
    const questions = Array.isArray(body.questions)
      ? body.questions
          .map((q) => (typeof q === 'string' ? q.trim() : ''))
          .filter((q) => q.length > 0)
      : [];
    if (questions.length === 0) {
      res.status(400).json({ error: 'No questions provided.' });
      return;
    }
    if (questions.length > 30) {
      res.status(413).json({ error: 'Too many questions (max 30).' });
      return;
    }

    const company = (body.company || '').trim();
    const role = (body.role || '').trim();
    const jd = (body.jobDescription || '').trim().slice(0, 12000);
    const resume = (body.tailoredResume || '').trim().slice(0, 20000);

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: ANSWER_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      });

      const lines: (string | null)[] = [
        '=== PROFILE ===',
        JSON.stringify(profile, null, 2),
        '',
        company ? `Company: ${company}` : null,
        role ? `Target role: ${role}` : null,
        resume ? '\n=== TAILORED RESUME ===\n' + resume : null,
        jd ? '\n=== JOB DESCRIPTION ===\n' + jd : null,
        '',
        '=== QUESTIONS ===',
        ...questions.map((q, i) => `${i + 1}. ${q}`),
      ];
      const prompt = lines.filter((l) => l !== null).join('\n');

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed: { answers?: unknown };
      try {
        parsed = JSON.parse(text);
      } catch {
        res
          .status(502)
          .json({ error: 'Model returned non-JSON.', raw: text.substring(0, 200) });
        return;
      }

      const answers = Array.isArray(parsed.answers) ? parsed.answers : [];
      if (answers.length === 0) {
        res.status(502).json({ error: 'Model returned no answers.' });
        return;
      }
      res.json({ answers });
    } catch (err) {
      const e = err as { message?: string };
      console.error('answerQuestions error', err);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  }
);

// ---------- Compose follow-up / thank-you / recruiter DM ----------

type MessageKind = 'follow-up' | 'thank-you' | 'recruiter-dm';

const MESSAGE_SYSTEM_PROMPT = `You are an expert job-search writing assistant.
You will be given a message KIND, context about an application, and the
candidate's profile. Produce ONE short, paste-ready message.

KIND rules:

- "follow-up"   — Polite, confident email to the recruiter/hiring manager
                  after the candidate has applied. 3-4 sentences. Reaffirm
                  interest, note ONE specific qualification that maps to the
                  role, ask about timing. Include a short subject line like
                  "Following up — <role> application". Sign as the candidate.
                  If \`daysSinceApplied\` is small (<5) keep it lighter; if it
                  is larger, acknowledge the wait briefly.

- "thank-you"   — Warm, professional email sent after an interview. 3-5
                  sentences. Thank them for the time, reference one topic that
                  came up (you can be slightly generic if no topic is given),
                  reiterate interest, signal next steps. Subject like
                  "Thank you — <role> interview". Sign as the candidate.

- "recruiter-dm" — LinkedIn-style DM, NO subject line. 2-3 sentences max,
                  conversational. Lead with the role applied for, ONE concrete
                  reason you're a fit, ask if there is a fit. No greeting like
                  "Dear", just "Hi <name>" if name available, else "Hi there".

GLOBAL RULES:
- Use first person. Natural, human tone. NO buzzword salad ("synergize",
  "leverage", "passionate ninja").
- NEVER invent employers, schools, certs, dates, numbers. You MAY allude to
  responsibilities the resume actually shows.
- If recipient name is given, address them by first name only.
- Sign with the candidate's first name (or full name if first not obvious).
- Keep \`body\` plain text with single blank-line paragraph breaks. No
  markdown, no bullet lists.

Return STRICT JSON of this exact shape and nothing else:
{
  "subject": "<subject line, or empty string for recruiter-dm>",
  "body": "<the message body>"
}`;

interface ComposeBody {
  kind?: MessageKind;
  profile?: Record<string, unknown>;
  company?: string;
  role?: string;
  jobDescription?: string;
  tailoredResume?: string;
  recipient?: { name?: string; title?: string };
  appliedAt?: number;
  daysSinceApplied?: number;
  extra?: string;
}

export const composeMessage = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 90,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = (req.body || {}) as ComposeBody;
    const kind = body.kind;
    if (kind !== 'follow-up' && kind !== 'thank-you' && kind !== 'recruiter-dm') {
      res.status(400).json({ error: 'Invalid or missing kind.' });
      return;
    }

    const company = (body.company || '').trim();
    const role = (body.role || '').trim();
    const jd = (body.jobDescription || '').trim().slice(0, 8000);
    const resume = (body.tailoredResume || '').trim().slice(0, 12000);
    const extra = (body.extra || '').trim().slice(0, 1000);
    const recipient = body.recipient || {};
    const profile = body.profile || {};
    const days =
      typeof body.daysSinceApplied === 'number'
        ? Math.max(0, Math.round(body.daysSinceApplied))
        : null;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: MESSAGE_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      });

      const lines: (string | null)[] = [
        `KIND: ${kind}`,
        company ? `Company: ${company}` : null,
        role ? `Role: ${role}` : null,
        recipient.name ? `Recipient name: ${recipient.name}` : null,
        recipient.title ? `Recipient title: ${recipient.title}` : null,
        days !== null ? `Days since applied: ${days}` : null,
        extra ? `\nExtra guidance from candidate: ${extra}` : null,
        '\n=== CANDIDATE PROFILE ===',
        JSON.stringify(profile, null, 2),
        resume ? '\n=== TAILORED RESUME ===\n' + resume : null,
        jd ? '\n=== JOB DESCRIPTION ===\n' + jd : null,
      ];
      const prompt = lines.filter((l) => l !== null).join('\n');

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed: { subject?: unknown; body?: unknown };
      try {
        parsed = JSON.parse(text);
      } catch {
        res.status(502).json({
          error: 'Model returned non-JSON.',
          raw: text.substring(0, 200),
        });
        return;
      }

      const out = {
        subject: typeof parsed.subject === 'string' ? parsed.subject : '',
        body: typeof parsed.body === 'string' ? parsed.body : '',
      };
      if (!out.body) {
        res.status(502).json({ error: 'Model returned no body.' });
        return;
      }
      res.json(out);
    } catch (err) {
      const e = err as { message?: string };
      console.error('composeMessage error', err);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  }
);

// ---------- Fit score (triage helper) ----------

const FIT_SCORE_SYSTEM_PROMPT = `You are a no-nonsense hiring-bar evaluator.
Given a candidate's resume and a target job description, judge whether the
candidate should spend time tailoring + applying.

Score 1-10:
  1-3  poor match (probably skip)
  4-6  partial match (apply only if the candidate can hide gaps well)
  7-8  strong match
  9-10 excellent match (apply with confidence)

Be calibrated and slightly conservative. Do NOT inflate scores.

Return STRICT JSON of this exact shape and nothing else:
{
  "score": <integer 1-10>,
  "verdict": "<one short sentence summarising the call to action>",
  "reasonsToApply": ["<concrete reason 1>", "<reason 2>", "<reason 3>"],
  "gapsToAddress": ["<gap or risk 1>", "<gap or risk 2>"]
}

Rules:
- Each \`reasonsToApply\` item must reference SOMETHING ACTUALLY IN THE RESUME
  that maps to the JD (skill, project, years, domain). Be specific.
- Each \`gapsToAddress\` item must be a real missing thing the JD asks for that
  the resume lacks. If there are no real gaps, return an empty array (do not
  invent gaps).
- Never invent candidate experience or fabricate accomplishments.`;

interface FitBody {
  resumeText?: string;
  jobDescription?: string;
  company?: string;
  role?: string;
}

export const scoreFit = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = (req.body || {}) as FitBody;
    const resumeText = (body.resumeText || '').trim();
    const jobDescription = (body.jobDescription || '').trim();
    if (resumeText.length < 50 || jobDescription.length < 30) {
      res.status(400).json({ error: 'Resume or job description too short.' });
      return;
    }
    if (resumeText.length > 30000 || jobDescription.length > 15000) {
      res.status(413).json({ error: 'Input too large.' });
      return;
    }

    const company = (body.company || '').trim();
    const role = (body.role || '').trim();

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: FIT_SCORE_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const lines: (string | null)[] = [
        company ? `Company: ${company}` : null,
        role ? `Target role: ${role}` : null,
        '',
        '=== CANDIDATE RESUME ===',
        resumeText,
        '',
        '=== JOB DESCRIPTION ===',
        jobDescription,
      ];
      const prompt = lines.filter((l) => l !== null).join('\n');

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed: {
        score?: unknown;
        verdict?: unknown;
        reasonsToApply?: unknown;
        gapsToAddress?: unknown;
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        res
          .status(502)
          .json({ error: 'Model returned non-JSON.', raw: text.substring(0, 200) });
        return;
      }

      const rawScore =
        typeof parsed.score === 'number' ? Math.round(parsed.score) : NaN;
      const score = Math.max(1, Math.min(10, isFinite(rawScore) ? rawScore : 0));
      if (!score) {
        res.status(502).json({ error: 'Model returned no score.' });
        return;
      }
      const out = {
        score,
        verdict: typeof parsed.verdict === 'string' ? parsed.verdict : '',
        reasonsToApply: Array.isArray(parsed.reasonsToApply)
          ? parsed.reasonsToApply.filter((s): s is string => typeof s === 'string')
          : [],
        gapsToAddress: Array.isArray(parsed.gapsToAddress)
          ? parsed.gapsToAddress.filter((s): s is string => typeof s === 'string')
          : [],
      };
      res.json(out);
    } catch (err) {
      const e = err as { message?: string };
      console.error('scoreFit error', err);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  }
);
