import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return parsePdf(file);
  if (name.endsWith('.docx')) return parseDocx(file);
  if (name.endsWith('.txt')) return file.text();
  throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
}

async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ');
    parts.push(pageText);
  }
  return parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}

async function parseDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}
