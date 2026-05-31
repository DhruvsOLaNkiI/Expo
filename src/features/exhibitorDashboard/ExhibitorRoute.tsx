import { Component, type ReactNode } from 'react';
import { ExhibitorDashboard } from './ExhibitorDashboard';

type Props = { children?: ReactNode };

type State = { hasError: boolean; message: string };

export class ExhibitorRouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Failed to load exhibitor dashboard';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error('[ExhibitorDashboard]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#030712', color: '#e5e7eb', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Exhibitor dashboard failed to load</h1>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>{this.state.message}</p>
          <p style={{ color: '#94a3b8' }}>Open: <a href="/exbidash" style={{ color: '#60a5fa' }}>/exbidash</a></p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ExhibitorRoutePage() {
  return (
    <ExhibitorRouteErrorBoundary>
      <ExhibitorDashboard />
    </ExhibitorRouteErrorBoundary>
  );
}
