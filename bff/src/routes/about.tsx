import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="p-2">
      <h3>About FLUO</h3>
      <p>FLUO is a Real-time Behavioral Assurance System for OpenTelemetry data analysis and signal management.</p>
    </div>
  );
}