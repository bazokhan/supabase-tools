import React from "react";

interface MermaidRendererProps {
  code: string;
  id?: string;
}

export function MermaidRenderer({ code, id = "mermaid-diagram" }: MermaidRendererProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [svg, setSvg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!code.trim()) return;
    setError(null);
    setSvg(null);
    import("mermaid")
      .then((mermaid) => {
        mermaid.default.initialize({ startOnLoad: false, theme: "dark" });
        const uid = `${id}-${Date.now()}`;
        return mermaid.default.render(uid, code);
      })
      .then(({ svg: s }) => setSvg(s))
      .catch((e) => setError((e as Error).message));
  }, [code, id]);

  if (error) {
    return (
      <div className="mermaid-error">
        <p>Mermaid render failed: {error}</p>
        <pre className="mermaid-fallback">{code}</pre>
      </div>
    );
  }
  if (svg) {
    return <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} />;
  }
  return <div className="mermaid-loading">Rendering...</div>;
}
