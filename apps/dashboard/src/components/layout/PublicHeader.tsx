import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/ui/Logo';

const PublicHeader: React.FC = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If section doesn't exist (e.g., on calculator pages), navigate to home first
      window.location.href = `/#${id}`;
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border z-50">
      <nav className="container-width px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Logo />
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('features')} className="text-muted-foreground hover:text-foreground font-medium transition-colors">Features</button>
            <button onClick={() => scrollToSection('pricing')} className="text-muted-foreground hover:text-foreground font-medium transition-colors">Pricing</button>
            <Link to="/calculators" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Calculators</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground font-medium transition-colors">About</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Blog</Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/auth?mode=login"
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/auth?mode=signup"
              className="btn-primary px-6 py-2.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default PublicHeader;