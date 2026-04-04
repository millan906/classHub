import React from 'react'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: '12px', textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '28px' }}>⚠️</div>
          <div style={{ fontSize: '16px', fontWeight: 500 }}>Something went wrong</div>
          <div style={{ fontSize: '13px', color: '#888', maxWidth: '400px' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{
              marginTop: '8px', padding: '6px 16px', fontSize: '12px',
              borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.25)',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
