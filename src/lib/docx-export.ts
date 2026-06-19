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
import { flattenInline, lex, type InlineSegment } from './markdown';
import type { Template } from './templates';

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
      const size =
        depth === 1 ? tpl.sizes.h1 : depth === 2 ? tpl.sizes.h2 : tpl.sizes.h3;
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
            bottom: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
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
