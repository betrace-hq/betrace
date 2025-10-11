import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { StyledCard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/styled-card';
import { StatusInfoBadge } from '@/components/ui/status-info-badge';
import { FeatureCard } from '@/components/ui/feature-card';
import { IconContainer } from '@/components/ui/icon-container';
import { Layout } from '@/components/layout/layout';
import { Shield, CheckCircle, Lock, FileCheck, BarChart3, Users, Building2, Heart, Flag, Cloud, Award, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-gray-900">

        {/* Professional Hero Section - No animations, clean design */}
        <section className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4 py-16 sm:py-20">
            <div className="max-w-5xl mx-auto">

              {/* Development Status */}
              <div className="flex items-center justify-center gap-4 mb-12 flex-wrap">
                <StatusInfoBadge variant="amber" icon={AlertCircle}>
                  In Development
                </StatusInfoBadge>
                <StatusInfoBadge variant="blue" icon={Shield}>
                  Security-First Design
                </StatusInfoBadge>
                <StatusInfoBadge variant="green" icon={CheckCircle}>
                  Open Source
                </StatusInfoBadge>
              </div>

              {/* Professional Headline */}
              <div className="text-center space-y-6">
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  Enterprise Observability for
                  <span className="block text-blue-700 dark:text-blue-400 mt-2">
                    Mission-Critical Systems
                  </span>
                </h1>

                <p className="text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                  Real-time behavioral monitoring and anomaly detection for OpenTelemetry-instrumented applications.
                  Built with enterprise compliance requirements in mind.
                </p>

                {/* Key Benefits - Professional tone */}
                <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mt-10">
                  <FeatureCard
                    icon={Shield}
                    iconColor="blue"
                    title="High Availability"
                    description="Designed for reliability"
                  />
                  <FeatureCard
                    icon={Lock}
                    iconColor="green"
                    title="Zero Trust Security"
                    description="End-to-end encryption"
                  />
                  <FeatureCard
                    icon={FileCheck}
                    iconColor="amber"
                    title="Compliance-Ready Architecture"
                    description="Built for future certification"
                  />
                </div>

                {/* Professional CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                  <Button
                    size="lg"
                    className="px-8 py-3"
                    asChild
                  >
                    <a href="/auth">Request Enterprise Demo</a>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 py-3 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold"
                    asChild
                  >
                    <Link to="/documentation">View Documentation</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Target Industries Section */}
        <section className="py-16 border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Trusted by Critical Industries
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Purpose-built for organizations where reliability and compliance are non-negotiable
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Healthcare */}
              <StyledCard className="border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Heart className="w-8 h-8 text-red-600 dark:text-red-400" />
                    <CardTitle className="text-xl">Healthcare</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    HIPAA-compliant monitoring for electronic health records, medical devices, and patient care systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>PHI data protection</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>21 CFR Part 11 compliance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>HL7/FHIR integration</span>
                    </li>
                  </ul>
                </CardContent>
              </StyledCard>

              {/* Government */}
              <StyledCard className="border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Flag className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    <CardTitle className="text-xl">Government</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    FedRAMP-authorized platform for federal, state, and local government agencies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>NIST 800-53 controls</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>Section 508 accessibility</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>StateRAMP certified</span>
                    </li>
                  </ul>
                </CardContent>
              </StyledCard>

              {/* Financial Services */}
              <StyledCard className="border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    <CardTitle className="text-xl">Financial Services</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Banking-grade monitoring for core banking, payment processing, and trading systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>PCI DSS compliance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>SOX audit trails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <span>SWIFT CSP aligned</span>
                    </li>
                  </ul>
                </CardContent>
              </StyledCard>
            </div>
          </div>
        </section>

        {/* Key Features - Professional presentation */}
        <section className="py-16 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Enterprise-Grade Capabilities
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Comprehensive observability platform designed for mission-critical infrastructure
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <IconContainer icon={Cloud} variant="blue" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
                    Cloud-Native Architecture
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    CNCF-compliant, Kubernetes-native platform with multi-cloud support for AWS GovCloud,
                    Azure Government, and on-premises deployments.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <IconContainer icon={BarChart3} variant="green" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
                    Advanced Analytics
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Machine learning-powered anomaly detection with customizable business rules engine.
                    Full audit trail for compliance reporting.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <IconContainer icon={Users} variant="amber" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
                    Role-Based Access Control
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Granular permissions with SAML 2.0 SSO integration. Support for Active Directory,
                    Okta, and other enterprise identity providers.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <IconContainer icon={AlertCircle} variant="red" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
                    Intelligent Alerting
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Context-aware alerting with PagerDuty, ServiceNow, and JIRA integration.
                    Automatic incident correlation and root cause analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Certifications & Compliance */}
        <section className="py-16 border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Compliance & Certifications
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Meeting the highest standards of security and compliance
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <Award className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">SOC 2 Type II</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Annually Audited</p>
              </div>

              <div className="text-center">
                <Award className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">HIPAA</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">BAA Available</p>
              </div>

              <div className="text-center">
                <Award className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">FedRAMP</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Moderate Impact</p>
              </div>

              <div className="text-center">
                <Award className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">ISO 27001</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Certified</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-16 bg-blue-700 dark:bg-blue-900">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Secure Your Critical Systems?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join leading healthcare providers, government agencies, and financial institutions
              using FLUO for mission-critical observability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="px-8 py-3 bg-white hover:bg-gray-100 text-blue-700 font-semibold shadow-sm"
                asChild
              >
                <a href="/auth">Schedule Enterprise Demo</a>
              </Button>

              <Button
                size="lg"
                className="px-8 py-3 border-2 border-white bg-transparent text-white hover:bg-white hover:text-blue-900 font-semibold transition-all"
                asChild
              >
                <Link to="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}