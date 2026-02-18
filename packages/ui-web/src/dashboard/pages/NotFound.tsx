import React from "react";

export function NotFoundPage() {
  return (
    <section className="panel notfound-panel">
      <div className="notfound-graphic" aria-hidden>
        <span className="notfound-grid" />
        <span className="notfound-signal notfound-signal-a" />
        <span className="notfound-signal notfound-signal-b" />
      </div>
      <div className="notfound-copy">
        <h2>404: Route Not Found</h2>
        <p>The path you opened does not exist in this dashboard.</p>
        <div className="notfound-actions">
          <a className="btn btn-primary" href="/">
            Back to Overview
          </a>
          <a className="btn" href="/runner">
            Open Commands
          </a>
        </div>
      </div>
    </section>
  );
}
