import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Target, 
  Users, 
  Lightbulb, 
  Award,
  Heart,
  MapPin,
  Linkedin,
  Twitter,
  Mail,
  ArrowRight,
  Building2,
  TrendingUp,
  Shield
} from 'lucide-react';

const About: React.FC = () => {
  const values = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Mission-Driven",
      description: "We're on a mission to democratize advanced financial management tools for businesses of all sizes."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Customer-Centric",
      description: "Every feature we build starts with understanding real problems faced by business owners and finance teams."
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: "Innovation First",
      description: "We leverage cutting-edge AI and machine learning to solve complex financial management challenges."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Trust & Security",
      description: "Your financial data deserves the highest level of security. We're committed to protecting your business."
    }
  ];

  const team = [
    {
      name: "Alex Chen",
      role: "CEO & Co-founder",
      bio: "Former McKinsey consultant with 10+ years in FinTech. Built and sold two startups focusing on SMB finance.",
      avatar: "AC",
      linkedin: "#",
      twitter: "#"
    },
    {
      name: "Sarah Rodriguez",
      role: "CTO & Co-founder",
      bio: "Ex-Google AI researcher. Led engineering teams at Stripe and Square building financial infrastructure.",
      avatar: "SR",
      linkedin: "#",
      twitter: "#"
    },
    {
      name: "Marcus Johnson",
      role: "VP of Product",
      bio: "Former Intuit product lead. Passionate about building user-centric financial tools for small businesses.",
      avatar: "MJ",
      linkedin: "#",
      twitter: "#"
    },
    {
      name: "Emily Watson",
      role: "Head of Design",
      bio: "Design veteran from Airbnb and Uber. Believes great design should make complex workflows feel simple.",
      avatar: "EW",
      linkedin: "#",
      twitter: "#"
    }
  ];

  const stats = [
    {
      number: "10K+",
      label: "Businesses served"
    },
    {
      number: "50M+",
      label: "Documents processed"
    },
    {
      number: "99.9%",
      label: "Uptime guarantee"
    },
    {
      number: "24/7",
      label: "Customer support"
    }
  ];

  const milestones = [
    {
      year: "2022",
      title: "Company Founded",
      description: "Started with a vision to bring AI-powered financial management to small businesses"
    },
    {
      year: "2023",
      title: "Product Launch",
      description: "Launched our MVP with basic invoice scanning and multi-outlet management"
    },
    {
      year: "2023",
      title: "AI Integration",
      description: "Integrated GPT-4 and advanced OCR for 95%+ accuracy in document processing"
    },
    {
      year: "2024",
      title: "Series A Funding",
      description: "$15M Series A led by Sequoia Capital to accelerate growth and product development"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border z-50">
        <nav className="container-width px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img src="/logo.svg" alt="Compazz" className="h-8" />
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Features</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Pricing</Link>
              <Link to="/about" className="text-foreground font-medium transition-colors">About</Link>
              <Link to="/blog" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Blog</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
                Sign In
              </Link>
              <Link to="/dashboard" className="btn-primary px-6 py-2.5">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-24 section-padding bg-gradient-to-br from-accent/30 to-secondary/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-accent border border-border rounded-full text-sm font-medium mb-8">
            <Heart className="w-4 h-4 mr-2 text-accent-foreground" />
            Built by finance professionals, for finance professionals
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-[1.1] text-balance">
            Simplifying finance for
            <span className="block">modern businesses</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed text-balance">
            We're a team of finance and technology experts on a mission to make financial management effortless, accurate, and accessible for businesses of all sizes.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-background">
        <div className="container-width px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-4xl font-semibold text-primary mb-2">{stat.number}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">Our Story</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Compazz was born from frustration. As finance professionals, we watched businesses struggle with outdated tools, manual processes, and scattered data across multiple locations.
                </p>
                <p>
                  The breaking point came when we saw a restaurant chain owner spending 40 hours a week just collecting and reconciling financial data from their 12 locations. There had to be a better way.
                </p>
                <p>
                  We set out to build the financial management platform we wished existed - one that leverages AI to automate tedious tasks, provides real-time insights, and scales seamlessly with growing businesses.
                </p>
                <p>
                  Today, Compazz helps thousands of businesses save time, reduce errors, and make better financial decisions. But we're just getting started.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-accent rounded-xl flex items-center justify-center border border-border">
                    <span className="text-accent-foreground font-semibold">{milestone.year}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-background">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">Our Values</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-6">
                  <div className="text-accent-foreground">
                    {value.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">Meet the Team</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              We're a diverse team of finance and technology experts united by a passion for solving complex problems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="card p-6 text-center">
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-semibold text-xl mx-auto mb-4">
                  {member.avatar}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-1">{member.name}</h3>
                <p className="text-primary font-medium mb-3">{member.role}</p>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{member.bio}</p>
                <div className="flex justify-center space-x-3">
                  <a href={member.linkedin} className="text-muted-foreground hover:text-primary transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                  <a href={member.twitter} className="text-muted-foreground hover:text-primary transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investors */}
      <section className="py-16 bg-background">
        <div className="container-width px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-semibold text-foreground mb-8">Backed by world-class investors</h3>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            <div className="text-xl font-semibold text-muted-foreground">Sequoia Capital</div>
            <div className="text-xl font-semibold text-muted-foreground">Andreessen Horowitz</div>
            <div className="text-xl font-semibold text-muted-foreground">Index Ventures</div>
            <div className="text-xl font-semibold text-muted-foreground">Y Combinator</div>
          </div>
        </div>
      </section>

      {/* Join Us */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold mb-8 text-balance">
            Join us on our mission
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-2xl mx-auto text-balance">
            We're always looking for talented individuals who share our passion for building the future of business finance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/careers" className="bg-primary-foreground text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-foreground/90 transition-all group inline-flex items-center justify-center">
              View Open Positions
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <a 
              href="mailto:hello@compazz.com" 
              className="border-2 border-primary-foreground/20 text-primary-foreground px-8 py-3.5 rounded-lg font-medium text-lg hover:bg-primary-foreground/10 transition-all inline-flex items-center justify-center"
            >
              Get in Touch
              <Mail className="w-5 h-5 ml-2" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-16">
        <div className="container-width px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <img src="/logo-white.svg" alt="Compazz" className="h-8" />
              </div>
              <p className="text-primary-foreground/70 mb-6 leading-relaxed">
                AI-powered financial management for modern businesses.
              </p>
              <div className="flex items-center text-primary-foreground/70">
                <MapPin className="w-4 h-4 mr-2" />
                San Francisco, CA
              </div>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Product</h4>
              <ul className="space-y-3">
                <li><Link to="/features" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Pricing</Link></li>
                <li><Link to="/docs" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/about" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">About</Link></li>
                <li><Link to="/blog" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Support</h4>
              <ul className="space-y-3">
                <li><a href="mailto:support@compazz.com" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Contact</a></li>
                <li><Link to="/help" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-12 pt-8 text-center">
            <p className="text-primary-foreground/50">&copy; 2024 Compazz. All rights reserved. Built with care for modern businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;