import { Hero } from '../components/sections/Hero';
import { Features } from '../components/sections/Features';
import { HowItWorks } from '../components/sections/HowItWorks';
import { Impact } from '../components/sections/Impact';
import { Extension } from '../components/sections/Extension';

export const Home = () => {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Impact />
      <Extension />
    </main>
  );
};
