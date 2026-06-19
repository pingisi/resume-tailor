import { Lexer, type Token, type Tokens } from 'marked';

export type InlineStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface InlineSegment {
  text: string;
  style: InlineStyle;
}

export function lex(markdown: string): Token[] {
  return new Lexer().lex(markdown);
}

/**
 * Flatten nested inline tokens (paragraph children, list-item children, heading children)
 * into a flat list of { text, style } segments. Preserves word boundaries via spaces in `text`.
 */
export function flattenInline(
  tokens: Token[] | undefined,
  parentStyle: InlineStyle = 'normal'
): InlineSegment[] {
  if (!tokens || tokens.length === 0) return [];
  const out: InlineSegment[] = [];

  for (const t of tokens) {
    switch (t.type) {
      case 'text': {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length > 0) {
          out.push(...flattenInline(tt.tokens, parentStyle));
        } else {
          out.push({ text: tt.text, style: parentStyle });
        }
        break;
      }
      case 'strong': {
        const st = t as Tokens.Strong;
        const child: InlineStyle =
          parentStyle === 'italic' || parentStyle === 'bolditalic'
            ? 'bolditalic'
            : 'bold';
        out.push(...flattenInline(st.tokens, child));
        break;
      }
      case 'em': {
        const em = t as Tokens.Em;
        const child: InlineStyle =
          parentStyle === 'bold' || parentStyle === 'bolditalic'
            ? 'bolditalic'
            : 'italic';
        out.push(...flattenInline(em.tokens, child));
        break;
      }
      case 'codespan': {
        const cs = t as Tokens.Codespan;
        out.push({ text: cs.text, style: parentStyle });
        break;
      }
      case 'link': {
        const lk = t as Tokens.Link;
        out.push(...flattenInline(lk.tokens, parentStyle));
        break;
      }
      case 'br':
        out.push({ text: '\n', style: parentStyle });
        break;
      case 'del': {
        const d = t as Tokens.Del;
        out.push(...flattenInline(d.tokens, parentStyle));
        break;
      }
      default: {
        const any = t as { raw?: string; text?: string };
        if (any.text) out.push({ text: any.text, style: parentStyle });
        break;
      }
    }
  }

  return out;
}

/** Split inline segments into tokens-per-word while preserving style. */
export function segmentsToWords(
  segments: InlineSegment[]
): { word: string; style: InlineStyle; trailingSpace: boolean }[] {
  const out: { word: string; style: InlineStyle; trailingSpace: boolean }[] = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        // Attach the whitespace to previous word as trailing space (collapsed to single)
        if (out.length > 0) out[out.length - 1].trailingSpace = true;
      } else {
        out.push({ word: p, style: seg.style, trailingSpace: false });
      }
    }
  }
  return out;
}
