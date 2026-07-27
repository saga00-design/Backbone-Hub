import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// The app has no other error boundary. Without this, any uncaught render error (e.g. a
// corrupted Firestore field reaching a render) unmounts the entire React tree — the whole
// authenticated app disappears, which reads to the user as being logged out even though
// their session is untouched. This keeps the crash contained and recoverable.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-primary-surface px-6">
          <div className="max-w-md w-full bg-card-bg border border-border-grey rounded-2xl shadow-lg p-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-cta/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-cta" />
            </div>
            <h1 className="text-lg font-bold text-text-navy mb-2">Something went wrong</h1>
            <p className="text-sm text-text-muted mb-6">
              This screen hit an unexpected error and couldn't display. You're still logged in —
              reload to try again.
            </p>
            <Button variant="primary" onClick={this.handleReload} className="w-full">
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
