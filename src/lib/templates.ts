export type TemplateId = 'classic' | 'modern' | 'compact';

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  /** jsPDF font family — must be one of helvetica, times, courier */
  pdfFont: 'helvetica' | 'times';
  /** CSS font-family for the preview */
  cssFont: string;
  sizes: {
    h1: number;
    h2: number;
    h3: number;
    body: number;
  };
  /** Margins in points (1pt = 1/72in) */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Multiplier applied to font size to get line height */
  lineHeight: number;
  /** Accent color used for h1/h2 and section rules. Hex string. */
  accent: string;
  /** Draw a horizontal rule under each H2 section header */
  sectionRule: boolean;
}

export const TEMPLATES: Record<TemplateId, Template> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Serif, traditional, formal',
    pdfFont: 'times',
    cssFont: '"Times New Roman", Times, serif',
    sizes: { h1: 18, h2: 13, h3: 11, body: 10.5 },
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    lineHeight: 1.25,
    accent: '#000000',
    sectionRule: true,
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Sans-serif with subtle blue accent',
    pdfFont: 'helvetica',
    cssFont:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    sizes: { h1: 20, h2: 12, h3: 11, body: 10 },
    margins: { top: 48, right: 56, bottom: 48, left: 56 },
    lineHeight: 1.35,
    accent: '#2563eb',
    sectionRule: false,
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Sans-serif, tighter spacing — fits more on one page',
    pdfFont: 'helvetica',
    cssFont:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    sizes: { h1: 16, h2: 11, h3: 10, body: 9.5 },
    margins: { top: 40, right: 48, bottom: 40, left: 48 },
    lineHeight: 1.2,
    accent: '#374151',
    sectionRule: true,
  },
};

export const TEMPLATE_LIST: Template[] = [
  TEMPLATES.modern,
  TEMPLATES.classic,
  TEMPLATES.compact,
];

const STORAGE_KEY = 'resume-tailor:template';

export function getStoredTemplate(): TemplateId {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && (v in TEMPLATES)) return v as TemplateId;
  return 'modern';
}

export function setStoredTemplate(id: TemplateId): void {
  localStorage.setItem(STORAGE_KEY, id);
}
