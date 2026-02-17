import React from "react";

interface CodeBlockProps {
  children: string;
  lang?: string;
}

export function CodeBlock({ children, lang }: CodeBlockProps) {
  return (
    <pre className="code-block">
      <code className={lang ? `language-${lang}` : undefined}>{children}</code>
    </pre>
  );
}
