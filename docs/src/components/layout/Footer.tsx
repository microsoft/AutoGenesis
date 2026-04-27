import { Mail } from 'lucide-react';

export const Footer = () => {
  const socialLinks = [
    { icon: Mail, href: 'mailto:fsqgroup@microsoft.com', label: 'Email' },
  ];

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center space-y-8">
          {/* Brand Section */}
          <div className="text-center max-w-2xl">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-primary to-purple-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">F</span>
              </div>
              <span className="text-2xl font-bold text-white">FSQ</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Full-Self Quality: AI-powered test automation delivering org-level impact
              across all platforms. Record once, replay everywhere.
            </p>
          </div>

          {/* Social Icons */}
          <div className="flex space-x-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-800 hover:bg-purple-primary rounded-lg flex items-center justify-center transition-colors duration-200"
                aria-label={social.label}
              >
                <social.icon size={20} />
              </a>
            ))}
          </div>

          {/* Copyright */}
          <div className="pt-6 border-t border-slate-800 w-full text-center">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Microsoft. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
