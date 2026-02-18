import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || "Unexpected application error." };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Keep browser console trace for debugging while rendering a safe fallback.
    console.error("Dashboard UI crashed:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.history.pushState({}, "", "/");
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="runtime-fallback-shell">
        <section className="runtime-fallback-card">
          <div className="runtime-fallback-graphic" aria-hidden>
            <span className="runtime-orbit runtime-orbit-a" />
            <span className="runtime-orbit runtime-orbit-b" />
            <span className="runtime-core" />
          </div>
          <h1>Dashboard Runtime Error</h1>
          <p>The app hit an unexpected error. You can reload, or return to overview.</p>
          <pre className="runtime-fallback-message">{this.state.message}</pre>
          <div className="runtime-fallback-actions">
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Reload
            </button>
            <button type="button" className="btn" onClick={this.handleGoHome}>
              Go to Overview
            </button>
          </div>
        </section>
      </main>
    );
  }
}
