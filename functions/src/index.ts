import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const MODEL = 'gemini-2.5-flash';

const COVER_DELIM = '<<<COVER_LETTER>>>';

const SYSTEM_PROMPT = `You are an expert resume writer and career coach.
You will receive a candidate's existing resume and a job description, plus
optional company, role title, hiring-manager information, a list of target
keywords extracted from the job description, and a FABRICATION POLICY that
tells you how aggressively to embellish.

Ground rules (apply at every fabrication level):
- NEVER change employers, job titles, employment dates, schools, or degrees.
- ALWAYS keep every job and project from the original resume — do not drop
  older roles. Each role gets 4-7 detailed bullet points covering scope,
  technologies, collaboration, and outcomes.
- Structure the resume as: short professional summary, then "## Skills"
  (compact, comma-separated or bulleted), then "## Experience" with one
  subsection per role "### Role — Company (dates)", then "## Education" and
  any other original sections.
- Use the candidate's pronouns/voice consistently.
- The cover letter (~250-350 words) addresses the hiring manager by name if
  given, else "Dear Hiring Team,". Reference the company by name when known
  and tie specific JD requirements to claims made in the resume.

The user prompt will contain a FABRICATION POLICY block. Follow it literally.

Output format — RAW MARKDOWN ONLY, NO JSON, NO CODE FENCES:

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

function fabricationPolicy(target: number, kwCount: number): string {
  const t = Math.max(0, Math.min(100, Math.round(target)));
  if (t >= 95) {
    return [
      `FABRICATION POLICY: AGGRESSIVE (target ATS ${t}/100).`,
      `- Every single keyword in the TARGET KEYWORDS list MUST appear verbatim`,
      `  in the resume (in bullets, the Summary, or the Skills section). All`,
      `  ${kwCount} keywords are required.`,
      `- If the candidate has no truthful basis for a keyword, INVENT a`,
      `  plausible side project, internal initiative, proof of concept, or`,
      `  responsibility within an EXISTING role that uses that technology.`,
      `  Keep the invented detail consistent with the candidate's seniority`,
      `  and domain.`,
      `- You MAY claim hands-on proficiency with any tool, framework, or`,
      `  methodology mentioned in the JD.`,
      `- You MUST NOT change employers, titles, dates, schools, or degrees.`,
      `- The cover letter must echo the strongest 5-8 keywords verbatim and`,
      `  reference at least two specific JD requirements.`,
    ].join('\n');
  }
  if (t >= 80) {
    return [
      `FABRICATION POLICY: STRONG (target ATS ${t}/100).`,
      `- Treat every keyword the candidate could plausibly know (based on`,
      `  their general domain and seniority) as truly familiar; surface it`,
      `  verbatim in a bullet or the Skills section.`,
      `- You MAY add 1-2 plausible side projects or internal initiatives to`,
      `  cover the most important missing keywords — keep them realistic.`,
      `- Do NOT invent named customers, specific revenue numbers, or awards.`,
      `- Do NOT change employers, titles, dates, schools, or degrees.`,
    ].join('\n');
  }
  if (t >= 60) {
    return [
      `FABRICATION POLICY: LIGHT STRETCH (target ATS ${t}/100).`,
      `- Where the candidate's background plausibly touches a keyword,`,
      `  surface that keyword verbatim. Prefer paraphrasing existing bullets`,
      `  to add the keyword over inventing new ones.`,
      `- Do NOT add new projects, customers, metrics, or technologies the`,
      `  candidate has no evidence of having used.`,
    ].join('\n');
  }
  return [
    `FABRICATION POLICY: STRICT (target ATS ${t}/100).`,
    `- Keep ALL facts truthful. Do NOT invent employers, titles, dates,`,
    `  metrics, technologies, customers, or accomplishments.`,
    `- Only include a keyword verbatim if the candidate's existing resume`,
    `  already supports that claim.`,
  ].join('\n');
}

function buildPrompt(b: Body): string {
  const kws = (b.keywords || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 40);
  const policy = fabricationPolicy(
    typeof b.targetAts === 'number' ? b.targetAts : 50,
    kws.length
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
    kws.length
      ? `\n=== TARGET KEYWORDS ===\n${kws.join(', ')}`
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

      res.json({ title: title.trim(), text });
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
