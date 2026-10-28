"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface RichTextRendererProps {
  content?: string | null;
  className?: string;
  asInline?: boolean;
}

export function RichTextRenderer({
  content,
  className = "",
  asInline = false,
}: RichTextRendererProps) {
  const processedHtml = useMemo(() => {
    if (!content) return "";

    let text = content;

    // Check if content is purely plain text (doesn't contain HTML tags)
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(text);

    // If text has LaTeX markers ($...$ or $$...$$) and doesn't already contain rendered katex
    if (!text.includes("class=\"katex\"")) {
      try {
        // Block math $$...$$
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
          try {
            return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
          } catch {
            return `$$${math}$$`;
          }
        });

        // Inline math $...$
        text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
          try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
          } catch {
            return `$${math}$`;
          }
        });
      } catch (err) {
        console.error("LaTeX parse error in RichTextRenderer:", err);
      }
    }

    if (!hasHtmlTags) {
      // Preserve line breaks for plain text
      text = text.replace(/\n/g, "<br/>");
    }

    return text;
  }, [content]);

  if (!processedHtml) return null;

  if (asInline) {
    return (
      <span
        className={`nexam-rich-content inline-block ${className}`}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    );
  }

  return (
    <div
      className={`nexam-rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}

export default RichTextRenderer;
