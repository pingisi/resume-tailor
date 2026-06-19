import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfTextItem {
  str?: string;
}

export async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfTextItem[])
      .map((it) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ');
    parts.push(pageText);
  }
  return parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}
