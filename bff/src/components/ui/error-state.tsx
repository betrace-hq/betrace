import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { AlertCircle } from "lucide-react"

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  message?: string
  onRetry?: () => void
  fullScreen?: boolean
}

function ErrorState({
  className,
  title = "Error",
  message = "Something went wrong. Please try again.",
  onRetry,
  fullScreen = false,
  ...props
}: ErrorStateProps) {
  const containerClass = fullScreen
    ? "min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"
    : "text-center py-12"

  return (
    <div className={cn(containerClass, className)} {...props}>
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        {onRetry && (
          <Button onClick={onRetry}>Retry</Button>
        )}
      </div>
    </div>
  )
}

export { ErrorState }
