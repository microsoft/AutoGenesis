import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Video, Eye, Play, ChevronDown, CircleSlash, Send, PlayCircle } from 'lucide-react';

export const AnimatedMockup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  const steps = [
    {
      icon: Video,
      title: 'Record',
      description: 'Natural-language test cases with one-click recording',
      color: 'from-purple-primary to-purple-secondary',
      toolbar: [
        { icon: CircleSlash, text: 'Not Fully Automated', type: 'text' },
        { icon: Send, text: 'Send to Copilot', type: 'button', bgColor: 'bg-purple-600', glowColor: 'rgba(168, 85, 247, 0.4)' },
        { icon: PlayCircle, text: 'Run', type: 'text' },
      ],
      lines: [
        { text: 'Scenario: Test msn.com website on Edge', type: 'title' },
        { text: 'Given I have launched Edge browser', type: 'step' },
        { text: 'When I click the search box in NTP page', type: 'step' },
        { text: 'And I input "msn.com" in the search box', type: 'step' },
        { text: 'And I press enter to navigate to the page', type: 'step' },
        { text: 'And I wait for the page to load completely', type: 'step' },
        { text: 'Then I should see the tab with the title "msn.com"', type: 'step' },
      ],
    },
    {
      icon: Eye,
      title: 'Review',
      description: 'Automatically generate and review executable code',
      color: 'from-purple-secondary to-blue-accent',
      toolbar: [
        { icon: Eye, text: 'preview_code_changes', type: 'button', bgColor: 'bg-green-600', glowColor: 'rgba(34, 197, 94, 0.4)' },
        { text: 'appium-mcp-server (MCP Server)', type: 'text' },
      ],
      lines: [
        { text: '# --- auto-generated step ---', type: 'comment' },
        { text: "@given('I have launched Edge browser')", type: 'decorator' },
        { text: 'def step_impl(context):', type: 'code' },
        { text: '    result = call_tool_sync(context,', type: 'code' },
        { text: '        name="app_launch",', type: 'string' },
        { text: '        arguments={...})', type: 'code' },
        { text: '    assert result.get("status") == "success"', type: 'string' },
      ],
    },
    {
      icon: Play,
      title: 'Replay',
      description: 'Deterministic execution with stability and correctness',
      color: 'from-blue-accent to-purple-primary',
      toolbar: [
        { icon: CircleSlash, text: 'Automated', type: 'text' },
        { icon: Send, text: 'Send to Copilot', type: 'text' },
        { icon: PlayCircle, text: 'Run', type: 'button', bgColor: 'bg-green-600', glowColor: 'rgba(34, 197, 94, 0.4)' },
      ],
      lines: [
        { text: 'Scenario: Test msn.com website on Edge', type: 'title' },
        { text: 'Given I have launched Edge browser', type: 'passed' },
        { text: 'When I click the search box in NTP page', type: 'passed' },
        { text: 'And I input "msn.com" in the search box', type: 'passed' },
        { text: 'And I press enter to navigate to the page', type: 'passed' },
        { text: 'And I wait for the page to load completely', type: 'passed' },
        { text: 'Then I should see the tab with the title "msn.com"', type: 'passed' },
      ],
    },
  ];

  const commandText = 'fsq run';

  useEffect(() => {
    // Typing animation - only run once
    if (!typingDone) {
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex <= commandText.length) {
          setTypedText(commandText.slice(0, charIndex));
          charIndex++;
        } else {
          setTypingDone(true);
          clearInterval(typeInterval);
        }
      }, 150);

      return () => clearInterval(typeInterval);
    }
  }, [typingDone]);

  useEffect(() => {
    // Line progression within current step
    const currentStepData = steps[currentStep];
    const subLineCount = currentStepData.lines.length;
    const lineInterval = setInterval(() => {
      setCurrentLine((prev) => {
        // Stop at the last line, don't cycle back
        if (prev >= subLineCount - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    // Step progression - duration proportional to sub-line count
    const baseDuration = 800; // base time per step
    const perLineDuration = 600; // time per sub-line
    const pauseAfterComplete = 1500; // extra pause after all lines shown
    const stepDuration = baseDuration + subLineCount * perLineDuration + pauseAfterComplete;

    const stepTimeout = setTimeout(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
      setCurrentLine(0);
    }, stepDuration);

    return () => {
      clearInterval(lineInterval);
      clearTimeout(stepTimeout);
    };
  }, [steps.length, currentStep]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-50 via-white to-purple-50/50 rounded-2xl p-8 overflow-hidden border border-slate-200/80 shadow-xl">
      {/* Subtle background accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-100/20 rounded-full blur-3xl" />

      {/* Header with command */}
      <div className="relative z-10 text-center mb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block bg-slate-800 rounded-lg px-4 py-2"
        >
          <span className="text-slate-400 font-mono text-lg">$ </span>
          <span className="text-white font-mono text-lg">{typedText}</span>
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-purple-400 font-mono text-lg"
          >
            |
          </motion.span>
        </motion.div>
      </div>

      {/* Main content area */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Code editor panel */}
        <div className="min-w-0">
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl h-full flex flex-col">
            {/* Toolbar - always render to maintain consistent height */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs text-slate-400 min-h-[40px]">
              {steps[currentStep].toolbar.map((item, idx) => {
                const ItemIcon = 'icon' in item ? item.icon : null;
                const isButton = item.type === 'button';
                const showSeparator = idx > 0;

                return (
                  <span key={idx} className="flex items-center gap-1">
                    {showSeparator && <span className="mx-1">|</span>}
                    {isButton ? (
                      <motion.div
                        animate={{
                          boxShadow: [
                            `0 0 0 0 ${'glowColor' in item && item.glowColor ? item.glowColor.replace('0.4', '0') : 'transparent'}`,
                            `0 0 0 4px ${'glowColor' in item && item.glowColor ? item.glowColor : 'transparent'}`,
                            `0 0 0 0 ${'glowColor' in item && item.glowColor ? item.glowColor.replace('0.4', '0') : 'transparent'}`,
                          ],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={`flex items-center gap-1 ${'bgColor' in item && item.bgColor ? item.bgColor : 'bg-slate-600'} text-white px-2 py-0.5 rounded`}
                      >
                        {ItemIcon && <ItemIcon size={12} />}
                        <span>{item.text}</span>
                      </motion.div>
                    ) : (
                      <>
                        {ItemIcon && <ItemIcon size={14} />}
                        <span>{item.text}</span>
                      </>
                    )}
                  </span>
                );
              })}
            </div>

            {/* Code content - single page per step */}
            <div className="p-4 font-mono text-sm leading-relaxed flex-1 min-h-[280px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Content lines */}
                  {steps[currentStep].lines.map((line: { text: string; type: string }, lineIndex: number) => {
                    const isCurrentLine = lineIndex === currentLine;
                    const isVisibleLine = lineIndex <= currentLine;

                    return (
                      <motion.div
                        key={lineIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                          opacity: isVisibleLine ? 1 : 0,
                          y: isVisibleLine ? 0 : 10,
                        }}
                        transition={{ duration: 0.3 }}
                        className="whitespace-pre"
                      >
                        {line.type === 'title' ? (
                          // Title line with red marker
                          <div className="flex items-start mb-1">
                            <span className="text-red-500 mr-2">|</span>
                            <span className="text-orange-400 font-semibold">{line.text}</span>
                          </div>
                        ) : line.type === 'step' ? (
                          // Step with X marker (not automated)
                          <div className="flex items-start">
                            <span className="text-yellow-500 font-bold mr-2">X</span>
                            <span className={isCurrentLine ? 'text-white font-semibold' : 'text-slate-300'}>
                              {line.text}
                            </span>
                          </div>
                        ) : line.type === 'passed' ? (
                          // Passed step with green checkmark
                          <div className="flex items-start">
                            <span className="text-green-500 font-bold mr-2">&#10003;</span>
                            <span className={isCurrentLine ? 'text-white font-semibold' : 'text-slate-300'}>
                              {line.text}
                            </span>
                          </div>
                        ) : line.type === 'comment' ? (
                          <span className="text-slate-500">{line.text}</span>
                        ) : line.type === 'decorator' ? (
                          <span className="text-yellow-400">{line.text}</span>
                        ) : line.type === 'string' ? (
                          <span className="text-green-400">{line.text}</span>
                        ) : (
                          <span className="text-slate-300">{line.text}</span>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Steps visualization */}
        <div className="min-w-0 flex flex-col justify-center gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isPast = index < currentStep;
            // Check if current step is done (on last sub-line)
            const currentStepData = steps[currentStep];
            const subLineCount = currentStepData.lines.length;
            const isCurrentStepDone = isActive && currentLine >= subLineCount - 1;

            return (
              <div key={index}>
                <motion.div
                  animate={{
                    scale: isActive ? 1.02 : 1,
                    x: isActive ? 8 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-white shadow-lg ring-1 ring-slate-200'
                      : isPast
                      ? 'bg-white/80 shadow-sm'
                      : 'bg-white/50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${step.color} ${
                      !isActive && !isPast ? 'opacity-50' : ''
                    }`}
                  >
                    <Icon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${isActive ? 'text-slate-800' : isPast ? 'text-slate-700' : 'text-slate-500'}`}>
                      {step.title}
                    </div>
                    <div className={`text-sm ${isActive ? 'text-slate-600' : isPast ? 'text-slate-500' : 'text-slate-400'}`}>
                      {step.description}
                    </div>
                  </div>
                  {(isPast || isCurrentStepDone) && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </motion.div>

                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ChevronDown
                      className={`transition-colors duration-300 ${
                        index < currentStep ? 'text-purple-primary' : 'text-slate-300'
                      }`}
                      size={20}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
