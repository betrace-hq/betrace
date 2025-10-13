import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useGrafanaConfig } from '../../lib/hooks/use-grafana-config';
import { useToast } from '../ui/use-toast';
import { cn } from '../../lib/utils';

export interface ViewInGrafanaButtonProps {
  signal: {
    id: string;
    traceId?: string;
    spanId?: string;
    timestamp: string;
  };
  iconOnly?: boolean;
  className?: string;
}

/**
 * Button component to open signal trace in Grafana Explore
 *
 * Behavior:
 * - When Grafana configured: Opens trace in new tab
 * - When not configured and iconOnly: Renders nothing
 * - When not configured and full button: Renders disabled with tooltip
 *
 * SECURITY:
 * - URL validation in useGrafanaConfig hook prevents injection
 * - window.open with noopener,noreferrer prevents tab-napping
 * - Popup blocker detection provides user feedback
 *
 * @param signal - Signal data containing trace information
 * @param iconOnly - If true, renders icon-only button (hides when not configured)
 * @param className - Additional CSS classes
 */
export function ViewInGrafanaButton({
  signal,
  iconOnly = false,
  className,
}: ViewInGrafanaButtonProps) {
  const { isLoading, isConfigured, baseUrl, orgId, datasourceUid } =
    useGrafanaConfig();
  const { toast } = useToast();

  // Hide icon-only button when Grafana not configured
  if (iconOnly && !isConfigured) {
    return null;
  }

  const isDisabled = isLoading || !isConfigured || !signal.traceId;

  const handleClick = () => {
    if (isDisabled || !signal.traceId) return;

    // Build Grafana Explore URL
    // Format: /explore?orgId={orgId}&left={queryParams}
    const queryParams = {
      datasource: datasourceUid,
      queries: [
        {
          refId: 'A',
          datasource: {
            type: 'tempo',
            uid: datasourceUid,
          },
          queryType: 'traceql',
          query: signal.traceId,
          // Include spanId if available for direct navigation
          ...(signal.spanId && { spanId: signal.spanId }),
        },
      ],
      range: {
        // Set range around signal timestamp
        from: new Date(
          new Date(signal.timestamp).getTime() - 3600000
        ).toISOString(),
        to: new Date(
          new Date(signal.timestamp).getTime() + 3600000
        ).toISOString(),
      },
    };

    const leftParam = encodeURIComponent(JSON.stringify(queryParams));
    const url = `${baseUrl}/explore?orgId=${orgId}&left=${leftParam}`;

    // SECURITY P0-2: Detect popup blocker and provide user feedback
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Popup was blocked
      toast({
        title: 'Failed to open Grafana',
        description:
          'Please check your pop-up blocker settings and try again.',
        variant: 'destructive',
      });
      return;
    }

    // SECURITY: Log navigation event (origin only, not full URL with params)
    console.info('[Security] Grafana navigation successful', {
      timestamp: new Date().toISOString(),
      destination: new URL(url).origin,
    });
  };

  const buttonContent = iconOnly ? (
    <ExternalLink className="h-4 w-4" />
  ) : (
    <>
      <ExternalLink className="mr-2 h-4 w-4" />
      View in Grafana
    </>
  );

  const tooltipContent = !isConfigured
    ? 'Grafana not configured'
    : !signal.traceId
    ? 'No trace ID available'
    : 'View signal in Grafana';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={iconOnly ? 'ghost' : 'outline'}
            size={iconOnly ? 'sm' : 'default'}
            onClick={handleClick}
            disabled={isDisabled}
            aria-label="View signal in Grafana"
            className={cn(iconOnly && 'h-8 w-8 p-0', className)}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
