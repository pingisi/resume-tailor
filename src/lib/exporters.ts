import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, ensureExt(filename, '.md'));
}

export function downloadPdf(filename: string, content: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  let y = margin;
  const paragraphs = content.split(/\n+/);
  for (const para of paragraphs) {
    const isHeading = /^#{1,6}\s/.test(para);
    const text = isHeading ? para.replace(/^#{1,6}\s/, '') : para;
    if (isHeading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    }
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 6;
  }

  doc.save(ensureExt(filename, '.pdf'));
}

export async function downloadDocx(filename: string, content: string) {
  const paragraphs = content.split(/\n+/).map((line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
      return new Paragraph({
        heading,
        children: [new TextRun({ text: headingMatch[2], bold: true })],
      });
    }
    return new Paragraph({ children: [new TextRun(line)] });
  });

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, ensureExt(filename, '.docx'));
}

function ensureExt(name: string, ext: string) {
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}
