import { useState, useEffect } from 'react';
import { X, ArrowRight, Upload, Eye, Crosshair, ChartScatter } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    title: 'Bem-vindo ao Meta Ads Analyzer! 🎯',
    description: 'Analise seus dados do Meta Ads com inteligência. Comece importando um relatório CSV.',
    icon: <Upload className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Visão Executiva 👁️',
    description: 'KPIs principais, semáforos de campanha e resumo automático de performance.',
    icon: <Eye className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Visão Tática 🎯',
    description: 'Heatmap, vereditos automáticos, insights de IA e ações recomendadas.',
    icon: <Crosshair className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Visão Diagnóstica 📊',
    description: 'Scatter plots, gráficos de radar e análise de decomposição de CPA.',
    icon: <ChartScatter className="h-8 w-8 text-primary" />,
  },
];

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('onboarding_done');
    if (!seen) setVisible(true);
  }, []);

  const finish = () => {
    setVisible(false);
    localStorage.setItem('onboarding_done', 'true');
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card p-8 max-w-md w-full mx-4 space-y-6 relative animate-fade-in">
        <button onClick={finish} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="flex justify-center">{current.icon}</div>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>
              Começar! 🚀
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
