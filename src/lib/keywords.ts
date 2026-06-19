/**
 * Lightweight ATS keyword scoring.
 * Tokenizes a job description, extracts the most important terms (single
 * words and short phrases), and checks how many appear in the tailored
 * resume. Pure client-side — no AI calls.
 */

const STOP_WORDS = new Set<string>([
  'a', 'an', 'and', 'or', 'but', 'the', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did',
  'doing', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'cannot', 'this', 'that', 'these', 'those', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'them', 'their', 'his', 'her', 'its',
  'our', 'your', 'me', 'us', 'my', 'mine', 'yours', 'theirs', 'ours',
  'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'up', 'down', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'don', 'now', 'as', 'if', 'because', 'while', 'until', 'against', 'among',
  'who', 'whom', 'which', 'what', 'whose',
  // Job-description noise
  'role', 'job', 'work', 'team', 'company', 'opportunity', 'opportunities',
  'including', 'include', 'includes', 'use', 'uses', 'used', 'using',
  'within', 'across', 'also', 'plus', 'etc', 'ability', 'able', 'help',
  'helps', 'looking', 'seeking', 'seek', 'great', 'good', 'best', 'well',
  'level', 'years', 'year', 'experience', 'experiences', 'required',
  'requirement', 'requirements', 'preferred', 'desired', 'must', 'plus',
  'qualifications', 'qualification', 'responsibilities', 'responsibility',
  'duties', 'duty', 'tasks', 'task', 'description', 'overview', 'summary',
  'position', 'positions', 'candidate', 'candidates', 'applicant', 'apply',
  'employer', 'employees', 'employee', 'staff', 'member', 'members',
  'people', 'person', 'one', 'two', 'three', 'four', 'five',
  'work', 'working', 'works', 'worked', 'environment', 'minimum', 'maximum',
  'and/or', 'eg', 'ie', 'per', 'via',
]);

const TOKEN_RE = /[a-zA-Z][a-zA-Z0-9+#./\-]{1,}/g;

export interface AtsResult {
  score: number;
  matched: string[];
  missing: string[];
  total: number;
}

export function extractKeywords(jobDescription: string, limit = 25): string[] {
  if (!jobDescription) return [];

  // Single-word frequency
  const counts = new Map<string, number>();
  const tokens = (jobDescription.match(TOKEN_RE) || []).map((t) => t.toLowerCase());
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOP_WORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  // Boost capitalized multi-word phrases (likely tools, frameworks, proper nouns)
  const phraseRe =
    /\b[A-Z][A-Za-z0-9+#./\-]+(?:\s+[A-Z][A-Za-z0-9+#./\-]+){1,2}\b/g;
  const phraseMatches = jobDescription.match(phraseRe) || [];
  for (const p of phraseMatches) {
    const k = p.trim().toLowerCase();
    if (k.length < 5) continue;
    counts.set(k, (counts.get(k) || 0) + 4);
  }

  // Boost common tech tokens with punctuation that the basic tokenizer might split.
  // (TOKEN_RE already supports + # . / - so most pass through.)

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

export function scoreAgainstResume(
  keywords: string[],
  resume: string
): AtsResult {
  const r = (resume || '').toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (r.includes(k)) matched.push(k);
    else missing.push(k);
  }
  const score =
    keywords.length === 0
      ? 100
      : Math.round((matched.length / keywords.length) * 100);
  return { score, matched, missing, total: keywords.length };
}

export function ats(jobDescription: string, resume: string, limit = 25): AtsResult {
  return scoreAgainstResume(extractKeywords(jobDescription, limit), resume);
}
