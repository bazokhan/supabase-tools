import React from "react";
import { EmptyPanel } from "../components/EmptyPanel";
import { MermaidRenderer } from "../components/MermaidRenderer";
import { prettyLabel } from "../lib/model";
import type { CategoryMap } from "../lib/model";

interface ErdPageProps {
  categories: CategoryMap;
}

interface ErdDiagram {
  table: string;
  mermaid: string;
  markdown?: string;
}

export function ErdPage({ categories }: ErdPageProps) {
  const diagrams = (categories.erd_diagrams ?? []) as ErdDiagram[];
  const [selected, setSelected] = React.useState<string | null>(diagrams[0]?.table ?? null);
  const selectedDiagram = diagrams.find((d) => d.table === selected);

  if (diagrams.length === 0) {
    return (
      <EmptyPanel
        title="No ERD Diagrams"
        message="Run sbt generate-erd to create entity relationship diagrams."
        hint="Enable @sbtools/plugin-erd and run the command."
      />
    );
  }

  return (
    <div className="content-stack">
      <section className="hero">
        <h1>Entity Relationship Diagrams</h1>
        <p>Mermaid ERD diagrams for each table showing columns and foreign keys.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Diagrams</h2>
            <p>Select a table to view its ERD.</p>
          </div>
        </div>

        <div className="erd-layout">
          <div className="erd-sidebar">
            {diagrams.map((d) => (
              <button
                key={d.table}
                type="button"
                className={`erd-table-btn ${selected === d.table ? "active" : ""}`}
                onClick={() => setSelected(d.table)}
              >
                {prettyLabel(d.table)}
              </button>
            ))}
          </div>

          <div className="erd-content">
            {selectedDiagram?.mermaid ? (
              <div className="mermaid-wrap">
                <MermaidRenderer code={selectedDiagram.mermaid} id={selected ?? "erd"} />
              </div>
            ) : (
              <p className="empty-state">No Mermaid diagram found for this table.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
