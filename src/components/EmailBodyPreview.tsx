'use client';

import React from 'react';

interface TemplateImage {
  id: string;
  dataUrl: string;
}

interface EmailBodyPreviewProps {
  body: string;
  images?: TemplateImage[];
  className?: string;
}

const IMAGE_TOKEN_RE = /\{\{image_([a-zA-Z0-9]+)\}\}/g;

// Renders a template/draft body that may contain {{image_<id>}} tokens as real
// <img> elements, interleaved with the surrounding plain text. Deliberately NOT
// dangerouslySetInnerHTML -- the body can contain customer-influenced text
// (e.g. {{customer_name}}), so it must never be interpreted as arbitrary HTML.
// Only admin-uploaded image data URIs (looked up by token id, never taken
// directly from the body text) are ever rendered as an element.
export default function EmailBodyPreview({ body, images = [], className }: EmailBodyPreviewProps) {
  const imageMap = new Map(images.map((img) => [img.id, img.dataUrl]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(IMAGE_TOKEN_RE);
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{body.slice(lastIndex, match.index)}</span>);
    }
    const dataUrl = imageMap.get(match[1]);
    if (dataUrl) {
      parts.push(<img key={key++} src={dataUrl} alt="" className="max-w-full h-auto block my-2 rounded" />);
    } else {
      parts.push(<span key={key++} className="italic opacity-70">[Image]</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  }

  return <div className={className}>{parts}</div>;
}
