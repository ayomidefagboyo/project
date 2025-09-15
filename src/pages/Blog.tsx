import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight, User, Filter, Search } from 'lucide-react';
import { blogPosts, blogCategories, getFeaturedPost, getPostsByCategory } from '../data/blogPosts';
import { Helmet } from 'react-helmet-async';
import PublicHeader from '@/components/layout/PublicHeader';

const Blog: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 6;

  const featuredPost = getFeaturedPost();
  const filteredPosts = getPostsByCategory(activeCategory)
    .filter(post =>
      searchTerm === '' ||
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const currentPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Compazz Financial Management Blog",
    "description": "Expert insights on financial management, AI automation, business calculators, and growth strategies for modern businesses.",
    "url": "https://compazz.app/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Compazz",
      "url": "https://compazz.app"
    },
    "blogPost": blogPosts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "url": `https://compazz.app/blog/${post.slug}`,
      "datePublished": post.date,
      "author": {
        "@type": "Person",
        "name": post.author
      }
    }))
  };

  return (
    <>
      <Helmet>
        <title>Financial Management Blog - Expert Insights | Compazz</title>
        <meta name="description" content="Expert insights on financial management, AI automation, business calculators, and growth strategies. Learn from industry experts at Compazz." />
        <meta name="keywords" content="financial management blog, business finance tips, AI automation, financial calculators, accounting insights, business growth" />
        <link rel="canonical" href="https://compazz.app/blog" />

        {/* Open Graph */}
        <meta property="og:title" content="Financial Management Blog - Expert Insights | Compazz" />
        <meta property="og:description" content="Expert insights on financial management, AI automation, business calculators, and growth strategies." />
        <meta property="og:url" content="https://compazz.app/blog" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Financial Management Blog - Expert Insights | Compazz" />
        <meta name="twitter:description" content="Expert insights on financial management, AI automation, business calculators, and growth strategies." />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <PublicHeader />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-32 space-y-8">
                {/* Search */}
                <div>
                  <div className="flex items-center mb-4">
                    <Search className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-medium text-gray-900 text-sm">Search</h3>
                  </div>
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                {/* Categories */}
                <div>
                  <div className="flex items-center mb-6">
                    <Filter className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-medium text-gray-900 text-sm">Categories</h3>
                  </div>
                  <ul className="space-y-1">
                    {blogCategories.map((category) => (
                      <li key={category.id}>
                        <button
                          onClick={() => handleCategoryChange(category.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                            activeCategory === category.id
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

                {/* Newsletter Signup */}
                <div className="bg-white rounded-2xl p-8 border border-gray-100">
                  <h4 className="font-medium text-gray-900 mb-3 text-sm">Stay Updated</h4>
                  <p className="text-sm text-gray-500 mb-6 font-light leading-relaxed">
                    Get the latest financial insights delivered to your inbox.
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
              {activeCategory === 'all' && (
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
              )}

              {searchTerm && (
                <div className="flex justify-end mb-8">
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Posts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
                {currentPosts.map((post) => {
                  const IconComponent = post.icon;
                  return (
                    <article key={post.id} className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group">
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex items-center space-x-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Results Info - moved to bottom */}
              <div className="mt-8 text-center">
                <p className="text-gray-600 text-sm">
                  Showing {startIndex + 1}-{Math.min(startIndex + postsPerPage, filteredPosts.length)} of {filteredPosts.length} articles
                  {activeCategory !== 'all' && (
                    <span className="ml-2 text-gray-400">
                      in {blogCategories.find(cat => cat.id === activeCategory)?.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter CTA */}
        <section className="py-20 bg-white">
          <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-light text-gray-900 mb-6 tracking-tight">
              Never miss an insight
            </h2>
            <p className="text-lg text-gray-600 mb-10 font-light leading-relaxed">
              Get expert financial management tips, calculator guides, and business growth strategies delivered to your inbox.
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
                  <li><Link to="/#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link to="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link to="/calculators" className="hover:text-white transition-colors">Calculators</Link></li>
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
    </>
  );
};

export default Blog;