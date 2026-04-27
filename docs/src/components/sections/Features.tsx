import { motion } from 'framer-motion';
import { Rocket, Puzzle, Bot, Target, Lock, Zap, Monitor, Smartphone, Apple, Laptop } from 'lucide-react';
import { FeatureCard } from '../common/FeatureCard';

export const Features = () => {
  const features = [
    {
      icon: Rocket,
      title: 'Scale coverage effortlessly',
      description: 'Get hundreds of reliable tests in days. FSQ converts real user actions and natural language into automated end-to-end coverage.',
      gradient: 'from-purple-primary to-purple-secondary',
    },
    {
      icon: Puzzle,
      title: 'Make testing accessible',
      description: 'Any engineer can record, review, and run tests in natural language—no deep framework expertise or long training required.',
      gradient: 'from-purple-secondary to-blue-accent',
    },
    {
      icon: Bot,
      title: 'Expand coverage while you sleep',
      description: 'Engineers focus on shipping features while FSQ handles QA. Tests evolve with UI changes, reducing manual maintenance.',
      gradient: 'from-blue-accent to-purple-primary',
    },
    {
      icon: Target,
      title: 'Focus only on real regressions',
      description: 'AI-powered assertions filter out false positives so teams spend time fixing real bugs, not chasing noise.',
      gradient: 'from-purple-primary to-purple-secondary',
    },
    {
      icon: Lock,
      title: 'Record once, trust every run',
      description: 'FSQ captures deterministic user actions with high-fidelity recording, ensuring test steps are precise, repeatable, and free from interpretation drift.',
      gradient: 'from-purple-secondary to-blue-accent',
    },
    {
      icon: Zap,
      title: 'Replay with confidence, not guesswork',
      description: 'Recorded scripts replay deterministically without LLM reasoning at runtime—dramatically reducing token usage and eliminating hallucination-driven flakiness.',
      gradient: 'from-blue-accent to-purple-primary',
    },
  ];

  return (
    <section id="highlights" className="py-24 bg-gradient-to-b from-white to-primary-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center px-4 py-2 mb-6 bg-purple-50 rounded-full"
          >
            <span className="text-purple-primary font-semibold text-sm">
              HIGHLIGHTS
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Test Automation,{' '}
            <span className="bg-gradient-to-r from-purple-primary to-purple-secondary bg-clip-text text-transparent">
              Reimagined
            </span>
          </h2>

          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            FSQ transforms how organizations approach regression testing with AI-powered
            automation that delivers sustained, org-level impact.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              gradient={feature.gradient}
              delay={index * 0.1}
            />
          ))}
        </div>

        {/* Platform & CI/CD Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-10">
            Supported Platforms & CI/CD
          </h3>
          {/* Platforms row */}
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-14 mb-8">
            {[
              { name: 'Windows', Icon: Monitor, color: 'text-blue-600' },
              { name: 'Android', Icon: Smartphone, color: 'text-green-600' },
              { name: 'iOS', Icon: Apple, color: 'text-slate-800' },
              { name: 'macOS', Icon: Laptop, color: 'text-slate-700' },
            ].map((platform, index) => {
              const { Icon } = platform;
              return (
                <motion.div
                  key={platform.name}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity duration-200"
                >
                  <Icon className={`${platform.color}`} size={28} />
                  <span className="font-semibold text-slate-700">{platform.name}</span>
                </motion.div>
              );
            })}
          </div>
          {/* CI/CD row */}
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-14">
            {[
              { name: 'Azure DevOps', logo: '/fsq-site/logos/azure-devops.svg' },
              { name: 'CircleCI', logo: '/fsq-site/logos/circleci.svg' },
              { name: 'Jenkins', logo: '/fsq-site/logos/jenkins.svg' },
              { name: 'Travis CI', logo: '/fsq-site/logos/travis-ci.svg' },
            ].map((ci, index) => (
              <motion.div
                key={ci.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: (index + 4) * 0.1 }}
                className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity duration-200"
              >
                <img src={ci.logo} alt={ci.name} className="h-7 w-auto" />
                <span className="font-semibold text-slate-700">{ci.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
