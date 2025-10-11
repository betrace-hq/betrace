import * as React from "react"
import { cn } from "@/lib/utils"

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string
  fullScreen?: boolean
}

function LoadingState({
  className,
  message = "Loading...",
  fullScreen = false,
  ...props
}: LoadingStateProps) {
  const containerClass = fullScreen
    ? "min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"
    : "text-center py-12"

  return (
    <div className={cn(containerClass, className)} {...props}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  )
}

export { LoadingState }
