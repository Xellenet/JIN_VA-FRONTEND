import type { ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[128px]" />
      </div>
      <div className="w-full max-w-[480px] relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Auth System</h1>
          <p className="text-sm text-muted-foreground">Secure authentication platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
