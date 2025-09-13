import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-width py-4">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Home</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="container-width section-padding">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h1 className="text-4xl font-semibold text-foreground mb-4">Terms of Service</h1>
            <p className="text-muted-foreground text-lg">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using the Compazz platform and services, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Compazz provides a comprehensive financial management platform designed for businesses to track expenses, manage invoices, generate reports, and gain insights into their financial operations across multiple outlets.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">User Accounts and Responsibilities</h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    To use our services, you must create an account and provide accurate information. You are responsible for:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Providing accurate and up-to-date information</li>
                    <li>Complying with all applicable laws and regulations</li>
                    <li>Using the service only for lawful business purposes</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Subscription and Payment</h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Our services are offered on a subscription basis. By subscribing, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Pay all fees associated with your chosen plan</li>
                    <li>Automatic renewal unless cancelled</li>
                    <li>Price changes with 30 days notice</li>
                    <li>Refund policy as outlined in our billing terms</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Data Ownership and Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You retain ownership of all data you input into our platform. We implement industry-standard security measures to protect your data, but you acknowledge that no system is completely secure and use our service at your own risk.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Prohibited Uses</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You may not use our service to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Violate any laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Distribute malware or harmful code</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Use the service for competitive analysis or reverse engineering</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Service Availability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We strive to maintain high availability but cannot guarantee uninterrupted service. We may temporarily suspend service for maintenance, updates, or other operational reasons with notice when possible.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, Compazz shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Either party may terminate the service agreement at any time. Upon termination, your access to the service will cease, and we may delete your data according to our data retention policies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update these terms from time to time. We will notify you of significant changes and your continued use of the service constitutes acceptance of the updated terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-foreground font-medium">Email: legal@compazz.com</p>
                  <p className="text-muted-foreground">Address: [Your Business Address]</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;