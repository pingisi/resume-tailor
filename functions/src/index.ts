import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are an expert resume writer and career coach.
You will receive a candidate's existing resume and a job description.
Your task:
1. Produce a tailored version of the resume that emphasizes the experience,
   skills, and accomplishments most relevant to the job description. Keep ALL
   facts truthful — do NOT invent employers, titles, dates, degrees, or
   metrics. You may rephrase, reorder, and re-emphasize.
2. Produce a matching cover letter (~250-350 words) addressed to the hiring
   team, referencing specific requirements from the job description and how
   the candidate's background meets them.

Return STRICT JSON with this shape and nothing else:
{
  "resume": "<markdown resume>",
  "coverLetter": "<markdown cover letter>"
}
Use clean Markdown headings (##) for resume sections.`;

interface Body {
  resumeText?: string;
  jobDescription?: string;
  tone?: string;
}

export const generate = onRequest(
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

    const body = (req.body || {}) as Body;
    const resumeText = (body.resumeText || '').trim();
    const jobDescription = (body.jobDescription || '').trim();
    const tone = (body.tone || 'professional').trim();

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
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      });

      const userPrompt = [
        `Tone: ${tone}`,
        '',
        '=== EXISTING RESUME ===',
        resumeText,
        '',
        '=== JOB DESCRIPTION ===',
        jobDescription,
      ].join('\n');

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();

      let parsed: { resume?: string; coverLetter?: string };
      try {
        parsed = JSON.parse(text);
      } catch {
        res.status(502).json({ error: 'Model returned non-JSON.', raw: text });
        return;
      }

      if (!parsed.resume || !parsed.coverLetter) {
        res.status(502).json({ error: 'Model response missing fields.' });
        return;
      }

      res.json({ resume: parsed.resume, coverLetter: parsed.coverLetter });
    } catch (err: any) {
      console.error('generate error', err);
      res.status(500).json({ error: err?.message || 'Internal error' });
    }
  }
);
