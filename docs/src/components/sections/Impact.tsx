import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { TrendingUp, Clock, Target, Users } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

const AnimatedCounter = ({ value, suffix = '', prefix = '', duration = 2 }: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000 });
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = prefix + Math.floor(latest).toLocaleString() + suffix;
      }
    });
  }, [springValue, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
};

export const Impact = () => {
  const stats = [
    {
      icon: Target,
      value: 400,
      suffix: 'K+',
      label: 'Test Steps',
      sublabel: 'Automated Weekly',
      gradient: 'from-purple-primary to-purple-secondary',
    },
    {
      icon: Clock,
      value: 600,
      suffix: '+',
      label: 'Hours Saved',
      sublabel: 'Every Week',
      gradient: 'from-purple-secondary to-blue-accent',
    },
    {
      icon: Users,
      value: 12,
      suffix: '+',
      label: 'Testers Reduced',
      sublabel: 'Headcount Equivalent',
      gradient: 'from-blue-accent to-purple-primary',
    },
  ];

  return (
    <section id="impact" className="py-24 bg-gradient-to-b from-primary-bg to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            className="inline-flex items-center px-4 py-2 mb-6 bg-white/80 rounded-full shadow-sm border border-purple-50"
          >
            <TrendingUp className="text-purple-primary mr-2" size={20} />
            <span className="text-purple-primary font-semibold text-sm">
              ORG-LEVEL IMPACT
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Sustained Headcount{' '}
            <span className="bg-gradient-to-r from-purple-primary to-purple-secondary bg-clip-text text-transparent">
              Leverage
            </span>
          </h2>

          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-4">
            FSQ has adopted AI-powered coding and automation agents as org-level virtual engineers,
            driving a structural shift in how regression testing scales across platforms.
          </p>

          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Rather than improving individual efficiency, these agents deliver sustained headcount
            leverage and operate as a core component of the release quality gate.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.2, duration: 0.6 }}
              className="relative group"
            >
              <div className="bg-white rounded-2xl p-8 shadow-xl border border-purple-50 hover:shadow-2xl transition-all duration-300">
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-14 h-14 mb-6 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="text-white" size={28} />
                </div>

                {/* Counter */}
                <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-purple-primary to-purple-secondary bg-clip-text text-transparent">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    duration={2.5}
                  />
                </div>

                {/* Label */}
                <div className="text-xl font-semibold text-slate-900 mb-1">
                  {stat.label}
                </div>

                {/* Sublabel */}
                <div className="text-slate-600">
                  {stat.sublabel}
                </div>

                {/* Hover effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Impact Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-purple-primary to-purple-secondary rounded-3xl p-10 md:p-16 text-center shadow-2xl"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
            These gains are ongoing and repeatable
          </h3>
          <p className="text-xl text-purple-50 max-w-3xl mx-auto leading-relaxed">
            Across Windows, Android, iOS, and macOS, FSQ's coding agents continuously
            deliver org-level impact. Not one-time optimizations, but sustained structural
            improvements to your testing operations.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
