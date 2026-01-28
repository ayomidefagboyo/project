import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ArrowLeft } from 'lucide-react';

const Cookies: React.FC = () => {
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
              <div className="w-16 h-16 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl flex items-center justify-center">
                <Cookie className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h1 className="text-4xl font-semibold text-foreground mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground text-lg">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">What Are Cookies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Cookies</h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    We use cookies for several purposes:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>To keep you logged in to your account</li>
                    <li>To remember your preferences and settings</li>
                    <li>To analyze website traffic and usage patterns</li>
                    <li>To improve our services and user experience</li>
                    <li>To provide personalized content and features</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Types of Cookies We Use</h2>
                <div className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-medium text-foreground mb-2">Essential Cookies</h3>
                    <p className="text-muted-foreground text-sm">
                      These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and accessibility.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-medium text-foreground mb-2">Functional Cookies</h3>
                    <p className="text-muted-foreground text-sm">
                      These cookies allow the website to remember choices you make and provide enhanced, more personal features.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-medium text-foreground mb-2">Analytics Cookies</h3>
                    <p className="text-muted-foreground text-sm">
                      These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-medium text-foreground mb-2">Marketing Cookies</h3>
                    <p className="text-muted-foreground text-sm">
                      These cookies track your browsing habits to enable us to show advertising which is more likely to be of interest to you.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Cookies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may also use third-party services that place cookies on your device. These include:
                </p>
                <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-1">
                  <li>Google Analytics for website analytics</li>
                  <li>Stripe for payment processing</li>
                  <li>Authentication providers for secure login</li>
                  <li>Content delivery networks for performance</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Managing Cookies</h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    You can control and manage cookies in several ways:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Use your browser settings to block or delete cookies</li>
                    <li>Set your browser to notify you when cookies are being used</li>
                    <li>Use our cookie preferences center (when available)</li>
                    <li>Opt out of third-party cookies through their respective websites</li>
                  </ul>
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-4">
                    <p className="text-amber-800 dark:text-amber-200 text-sm">
                      <strong>Note:</strong> Disabling certain cookies may affect the functionality of our website and your user experience.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Cookie Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The length of time cookies remain on your device depends on their type:
                </p>
                <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-1">
                  <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
                  <li><strong>Persistent cookies:</strong> Remain until they expire or you delete them</li>
                  <li><strong>Authentication cookies:</strong> Usually valid for 30 days</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Updates to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Cookie Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of any significant changes by posting the updated policy on this page.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about our use of cookies, please contact us:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-foreground font-medium">Email: privacy@compazz.com</p>
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

export default Cookies;