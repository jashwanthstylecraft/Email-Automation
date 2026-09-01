import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Heuristic subject detection: a short first line, followed by a blank line,
// reads like a title/subject rather than the start of a paragraph.
function splitSubjectAndBody(rawText: string): { subject: string | null; body: string } {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const firstBreak = normalized.indexOf('\n\n');
  if (firstBreak === -1) return { subject: null, body: normalized };

  const firstLine = normalized.slice(0, firstBreak).trim();
  const rest = normalized.slice(firstBreak).trim();
  const looksLikeTitle = firstLine.length > 0 && firstLine.length <= 120 && !firstLine.includes('\n');

  if (looksLikeTitle && rest.length > 0) {
    return { subject: firstLine, body: rest };
  }
  return { subject: null, body: normalized };
}

export async function POST(request: Request) {
  try {
    const { fileBase64 } = await request.json();
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const images: { id: string; dataUrl: string }[] = [];
    let imageCounter = 0;

    // Extracting the embedded images (via the HTML conversion's image hook)
    // is a separate pass from the plain-text extraction below -- their
    // order is not cross-referenced, so the resulting {{image_<id>}} tokens
    // are appended after the body text rather than inlined at their exact
    // original position. Good enough for the "auto-fill, then let the admin
    // reposition tokens" heuristic; a perfect position match would need a
    // full HTML/DOM parse of mammoth's output.
    await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const base64 = await image.read('base64');
          const id = `docx${Date.now().toString(36)}${(imageCounter++).toString(36)}`;
          images.push({ id, dataUrl: `data:${image.contentType};base64,${base64}` });
          return { src: '' };
        }),
      }
    );

    const { value: rawText } = await mammoth.extractRawText({ buffer });
    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'This document appears to be empty' }, { status: 400 });
    }

    const { subject, body: bodyText } = splitSubjectAndBody(rawText);
    const body = images.length > 0
      ? `${bodyText}\n\n${images.map((img) => `{{image_${img.id}}}`).join('\n')}`
      : bodyText;

    return NextResponse.json({ success: true, subject, body, images });
  } catch (error: any) {
    console.error('Failed to parse uploaded template document:', error);
    return NextResponse.json(
      { error: 'Could not read this file. Make sure it is a .docx Word document (older .doc files are not supported).' },
      { status: 400 }
    );
  }
}
