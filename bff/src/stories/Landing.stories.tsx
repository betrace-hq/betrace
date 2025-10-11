import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { StyledCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/styled-card';
import { StatusInfoBadge } from '@/components/ui/status-info-badge';
import { FeatureCard } from '@/components/ui/feature-card';
import { StatsCard } from '@/components/ui/stats-card';
import {
  Activity, Shield, Zap, Eye, CheckCircle, AlertCircle,
  Clock, Users, Globe, Code, BarChart3, Lock, FileCheck
} from 'lucide-react';

const meta: Meta = {
  title: 'FLUO/Landing',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Hero Section Component - Professional, Clean Design
const HeroSection = () => (
  <section className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <div className="container mx-auto px-4 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        {/* Status Badges - Clear, Professional */}
        <div className="flex items-center justify-center gap-4 mb-12 flex-wrap">
          <StatusInfoBadge variant="blue" icon={Shield}>
            Enterprise Security
          </StatusInfoBadge>
          <StatusInfoBadge variant="green" icon={CheckCircle}>
            SOC 2 Certified
          </StatusInfoBadge>
        </div>

        {/* Professional Headline - Clear Value Proposition */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Real-Time Behavioral Monitoring
            <span className="block text-blue-700 dark:text-blue-400 mt-2">
              for Mission-Critical Systems
            </span>
          </h1>

          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Detect anomalies before they impact customers. Enterprise-grade observability with OpenTelemetry integration.
          </p>

          {/* Key Benefits - Scannable, Clear */}
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mt-10">
            <FeatureCard
              icon={Shield}
              iconColor="blue"
              title="High Availability"
              description="99.9% uptime SLA"
            />
            <FeatureCard
              icon={Zap}
              iconColor="green"
              title="Real-Time Alerts"
              description="Sub-100ms detection"
            />
            <FeatureCard
              icon={Eye}
              iconColor="amber"
              title="Full Visibility"
              description="Complete trace context"
            />
          </div>

          {/* Professional CTAs - Clear Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              size="lg"
              className="px-8 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-sm"
            >
              Request Enterprise Demo
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="px-8 py-3 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold"
            >
              View Documentation
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// CTA Section Component - Professional Call-to-Action with Enhanced Typography
const CTASection = () => (
  <section className="py-20 bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 dark:from-blue-900 dark:via-blue-950 dark:to-gray-900">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
        Ready to Secure Your <br className="hidden sm:block" />
        <span className="text-blue-200">Critical Systems?</span>
      </h2>
      <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
        Join leading organizations using FLUO for enterprise-grade observability and compliance.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          size="lg"
          className="px-10 py-4 text-lg bg-white hover:bg-blue-50 text-blue-900 font-bold shadow-lg hover:shadow-xl transition-all"
        >
          Schedule Enterprise Demo
        </Button>

        <Button
          size="lg"
          className="px-10 py-4 text-lg border-2 border-white bg-transparent text-white hover:bg-white hover:text-blue-900 font-bold transition-all"
        >
          Contact Sales
        </Button>
      </div>

      {/* Trust Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-16">
        <div className="flex items-center justify-center gap-3 text-base text-blue-50 font-semibold">
          <CheckCircle className="w-5 h-5 text-blue-200" />
          <span>SOC 2 Type II Certified</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-base text-blue-50 font-semibold">
          <CheckCircle className="w-5 h-5 text-blue-200" />
          <span>HIPAA Compliant</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-base text-blue-50 font-semibold">
          <CheckCircle className="w-5 h-5 text-blue-200" />
          <span>24/7 Enterprise Support</span>
        </div>
      </div>
    </div>
  </section>
);

export const Hero: Story = {
  render: () => <HeroSection />,
};

export const FeatureCards: Story = {
  render: () => (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold mb-6">Feature Cards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <FeatureCard
          icon={Activity}
          title="Business Rule Enforcement"
          description="Define critical business and operational rules that must never be violated. FLUO continuously monitors your systems to detect when these essential guardrails are breached."
          iconColor="blue"
          benefit="Proactive risk prevention"
        />

        <FeatureCard
          icon={Code}
          title="Powerful OGNL Rules"
          description="Write sophisticated behavioral rules using Object-Graph Navigation Language. No complex DSLs to learn - just expressive, readable logic."
          iconColor="purple"
          benefit="Type-safe rule validation"
        />

        <FeatureCard
          icon={Users}
          title="Collaborative Investigation"
          description="Built-in collaboration tools let teams investigate signals together. Share context, add notes, and build institutional knowledge."
          iconColor="green"
          benefit="Rich trace context integration"
        />

        <FeatureCard
          icon={Clock}
          title="Real-time Processing"
          description="Sub-second latency from telemetry ingestion to signal generation. WebSocket-powered dashboards keep your team informed."
          iconColor="purple"
          benefit="<100ms processing latency"
        />

        <FeatureCard
          icon={Globe}
          title="Enterprise Security"
          description="SOC2 compliant with WorkOS SSO integration, role-based access control, and comprehensive audit logging."
          iconColor="orange"
          benefit="Zero-trust architecture"
        />

        <FeatureCard
          icon={BarChart3}
          title="Open Standards"
          description="Built on OpenTelemetry standards with no vendor lock-in. Works with your existing observability stack."
          iconColor="cyan"
          benefit="OTEL-native architecture"
        />
      </div>
    </div>
  ),
};

export const StatsSection: Story = {
  render: () => (
    <section className="py-16 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Trusted by Critical Industries
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Purpose-built for organizations where reliability and compliance are non-negotiable
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <StatsCard
            title="Faster MTTR"
            value="85%"
            icon={Zap}
            iconColor="green"
          />

          <StatsCard
            title="Uptime SLA"
            value="99.9%"
            icon={Shield}
            iconColor="blue"
          />

          <StatsCard
            title="Setup Time"
            value="<5min"
            icon={Clock}
            iconColor="amber"
          />

          <StatsCard
            title="Spans/Day"
            value="2M+"
            icon={BarChart3}
            iconColor="blue"
          />
        </div>
      </div>
    </section>
  ),
};

export const CallToAction: Story = {
  render: () => (
    <div className="p-8">
      <CTASection />
    </div>
  ),
};

export const TrustBadges: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Trust Indicators</h3>

      {/* Professional Value Propositions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Prevent Customer Impact</span>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Sub-100ms Detection</span>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Enterprise Security</span>
        </div>
      </div>

      {/* Compliance Badges */}
      <div className="flex flex-wrap gap-4">
        <div className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm">
          <Shield className="w-4 h-4 mr-2" />
          SOC 2 Type II
        </div>
        <div className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md font-medium text-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          HIPAA Compliant
        </div>
        <div className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-md font-medium text-sm">
          <Shield className="w-4 h-4 mr-2" />
          FedRAMP Authorized
        </div>
      </div>
    </div>
  ),
};