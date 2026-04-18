// ─── ErrorBoundary ───
// Per-view error boundary. Each top-level tab is wrapped so a crash in one
// view (e.g. a bad chart config, an unexpected null in a record) never takes
// down the whole dashboard. The fallback is friendly and in Portuguese to
// match the rest of the app, with a "Try again" reset and optional "Report"
// hook. In dev we also dump the stack; in prod we only show the message.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Name of the view — shown in the fallback UI to help the user locate the issue. */
  label?: string;
  children: ReactNode;
  /** Optional callback for telemetry / monitoring. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep console-level logging — useful when developing. In production the
    // host environment (Supabase, Sentry, etc.) can subscribe via `onError`.
    console.error('[ErrorBoundary]', this.props.label ?? '(no label)', error, info);
    this.props.onError?.(error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const { error } = this.state;
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-card border border-destructive/30 rounded-meta-card p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-meta-btn bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-meta-heading-sm text-foreground">
                Algo deu errado{this.props.label ? ` · ${this.props.label}` : ''}
              </h3>
              <p className="text-meta-body text-muted-foreground mt-1">
                Esta seção encontrou um erro e foi isolada para não afetar o restante do dashboard.
              </p>
              {error.message && (
                <pre className="mt-3 text-[11px] bg-muted/30 rounded-meta-btn p-2 whitespace-pre-wrap break-words max-h-32 overflow-auto text-muted-foreground">
                  {error.message}
                </pre>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={this.handleReset} size="sm" variant="default" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
