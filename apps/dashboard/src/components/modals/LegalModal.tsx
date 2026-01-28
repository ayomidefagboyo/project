import React from 'react';
import { X, Shield, FileText, Cookie } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | 'cookies';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const getContent = () => {
    switch (type) {
      case 'privacy':
        return {
          icon: Shield,
          title: 'Privacy Policy',
          content: (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Information We Collect</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                  We collect information you provide directly to us, such as account details, business information, and financial data necessary to provide our services.
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                  <li>Name, email, and contact information</li>
                  <li>Business and outlet details</li>
                  <li>Financial data and transactions</li>
                  <li>Usage patterns and preferences</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">How We Use Your Information</h3>
                <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                  <li>Provide and improve our services</li>
                  <li>Process transactions and billing</li>
                  <li>Send updates and support communications</li>
                  <li>Analyze usage to enhance user experience</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Data Security</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Your Rights</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You have the right to access, update, correct, or delete your personal information. Contact us at privacy@compazz.com for any privacy-related inquiries.
                </p>
              </section>
            </div>
          )
        };

      case 'terms':
        return {
          icon: FileText,
          title: 'Terms of Service',
          content: (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Service Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Compazz provides financial management tools for businesses to track expenses, manage invoices, and generate insights across multiple outlets.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">User Responsibilities</h3>
                <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                  <li>Maintain account security and confidentiality</li>
                  <li>Provide accurate and up-to-date information</li>
                  <li>Use the service for lawful business purposes only</li>
                  <li>Comply with all applicable laws and regulations</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Payment Terms</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Subscription fees are billed in advance. Services continue until cancelled. We reserve the right to modify pricing with 30 days notice.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Limitation of Liability</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Our liability is limited to the amount paid for the service. We are not liable for indirect or consequential damages.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Contact</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Questions about these terms? Contact us at legal@compazz.com
                </p>
              </section>
            </div>
          )
        };

      case 'cookies':
        return {
          icon: Cookie,
          title: 'Cookie Policy',
          content: (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">What Are Cookies</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Cookies are small text files stored on your device to help us provide a better experience and understand how you use our service.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Types of Cookies</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-foreground text-sm mb-1">Essential Cookies</h4>
                    <p className="text-muted-foreground text-xs">Required for basic website functionality and security.</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-foreground text-sm mb-1">Analytics Cookies</h4>
                    <p className="text-muted-foreground text-xs">Help us understand usage patterns to improve our service.</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-foreground text-sm mb-1">Functional Cookies</h4>
                    <p className="text-muted-foreground text-xs">Remember your preferences and settings.</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Managing Cookies</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You can control cookies through your browser settings. Note that disabling certain cookies may affect website functionality.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-3">Third-Party Services</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We use Google Analytics, Stripe, and other services that may place their own cookies. Each service has its own privacy policy.
                </p>
              </section>
            </div>
          )
        };

      default:
        return { icon: Shield, title: '', content: null };
    }
  };

  const { icon: Icon, title, content } = getContent();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
          {content}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Questions? Contact us at privacy@compazz.com
            </p>
            <button
              onClick={onClose}
              className="btn-primary px-4 py-2 text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;