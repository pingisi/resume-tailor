export interface Section {
  id: string;
  level: number;
  title: string;
  body: string;
}

/**
 * Split markdown into sections delimited by `## ` headings. Any content before
 * the first heading becomes a synthetic "Header" section (level 1).
 */
export function splitSections(md: string): Section[] {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;
  let prelude: string[] = [];
  let idx = 0;

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*?)\s*$/.exec(line);
    if (m && m[1].length <= 2) {
      // start a new section on level 1 (#) or level 2 (##) headings
      if (current) {
        current.body = current.body.replace(/\s+$/, '');
        sections.push(current);
      } else if (prelude.length) {
        sections.push({
          id: `prelude-${idx++}`,
          level: 0,
          title: 'Header',
          body: prelude.join('\n').trim(),
        });
        prelude = [];
      }
      current = {
        id: `s-${idx++}`,
        level: m[1].length,
        title: m[2],
        body: '',
      };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    } else {
      prelude.push(line);
    }
  }
  if (current) {
    current.body = current.body.replace(/\s+$/, '');
    sections.push(current);
  } else if (prelude.length) {
    sections.push({
      id: `prelude-${idx++}`,
      level: 0,
      title: 'Header',
      body: prelude.join('\n').trim(),
    });
  }
  return sections;
}

export function joinSections(sections: Section[]): string {
  return sections
    .map((s) => {
      if (s.level === 0) return s.body;
      const hash = '#'.repeat(Math.max(1, s.level));
      return `${hash} ${s.title}\n\n${s.body}`.trim();
    })
    .join('\n\n');
}
