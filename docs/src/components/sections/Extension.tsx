import { motion } from 'framer-motion';
import { Download, Star, Users, Code } from 'lucide-react';
import { Button } from '../common/Button';

export const Extension = () => {
  return (
    <section id="extension" className="py-24 bg-gradient-to-b from-white to-primary-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center px-4 py-2 mb-6 bg-white/80 rounded-full shadow-sm border border-purple-50"
            >
              <Code className="text-purple-primary mr-2" size={20} />
              <span className="text-purple-primary font-semibold text-sm">
                VS CODE EXTENSION
              </span>
            </motion.div>

            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              BDD AI Toolkit for{' '}
              <span className="bg-gradient-to-r from-purple-primary to-purple-secondary bg-clip-text text-transparent">
                VS Code
              </span>
            </h2>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Supercharge your testing workflow with our official VS Code extension. Record automation
              test scripts with AI-powered assistance and generate BDD test cases directly in your
              editor.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-1">
                  <div className="w-2 h-2 bg-purple-primary rounded-full" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">AI-Powered Test Recording</h3>
                  <p className="text-slate-600">
                    Record and generate automation test scripts with intelligent AI assistance
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-1">
                  <div className="w-2 h-2 bg-purple-primary rounded-full" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">BDD Syntax Highlighting</h3>
                  <p className="text-slate-600">
                    Full Cucumber/Gherkin support with syntax coloring for better readability
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-1">
                  <div className="w-2 h-2 bg-purple-primary rounded-full" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Seamless Integration</h3>
                  <p className="text-slate-600">
                    Works perfectly with GitHub Copilot and MCP servers for enhanced productivity
                  </p>
                </div>
              </div>
            </div>

            <a
              href="https://marketplace.visualstudio.com/items?itemName=liujingping.bdd-ai-toolkit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                <Download size={20} />
                Download Extension
              </Button>
            </a>
          </motion.div>

          {/* Right side - Extension Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
              {/* Extension Header */}
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-primary to-purple-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-3xl">BDD</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">BDD AI Toolkit</h3>
                  <p className="text-slate-600">by Liu Jingping</p>
                </div>
              </div>

              {/* Extension Description */}
              <p className="text-slate-700 mb-6 leading-relaxed">
                AI-powered BDD test automation toolkit for VS Code. Record test scripts, generate
                scenarios, and enhance your testing workflow with intelligent assistance.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Star className="text-yellow-500" size={20} fill="currentColor" />
                  </div>
                  <div className="text-sm text-slate-600">Rating</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Users className="text-purple-primary" size={20} />
                  </div>
                  <div className="text-sm text-slate-600">Users</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Download className="text-blue-500" size={20} />
                  </div>
                  <div className="text-sm text-slate-600">Installs</div>
                </div>
              </div>

              {/* Features List */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-3">Key Features</h4>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-purple-primary rounded-full mr-2" />
                    AI test recording & generation
                  </li>
                  <li className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-purple-primary rounded-full mr-2" />
                    Cucumber/Gherkin syntax support
                  </li>
                  <li className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-purple-primary rounded-full mr-2" />
                    MCP server integration
                  </li>
                  <li className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-purple-primary rounded-full mr-2" />
                    Environment setup automation
                  </li>
                </ul>
              </div>
            </div>

            {/* VS Code Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -bottom-4 -right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-semibold"
            >
              VS Code Compatible
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
