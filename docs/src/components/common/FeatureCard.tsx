import { motion } from 'framer-motion';
import type { ComponentType } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

interface FeatureCardProps {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
  gradient?: string;
  delay?: number;
}

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient = 'from-purple-primary to-purple-secondary',
  delay = 0
}: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="group relative bg-white rounded-2xl p-8 shadow-lg border border-purple-50 hover:shadow-2xl transition-all duration-300"
    >
      {/* Icon container */}
      <div className={`inline-flex items-center justify-center w-16 h-16 mb-6 rounded-xl bg-gradient-to-br ${gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="text-white" size={32} />
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-purple-primary transition-colors">
        {title}
      </h3>

      {/* Description */}
      <p className="text-slate-600 leading-relaxed">
        {description}
      </p>

      {/* Hover effect background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
    </motion.div>
  );
};
