import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { StyledCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/styled-card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Shield, Zap, Eye, ArrowRight, CheckCircle, TrendingUp,
  Clock, Users, Globe, Code, BarChart3, AlertTriangle, PlayCircle
} from 'lucide-react';

const meta: Meta = {
  title: 'FLUO/Landing',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Hero Section Component
const HeroSection = () => (
  <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-purple-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
    {/* Animated background elements */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-32 w-[500px] h-[500px] bg-gradient-to-br from-blue-500/30 to-cyan-400/20 rounded-full blur-3xl animate-pulse opacity-70"></div>
      <div className="absolute -bottom-40 -left-32 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/25 to-pink-400/15 rounded-full blur-3xl animate-pulse delay-1000 opacity-60"></div>
    </div>

    <div className="container mx-auto px-4 py-24 relative z-10">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none">
            <span className="block bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-gray-100 dark:to-gray-200 bg-clip-text text-transparent drop-shadow-sm">
              Stop System
            </span>
            <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent font-extrabold animate-pulse">
              Behavioral Chaos
            </span>
          </h1>

          <p className="mx-auto max-w-4xl text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-300 leading-tight">
            Before It Impacts Your Customers
          </p>

          <div className="flex items-center justify-center gap-3">
            <div className="h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent w-20"></div>
            <span className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 dark:border-blue-700/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Real-time Behavioral Assurance
            </span>
            <div className="h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent w-20"></div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
            <Button size="lg" className="relative px-12 py-6 text-xl font-black bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 hover:from-emerald-600 hover:via-blue-600 hover:to-purple-700 text-white border-0 shadow-2xl hover:shadow-emerald-500/30 transition-all duration-500 rounded-2xl group-hover:scale-105">
              <Zap className="h-5 w-5 mr-2 animate-pulse" />
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-500" />
            </Button>
          </div>

          <Button variant="outline" size="lg" className="px-8 py-6 text-lg font-bold border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white/60 dark:bg-slate-800/60 hover:bg-blue-50/80 dark:hover:bg-blue-900/30 backdrop-blur-sm transition-all duration-300 rounded-2xl hover:scale-105">
            <PlayCircle className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            Watch Demo
          </Button>
        </div>
      </div>
    </div>
  </section>
);

// Feature Card Component
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  iconColor = 'blue',
  benefit
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor?: string;
  benefit: string;
}) => {
  const iconColors = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };

  return (
    <StyledCard className="border-2 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${iconColors[iconColor as keyof typeof iconColors]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <CardDescription className="text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`flex items-center gap-2 text-sm font-medium ${iconColor === 'blue' ? 'text-blue-500' : iconColor === 'green' ? 'text-green-500' : iconColor === 'purple' ? 'text-purple-500' : iconColor === 'orange' ? 'text-orange-500' : 'text-cyan-500'}`}>
          <CheckCircle className="w-4 h-4" />
          <span>{benefit}</span>
        </div>
      </CardContent>
    </StyledCard>
  );
};

// Stats Card Component
const StatsCard = ({ value, label, description, gradient }: {
  value: string;
  label: string;
  description: string;
  gradient: string;
}) => (
  <div className="group relative">
    <div className={`absolute -inset-1 bg-gradient-to-r ${gradient} rounded-3xl blur-lg opacity-20 group-hover:opacity-30 transition duration-300`}></div>
    <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-8 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
      <div className="text-center space-y-3">
        <div className={`text-5xl font-black bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {value}
        </div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {description}
        </p>
      </div>
    </div>
  </div>
);

// CTA Section Component
const CTASection = () => (
  <StyledCard className="max-w-4xl mx-auto text-center shadow-2xl">
    <CardHeader className="pb-8 pt-12">
      <CardTitle className="text-3xl sm:text-4xl font-bold mb-4">
        Stop Fighting Fires.
        <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent">
          Start Preventing Them.
        </span>
      </CardTitle>
      <CardDescription className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
        Join hundreds of engineering teams who've reduced their MTTR by 85% and eliminated alert fatigue with FLUO's intelligent observability platform.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
        <Button size="lg" className="px-12 py-6 text-xl font-bold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-2xl hover:shadow-orange-500/25 hover:scale-105 transition-all duration-300 rounded-2xl">
          <Zap className="h-6 w-6 mr-3 animate-pulse" />
          START FREE TRIAL
          <ArrowRight className="ml-3 h-6 w-6" />
        </Button>

        <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 rounded-xl">
          <Eye className="mr-2 h-5 w-5" />
          Learn More
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>14-day free trial</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>No credit card required</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Cancel anytime</span>
        </div>
      </div>
    </CardContent>
  </StyledCard>
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
    <div className="space-y-8 p-8 bg-gradient-to-b from-transparent via-slate-50/30 to-transparent dark:via-slate-800/30">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
            Trusted by Engineering Teams
          </span>
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
          Join hundreds of teams preventing system chaos before it impacts customers
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          value="85%"
          label="Faster MTTR"
          description="Average incident resolution time"
          gradient="from-blue-600 to-purple-600"
        />

        <StatsCard
          value="99.9%"
          label="Uptime SLA"
          description="System reliability guarantee"
          gradient="from-emerald-600 to-cyan-600"
        />

        <StatsCard
          value="<5min"
          label="Setup Time"
          description="From install to first alert"
          gradient="from-purple-600 to-pink-600"
        />

        <StatsCard
          value="2M+"
          label="Spans/Day"
          description="Telemetry data processed"
          gradient="from-orange-600 to-red-600"
        />
      </div>
    </div>
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
    <div className="space-y-8">
      <h3 className="text-2xl font-bold mb-6">Trust Badges</h3>

      {/* Trial Badge */}
      <div className="inline-flex items-center px-6 py-4 bg-gradient-to-r from-emerald-50/80 to-blue-50/80 dark:from-emerald-900/20 dark:to-blue-900/20 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/30 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-emerald-500/20 rounded-full">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-black text-emerald-700 dark:text-emerald-300 text-lg">FREE 14-Day Trial</span>
          </div>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
            <span>No Credit Card</span>
            <span>5-Min Setup</span>
            <span>Cancel Anytime</span>
          </div>
        </div>
      </div>

      {/* Benefit Badges */}
      <div className="flex flex-wrap gap-4">
        <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 hover:from-emerald-500/20 hover:to-green-500/20 border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm transition-all duration-300 hover:scale-105">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">Prevent Customer Impact</span>
        </div>

        <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm transition-all duration-300 hover:scale-105">
          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-800 dark:text-blue-300">Sub-100ms Alerts</span>
        </div>

        <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm transition-all duration-300 hover:scale-105">
          <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-purple-800 dark:text-purple-300">Reduce System Risk</span>
        </div>
      </div>
    </div>
  ),
};