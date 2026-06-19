import jsPDF from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Token, Tokens } from 'marked';
import { flattenInline, lex, segmentsToWords, type InlineSegment } from './markdown';
import type { Template } from './templates';

// ---------- Markdown (plain) ----------

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, ensureExt(filename, '.md'));
}

// ---------- PDF ----------

export function downloadPdf(filename: string, content: string, tpl: Template) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const innerWidth = pageWidth - tpl.margins.left - tpl.margins.right;

  let y = tpl.margins.top;
  const tokens = lex(content);

  for (const token of tokens) {
    y = renderBlock(doc, token, tpl, y, pageHeight, innerWidth);
  }

  doc.save(ensureExt(filename, '.pdf'));
}

function ensurePage(
  doc: jsPDF,
  y: number,
  needed: number,
  pageHeight: number,
  topMargin: number
): number {
  if (y + needed > pageHeight - topMargin) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

function renderBlock(
  doc: jsPDF,
  token: Token,
  tpl: Template,
  y: number,
  pageHeight: number,
  innerWidth: number
): number {
  switch (token.type) {
    case 'heading':
      return renderHeading(doc, token as Tokens.Heading, tpl, y, pageHeight, innerWidth);
    case 'paragraph':
      return renderParagraph(
        doc,
        flattenInline((token as Tokens.Paragraph).tokens),
        tpl,
        y,
        pageHeight,
        innerWidth,
        tpl.margins.left
      );
    case 'list':
      return renderList(doc, token as Tokens.List, tpl, y, pageHeight, innerWidth);
    case 'space':
      return y + tpl.sizes.body * tpl.lineHeight * 0.4;
    case 'hr': {
      y = ensurePage(doc, y, 12, pageHeight, tpl.margins.top);
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(tpl.margins.left, y + 4, tpl.margins.left + innerWidth, y + 4);
      return y + 14;
    }
    case 'code': {
      const code = (token as Tokens.Code).text;
      doc.setFont('courier', 'normal');
      doc.setFontSize(tpl.sizes.body - 0.5);
      doc.setTextColor(60);
      const lines = doc.splitTextToSize(code, innerWidth);
      const lineH = (tpl.sizes.body - 0.5) * tpl.lineHeight;
      for (const ln of lines) {
        y = ensurePage(doc, y, lineH, pageHeight, tpl.margins.top);
        doc.text(ln, tpl.margins.left, y + (tpl.sizes.body - 0.5));
        y += lineH;
      }
      doc.setTextColor(0);
      return y + 4;
    }
    case 'blockquote': {
      const bq = token as Tokens.Blockquote;
      const segs: InlineSegment[] = [];
      for (const child of bq.tokens) {
        if (child.type === 'paragraph') {
          segs.push(...flattenInline((child as Tokens.Paragraph).tokens));
          segs.push({ text: '\n', style: 'normal' });
        }
      }
      return renderParagraph(
        doc,
        segs,
        tpl,
        y,
        pageHeight,
        innerWidth - 12,
        tpl.margins.left + 12
      );
    }
    default:
      return y;
  }
}

function renderHeading(
  doc: jsPDF,
  token: Tokens.Heading,
  tpl: Template,
  y: number,
  pageHeight: number,
  innerWidth: number
): number {
  const depth = Math.min(Math.max(token.depth, 1), 3);
  const size = depth === 1 ? tpl.sizes.h1 : depth === 2 ? tpl.sizes.h2 : tpl.sizes.h3;
  const lineH = size * tpl.lineHeight;
  const topGap = depth === 1 ? 0 : depth === 2 ? 12 : 8;
  y = ensurePage(doc, y, topGap + lineH + 6, pageHeight, tpl.margins.top);
  y += topGap;

  const segments = flattenInline(token.tokens);
  const text = segments.map((s) => s.text).join('');

  const color = depth <= 2 ? tpl.accent : '#000000';
  setColor(doc, color);
  doc.setFont(tpl.pdfFont, 'bold');
  doc.setFontSize(size);
  const display = depth === 2 ? text.toUpperCase() : text;
  doc.text(display, tpl.margins.left, y + size * 0.85);
  y += lineH;

  if (depth === 2 && tpl.sectionRule) {
    const [r, g, b] = hexToRgb(tpl.accent);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.6);
    doc.line(tpl.margins.left, y - 2, tpl.margins.left + innerWidth, y - 2);
    y += 6;
  } else {
    y += 2;
  }
  setColor(doc, '#000000');
  return y;
}

function renderParagraph(
  doc: jsPDF,
  segments: InlineSegment[],
  tpl: Template,
  y: number,
  pageHeight: number,
  width: number,
  x: number
): number {
  if (segments.length === 0) return y;
  doc.setFontSize(tpl.sizes.body);
  const lineH = tpl.sizes.body * tpl.lineHeight;
  const words = segmentsToWords(segments);

  let cx = x;
  let cy = ensurePage(doc, y, lineH, pageHeight, tpl.margins.top);
  let firstWord = true;

  for (const w of words) {
    if (w.word === '\n') {
      cy += lineH;
      cx = x;
      firstWord = true;
      continue;
    }
    const fontStyle = styleToJsPdf(w.style);
    doc.setFont(tpl.pdfFont, fontStyle);
    const piece = w.trailingSpace ? w.word + ' ' : w.word;
    const wordWidth = doc.getTextWidth(piece);

    if (!firstWord && cx + wordWidth > x + width + 0.5) {
      cy += lineH;
      cx = x;
      cy = ensurePage(doc, cy, lineH, pageHeight, tpl.margins.top);
      firstWord = true;
    }
    doc.text(piece, cx, cy + tpl.sizes.body * 0.85);
    cx += wordWidth;
    firstWord = false;
  }
  return cy + lineH + 4;
}

function renderList(
  doc: jsPDF,
  list: Tokens.List,
  tpl: Template,
  y: number,
  pageHeight: number,
  innerWidth: number
): number {
  const bulletWidth = 14;
  const itemX = tpl.margins.left + bulletWidth;
  const itemWidth = innerWidth - bulletWidth;
  doc.setFontSize(tpl.sizes.body);

  let idx = 1;
  for (const item of list.items) {
    const startY = ensurePage(
      doc,
      y,
      tpl.sizes.body * tpl.lineHeight,
      pageHeight,
      tpl.margins.top
    );

    doc.setFont(tpl.pdfFont, 'normal');
    setColor(doc, tpl.accent);
    const marker = list.ordered ? `${idx}.` : '\u2022';
    doc.text(marker, tpl.margins.left, startY + tpl.sizes.body * 0.85);
    setColor(doc, '#000000');

    const segs: InlineSegment[] = [];
    for (const child of item.tokens) {
      if (child.type === 'text') {
        const tt = child as Tokens.Text;
        if (tt.tokens && tt.tokens.length > 0) {
          segs.push(...flattenInline(tt.tokens));
        } else {
          segs.push({ text: tt.text, style: 'normal' });
        }
      } else if (child.type === 'paragraph') {
        if (segs.length > 0) segs.push({ text: '\n', style: 'normal' });
        segs.push(...flattenInline((child as Tokens.Paragraph).tokens));
      }
    }
    y = renderParagraph(doc, segs, tpl, startY, pageHeight, itemWidth, itemX);

    for (const child of item.tokens) {
      if (child.type === 'list') {
        const nestedTpl: Template = {
          ...tpl,
          margins: { ...tpl.margins, left: tpl.margins.left + bulletWidth },
        };
        y = renderList(
          doc,
          child as Tokens.List,
          nestedTpl,
          y,
          pageHeight,
          innerWidth - bulletWidth
        );
      }
    }
    idx++;
  }
  return y + 2;
}

function styleToJsPdf(style: InlineSegment['style']): string {
  switch (style) {
    case 'bold':
      return 'bold';
    case 'italic':
      return 'italic';
    case 'bolditalic':
      return 'bolditalic';
    default:
      return 'normal';
  }
}

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [
    parseInt(m.substring(0, 2), 16),
    parseInt(m.substring(2, 4), 16),
    parseInt(m.substring(4, 6), 16),
  ];
}

// ---------- DOCX ----------

export async function downloadDocx(
  filename: string,
  content: string,
  tpl: Template
) {
  const tokens = lex(content);
  const paragraphs: Paragraph[] = [];
  for (const token of tokens) {
    appendDocxBlock(paragraphs, token, tpl);
  }

  const docFont = tpl.pdfFont === 'times' ? 'Times New Roman' : 'Calibri';
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: docFont,
            size: Math.round(tpl.sizes.body * 2),
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: ptToTwip(tpl.margins.top),
              right: ptToTwip(tpl.margins.right),
              bottom: ptToTwip(tpl.margins.bottom),
              left: ptToTwip(tpl.margins.left),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, ensureExt(filename, '.docx'));
}

function appendDocxBlock(out: Paragraph[], token: Token, tpl: Template) {
  switch (token.type) {
    case 'heading': {
      const h = token as Tokens.Heading;
      const depth = Math.min(Math.max(h.depth, 1), 3);
      const size = depth === 1 ? tpl.sizes.h1 : depth === 2 ? tpl.sizes.h2 : tpl.sizes.h3;
      const segs = flattenInline(h.tokens);
      const text = segs.map((s) => s.text).join('');
      const display = depth === 2 ? text.toUpperCase() : text;
      const color = depth <= 2 ? tpl.accent.replace('#', '') : '000000';
      const heading =
        depth === 1
          ? HeadingLevel.HEADING_1
          : depth === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
      out.push(
        new Paragraph({
          heading,
          spacing: { before: depth === 1 ? 0 : 200, after: 80 },
          border:
            depth === 2 && tpl.sectionRule
              ? {
                  bottom: {
                    color,
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                  },
                }
              : undefined,
          children: [
            new TextRun({
              text: display,
              bold: true,
              size: Math.round(size * 2),
              color,
            }),
          ],
        })
      );
      break;
    }
    case 'paragraph': {
      const segs = flattenInline((token as Tokens.Paragraph).tokens);
      out.push(
        new Paragraph({
          spacing: { after: 100 },
          children: segs.map((s) => segmentToRun(s, tpl)),
        })
      );
      break;
    }
    case 'list': {
      const list = token as Tokens.List;
      list.items.forEach((item, i) => {
        const segs: InlineSegment[] = [];
        for (const child of item.tokens) {
          if (child.type === 'text') {
            const tt = child as Tokens.Text;
            if (tt.tokens && tt.tokens.length > 0) {
              segs.push(...flattenInline(tt.tokens));
            } else {
              segs.push({ text: tt.text, style: 'normal' });
            }
          } else if (child.type === 'paragraph') {
            if (segs.length > 0) segs.push({ text: ' ', style: 'normal' });
            segs.push(...flattenInline((child as Tokens.Paragraph).tokens));
          }
        }
        const marker = list.ordered ? `${i + 1}. ` : '\u2022\u00a0\u00a0';
        out.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360, hanging: 240 },
            children: [
              new TextRun({ text: marker, color: tpl.accent.replace('#', '') }),
              ...segs.map((s) => segmentToRun(s, tpl)),
            ],
          })
        );
        for (const child of item.tokens) {
          if (child.type === 'list') {
            appendDocxBlock(out, child, tpl);
          }
        }
      });
      break;
    }
    case 'hr':
      out.push(
        new Paragraph({
          border: {
            bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
          },
        })
      );
      break;
    case 'space':
      out.push(new Paragraph({ children: [] }));
      break;
    case 'code':
      out.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: (token as Tokens.Code).text,
              font: 'Consolas',
              size: Math.round((tpl.sizes.body - 0.5) * 2),
            }),
          ],
        })
      );
      break;
    case 'blockquote': {
      const bq = token as Tokens.Blockquote;
      for (const child of bq.tokens) {
        if (child.type === 'paragraph') {
          const segs = flattenInline((child as Tokens.Paragraph).tokens);
          out.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { after: 100 },
              children: segs.map((s) => segmentToRun(s, tpl)),
            })
          );
        }
      }
      break;
    }
  }
}

function segmentToRun(seg: InlineSegment, tpl: Template): TextRun {
  if (seg.text === '\n') {
    return new TextRun({ text: '', break: 1 });
  }
  const bold = seg.style === 'bold' || seg.style === 'bolditalic';
  const italics = seg.style === 'italic' || seg.style === 'bolditalic';
  return new TextRun({
    text: seg.text,
    bold,
    italics,
    size: Math.round(tpl.sizes.body * 2),
  });
}

function ptToTwip(pt: number): number {
  return Math.round(pt * 20);
}

function ensureExt(name: string, ext: string) {
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}
