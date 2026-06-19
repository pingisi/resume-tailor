import { saveAs } from 'file-saver';
import type { Template } from './templates';

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, ensureExt(filename, '.md'));
}

export async function downloadPdf(
  filename: string,
  content: string,
  tpl: Template
): Promise<void> {
  const mod = await import('./pdf-export');
  mod.downloadPdf(filename, content, tpl);
}

export async function downloadDocx(
  filename: string,
  content: string,
  tpl: Template
): Promise<void> {
  const mod = await import('./docx-export');
  await mod.downloadDocx(filename, content, tpl);
}

function ensureExt(name: string, ext: string) {
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}
