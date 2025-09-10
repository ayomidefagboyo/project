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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold text-blue-600">Compazz</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link to="/about" className="text-blue-600 font-medium">About</Link>
              <Link to="/blog" className="text-gray-600 hover:text-gray-900 font-medium">Blog</Link>
              <Link to="/docs" className="text-gray-600 hover:text-gray-900 font-medium">Docs</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
              <Link to="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Heart className="w-4 h-4 mr-2" />
            Built by finance professionals, for finance professionals
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Simplifying finance for
            <span className="text-blue-600 block">modern businesses</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            We're a team of finance and technology experts on a mission to make financial management effortless, accurate, and accessible for businesses of all sizes.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-4xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Our Story</h2>
              <div className="prose prose-lg text-gray-600 space-y-4">
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
                  <div className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">{milestone.year}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{milestone.title}</h3>
                    <p className="text-gray-600">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="text-blue-600 flex justify-center mb-4">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Meet the Team</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're a diverse team of finance and technology experts united by a passion for solving complex problems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mx-auto mb-4">
                  {member.avatar}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">{member.name}</h3>
                <p className="text-blue-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 text-sm mb-4">{member.bio}</p>
                <div className="flex justify-center space-x-3">
                  <a href={member.linkedin} className="text-gray-400 hover:text-blue-600">
                    <Linkedin className="w-5 h-5" />
                  </a>
                  <a href={member.twitter} className="text-gray-400 hover:text-blue-600">
                    <Twitter className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investors */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-8">Backed by world-class investors</h3>
          <div className="flex justify-center items-center space-x-12 opacity-60">
            <div className="text-2xl font-bold">Sequoia Capital</div>
            <div className="text-2xl font-bold">Andreessen Horowitz</div>
            <div className="text-2xl font-bold">Index Ventures</div>
            <div className="text-2xl font-bold">Y Combinator</div>
          </div>
        </div>
      </section>

      {/* Join Us */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Join us on our mission
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            We're always looking for talented individuals who share our passion for building the future of business finance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/careers" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center">
              View Open Positions
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <a 
              href="mailto:hello@compazz.com" 
              className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-white hover:text-blue-600 transition-colors flex items-center justify-center"
            >
              Get in Touch
              <Mail className="w-5 h-5 ml-2" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-4">Compazz</div>
              <p className="text-gray-400 mb-4">
                AI-powered financial management for modern businesses.
              </p>
              <div className="flex items-center text-gray-400">
                <MapPin className="w-4 h-4 mr-2" />
                San Francisco, CA
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="mailto:support@compazz.com" className="hover:text-white">Contact</a></li>
                <li><Link to="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link to="/status" className="hover:text-white">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Compazz. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;