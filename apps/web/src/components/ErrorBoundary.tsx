import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-main">
          <div className="alert alert-error">
            Algo deu errado. Recarregue a pagina e tente novamente.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
