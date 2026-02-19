import React from "react";

interface MermaidRendererProps {
  code: string;
  id?: string;
  /** Pass to re-render diagram when theme changes. */
  dark?: boolean;
}

/** Mermaid theme variables aligned with our design tokens. Uses base theme so we can customize. */
function getMermaidThemeVariables(isDark: boolean) {
  if (isDark) {
    return {
      darkMode: true,
      background: "#151517",
      primaryColor: "#1c1c1f",
      primaryTextColor: "#f0f0f0",
      primaryBorderColor: "#2d2d30",
      secondaryColor: "#252528",
      secondaryTextColor: "#a1a1aa",
      secondaryBorderColor: "#353538",
      tertiaryColor: "#1f1f24",
      tertiaryTextColor: "#f0f0f0",
      tertiaryBorderColor: "#2d2d30",
      lineColor: "#3f3f46",
      textColor: "#f0f0f0",
      mainBkg: "#1c1c1f",
      nodeBorder: "#2d2d30",
      clusterBkg: "#1f1f24",
      clusterBorder: "#353538",
      defaultLinkColor: "#818cf8",
      titleColor: "#f0f0f0",
      edgeLabelBackground: "#252528",
      nodeTextColor: "#f0f0f0",
      noteBkgColor: "#252528",
      noteTextColor: "#f0f0f0",
      noteBorderColor: "#353538",
      attributeBackgroundColorOdd: "#1a1a1e",
      attributeBackgroundColorEven: "#1f1f24",
      errorBkgColor: "#4a3535",
      errorTextColor: "#d49494",
      cScale0: "#1c1c1f",
      cScale1: "#252528",
      cScale2: "#2a2a2e",
      cScale3: "#2d2d30",
      cScale4: "#353538",
      cScale5: "#3a3a3f",
      cScale6: "#404046",
      cScale7: "#45454b",
      cScale8: "#4a4a50",
      cScale9: "#4f4f56",
      cScale10: "#55555c",
      cScale11: "#5a5a62",
    };
  }
  return {
    darkMode: false,
    background: "#f5f5f7",
    primaryColor: "#f2f2f2",
    primaryTextColor: "#1a1a1e",
    primaryBorderColor: "#e4e6e9",
    secondaryColor: "#f8f9fa",
    secondaryTextColor: "#6b7280",
    secondaryBorderColor: "#e8ebef",
    tertiaryColor: "#f0f2f5",
    tertiaryTextColor: "#1a1a1e",
    tertiaryBorderColor: "#e4e6e9",
    lineColor: "#9ca3af",
    textColor: "#1a1a1e",
    mainBkg: "#f2f2f2",
    nodeBorder: "#e4e6e9",
    clusterBkg: "#f8f9fa",
    clusterBorder: "#e8ebef",
    defaultLinkColor: "#525ee5",
    titleColor: "#1a1a1e",
    edgeLabelBackground: "#f8f9fa",
    nodeTextColor: "#1a1a1e",
    noteBkgColor: "#f8f9fa",
    noteTextColor: "#1a1a1e",
    noteBorderColor: "#e8ebef",
    attributeBackgroundColorOdd: "#f2f2f2",
    attributeBackgroundColorEven: "#f8f9fa",
    errorBkgColor: "#fef2f2",
    errorTextColor: "#c91c1c",
    cScale0: "#f0f2f5",
    cScale1: "#e8ebef",
    cScale2: "#e4e6e9",
    cScale3: "#e0e3e8",
    cScale4: "#dce0e5",
    cScale5: "#d8dce2",
    cScale6: "#d4d8df",
    cScale7: "#d0d4dc",
    cScale8: "#ccd0d9",
    cScale9: "#c8ccd6",
    cScale10: "#c4c8d3",
    cScale11: "#c0c4d0",
  };
}

export function MermaidRenderer({ code, id = "mermaid-diagram", dark }: MermaidRendererProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [svg, setSvg] = React.useState<string | null>(null);
  const isDark = dark ?? document.documentElement.classList.contains("dark");

  React.useEffect(() => {
    if (!code.trim()) return;
    setError(null);
    setSvg(null);
    const themeVariables = getMermaidThemeVariables(isDark);
    import("mermaid")
      .then((mermaid) => {
        mermaid.default.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables,
        });
        const uid = `${id}-${Date.now()}`;
        return mermaid.default.render(uid, code);
      })
      .then(({ svg: s }) => setSvg(s))
      .catch((e) => setError((e as Error).message));
  }, [code, id, isDark]);

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
