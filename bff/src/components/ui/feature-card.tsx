import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

const featureCardVariants = cva(
  "text-center",
  {
    variants: {},
    defaultVariants: {},
  }
)

const featureIconVariants = cva(
  "p-3 rounded-lg border",
  {
    variants: {
      color: {
        blue: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
        green: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400",
        amber: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
        red: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
      },
    },
    defaultVariants: {
      color: "blue",
    },
  }
)

export interface FeatureCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof featureCardVariants> {
  icon: LucideIcon
  iconColor?: "blue" | "green" | "amber" | "red"
  title: string
  description: string
}

function FeatureCard({
  className,
  icon: Icon,
  iconColor = "blue",
  title,
  description,
  ...props
}: FeatureCardProps) {
  return (
    <div className={cn(featureCardVariants(), className)} {...props}>
      <div className="flex justify-center mb-3">
        <div className={featureIconVariants({ color: iconColor })}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {description}
      </p>
    </div>
  )
}

export { FeatureCard, featureCardVariants }
