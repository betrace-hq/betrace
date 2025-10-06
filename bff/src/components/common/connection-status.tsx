import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useWebSocket } from '@/lib/hooks/use-websocket'

interface ConnectionStatusProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ConnectionStatus({
  className = '',
  showLabel = true,
  size = 'md'
}: ConnectionStatusProps) {
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [lastPing, setLastPing] = useState<Date | null>(null)

  // Use WebSocket hook to track connection status
  const { isConnected, isConnecting } = useWebSocket({
    autoConnect: true,
    onConnect: () => {
      setConnectionState('connected')
      setLastPing(new Date())
    },
    onDisconnect: () => {
      setConnectionState('disconnected')
      setLastPing(null)
    }
  })

  // Update connection state based on WebSocket status
  useEffect(() => {
    if (isConnecting) {
      setConnectionState('connecting')
    } else if (isConnected) {
      setConnectionState('connected')
      setLastPing(new Date())
    } else {
      setConnectionState('disconnected')
      setLastPing(null)
    }
  }, [isConnected, isConnecting])

  // Simulate periodic ping updates when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      const interval = setInterval(() => {
        setLastPing(new Date())
      }, 30000) // Update every 30 seconds

      return () => clearInterval(interval)
    }
  }, [connectionState])

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
          iconClassName: 'text-emerald-600 dark:text-emerald-400'
        }
      case 'connecting':
        return {
          icon: Loader2,
          label: 'Connecting',
          className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
          iconClassName: 'text-amber-600 dark:text-amber-400 animate-spin'
        }
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          label: 'Disconnected',
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
          iconClassName: 'text-red-600 dark:text-red-400'
        }
    }
  }

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return {
          badgeClass: 'px-2 py-1 text-xs',
          iconClass: 'w-3 h-3'
        }
      case 'lg':
        return {
          badgeClass: 'px-4 py-2 text-base',
          iconClass: 'w-5 h-5'
        }
      case 'md':
      default:
        return {
          badgeClass: 'px-3 py-1.5 text-sm',
          iconClass: 'w-4 h-4'
        }
    }
  }

  const statusConfig = getStatusConfig()
  const sizeConfig = getSizeConfig()
  const Icon = statusConfig.icon

  const formatLastPing = (date: Date | null) => {
    if (!date) return null
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge
        variant="outline"
        className={`${statusConfig.className} border ${sizeConfig.badgeClass} font-medium`}
      >
        <Icon className={`${statusConfig.iconClassName} ${sizeConfig.iconClass} mr-1.5`} />
        {showLabel && statusConfig.label}
      </Badge>

      {connectionState === 'connected' && lastPing && showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatLastPing(lastPing)}
        </span>
      )}
    </div>
  )
}