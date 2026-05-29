import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Acompanhamento de Peso do Filhote',
  description: 'Aplicação simples para acompanhar o crescimento do filhote em kg.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
