export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const { parsePdf } = await import('./parse-pdf');
    return parsePdf(file);
  }
  if (name.endsWith('.docx')) {
    const { parseDocx } = await import('./parse-docx');
    return parseDocx(file);
  }
  if (name.endsWith('.txt')) return file.text();
  throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
}
