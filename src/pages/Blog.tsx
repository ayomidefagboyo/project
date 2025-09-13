import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight, User, Brain, Building2, BarChart3, Smartphone, TrendingUp, Shield, Sun, Filter } from 'lucide-react';

const Blog: React.FC = () => {
  const featuredPost = {
    title: "How AI is Revolutionizing Small Business Finance Management",
    excerpt: "Discover how artificial intelligence and machine learning are transforming the way small and medium businesses handle their finances, from automated bookkeeping to predictive analytics.",
    author: "Sarah Chen",
    date: "March 15, 2024",
    readTime: "8 min read",
    icon: Brain,
    tags: ["AI", "Finance", "Technology"],
    slug: "ai-revolutionizing-finance"
  };

  const posts = [
    {
      title: "5 Ways Multi-Location Businesses Can Streamline Financial Operations",
      excerpt: "Learn proven strategies to centralize financial management across multiple outlets while maintaining operational efficiency.",
      author: "Marcus Rodriguez",
      date: "March 12, 2024",
      readTime: "6 min read",
      icon: Building2,
      tags: ["Multi-Location", "Operations", "Finance"],
      slug: "streamline-multi-location-finance"
    },
    {
      title: "The ROI of Automated Invoice Processing: A Case Study",
      excerpt: "See how Bloom Restaurants reduced their invoice processing time by 90% and improved accuracy to 99.5% with automation.",
      author: "Emily Watson",
      date: "March 10, 2024",
      readTime: "5 min read",
      icon: BarChart3,
      tags: ["Automation", "Case Study", "ROI"],
      slug: "automated-invoice-processing-roi"
    },
    {
      title: "Mobile-First Financial Management: Why It Matters",
      excerpt: "Explore why mobile-first design is crucial for modern financial management and how it improves team productivity.",
      author: "Alex Chen",
      date: "March 8, 2024",
      readTime: "4 min read",
      icon: Smartphone,
      tags: ["Mobile", "UX", "Productivity"],
      slug: "mobile-first-financial-management"
    },
    {
      title: "Understanding Financial Analytics for Restaurant Chains",
      excerpt: "A comprehensive guide to key financial metrics and analytics that restaurant chains should track for better decision making.",
      author: "Sarah Chen",
      date: "March 5, 2024",
      readTime: "7 min read",
      icon: TrendingUp,
      tags: ["Analytics", "Restaurants", "Metrics"],
      slug: "financial-analytics-restaurants"
    },
    {
      title: "Security Best Practices for Financial Data Management",
      excerpt: "Learn essential security measures to protect sensitive financial data in multi-outlet business environments.",
      author: "Marcus Rodriguez",
      date: "March 3, 2024",
      readTime: "6 min read",
      icon: Shield,
      tags: ["Security", "Data Protection", "Compliance"],
      slug: "financial-data-security"
    },
    {
      title: "The Future of End-of-Day Reporting: Trends and Predictions",
      excerpt: "Explore emerging trends in EOD reporting and how technology is making financial reconciliation faster and more accurate.",
      author: "Emily Watson",
      date: "March 1, 2024",
      readTime: "5 min read",
      icon: Sun,
      tags: ["EOD", "Future", "Trends"],
      slug: "future-eod-reporting"
    }
  ];

  const categories = [
    { name: "All Posts", count: 25, active: true },
    { name: "AI & Technology", count: 8, active: false },
    { name: "Finance Tips", count: 7, active: false },
    { name: "Case Studies", count: 5, active: false },
    { name: "Product Updates", count: 5, active: false }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 z-50">
        <nav className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-medium text-gray-900 tracking-tight">Compazz</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-12">
              <Link to="/#features" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Features</Link>
              <Link to="/#pricing" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</Link>
              <Link to="/about" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">About</Link>
              <Link to="/blog" className="text-gray-900 font-medium text-sm">Blog</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Sign In</Link>
              <Link to="/dashboard" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-6xl lg:text-7xl font-light text-gray-900 mb-8 tracking-tight leading-none">
            Insights
          </h1>
          <p className="text-xl text-gray-600 font-light leading-relaxed max-w-2xl mx-auto">
            Everything you need to know about modern financial management, AI automation, and growing your business.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              <div>
                <div className="flex items-center mb-6">
                  <Filter className="w-5 h-5 text-gray-400 mr-2" />
                  <h3 className="font-medium text-gray-900 text-sm">Categories</h3>
                </div>
                <ul className="space-y-1">
                  {categories.map((category, index) => (
                    <li key={index}>
                      <button
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                          category.active
                            ? 'bg-gray-900 text-white font-medium'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{category.name}</span>
                          <span className="text-xs opacity-60">{category.count}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-100">
                <h4 className="font-medium text-gray-900 mb-3 text-sm">Stay Updated</h4>
                <p className="text-sm text-gray-500 mb-6 font-light leading-relaxed">
                  Get the latest insights delivered to your inbox.
                </p>
                <button className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all duration-200">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4">
            {/* Featured Post */}
            <article className="bg-white rounded-3xl border border-gray-100 overflow-hidden mb-16 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
              <div className="p-10 lg:p-12">
                <div className="flex items-center mb-6">
                  <span className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                    Featured
                  </span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{featuredPost.author}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{featuredPost.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>{featuredPost.readTime}</span>
                      </div>
                    </div>
                    
                    <h2 className="text-3xl lg:text-4xl font-light text-gray-900 leading-tight tracking-tight">
                      <Link to={`/blog/${featuredPost.slug}`} className="hover:text-gray-600 transition-colors">
                        {featuredPost.title}
                      </Link>
                    </h2>
                    
                    <p className="text-gray-600 text-lg leading-relaxed font-light">
                      {featuredPost.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex flex-wrap gap-2">
                        {featuredPost.tags.map((tag, index) => (
                          <span key={index} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <Link
                        to={`/blog/${featuredPost.slug}`}
                        className="inline-flex items-center text-gray-900 font-medium hover:text-gray-600 transition-colors group text-sm"
                      >
                        Read More
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-1 flex items-center justify-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <featuredPost.icon className="w-12 h-12 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Recent Posts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
              {posts.map((post, index) => {
                const IconComponent = post.icon;
                return (
                  <article key={index} className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                        <IconComponent className="w-7 h-7 text-gray-400" />
                      </div>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock className="w-3 h-3 mr-1.5" />
                        {post.readTime}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3 h-3" />
                        <span>{post.author}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>{post.date}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-light text-gray-900 mb-4 leading-tight tracking-tight group-hover:text-gray-600 transition-colors">
                      <Link to={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h3>
                    
                    <p className="text-gray-600 text-sm leading-relaxed font-light mb-6">
                      {post.excerpt}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 2).map((tag, tagIndex) => (
                        <span key={tagIndex} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Load More */}
            <div className="text-center">
              <button className="bg-white border border-gray-200 text-gray-600 px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200">
                Load More Posts
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-light text-gray-900 mb-6 tracking-tight">
            Never miss an update
          </h2>
          <p className="text-lg text-gray-600 mb-10 font-light leading-relaxed">
            Get the latest insights on financial management, AI automation, and business growth delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row max-w-md mx-auto gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-light"
            />
            <button className="bg-gray-900 text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4 font-light">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <div className="text-xl font-medium mb-6 tracking-tight">Compazz</div>
              <p className="text-gray-400 font-light leading-relaxed text-sm">
                AI-powered financial management for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Product</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Company</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Support</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><a href="mailto:support@compazz.com" className="hover:text-white transition-colors">Contact</a></li>
                <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400 text-sm font-light">
            <p>&copy; 2024 Compazz. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Blog;