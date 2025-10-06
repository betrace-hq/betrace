import { Header } from './header'

interface LayoutProps {
  children: React.ReactNode
  showHeader?: boolean
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showHeader && <Header />}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}