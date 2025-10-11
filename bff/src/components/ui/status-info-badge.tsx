import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

const statusInfoBadgeVariants = cva(
  "inline-flex items-center px-4 py-2 rounded-md font-medium text-sm",
  {
    variants: {
      variant: {
        amber: "bg-amber-600 text-white",
        blue: "bg-blue-600 text-white",
        green: "bg-green-600 text-white",
        red: "bg-red-600 text-white",
      },
    },
    defaultVariants: {
      variant: "blue",
    },
  }
)

export interface StatusInfoBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusInfoBadgeVariants> {
  icon?: LucideIcon
  children: React.ReactNode
}

function StatusInfoBadge({
  className,
  variant,
  icon: Icon,
  children,
  ...props
}: StatusInfoBadgeProps) {
  return (
    <div
      className={cn(statusInfoBadgeVariants({ variant }), className)}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </div>
  )
}

export { StatusInfoBadge, statusInfoBadgeVariants }
