import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let msg = error.message || 'Ocorreu um erro inesperado na aplicação.';
    try {
      const parsed = JSON.parse(msg);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          msg =
            'Permissão insuficiente para realizar esta operação. Verifique com o síndico se o seu perfil está autorizado.';
        } else {
          msg = parsed.error;
        }
      }
    } catch {
      // mensagem simples
    }
    return { hasError: true, message: msg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-stone-900">
                Não foi possível concluir a operação
              </h1>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
