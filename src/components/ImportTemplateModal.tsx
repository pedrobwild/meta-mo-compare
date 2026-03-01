import { useState } from 'react';
import { Download, FileSpreadsheet, Info, Copy, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TEMPLATE_COLUMNS = [
  { name: 'Nome do anúncio', example: 'Ad Criativo A', required: true, description: 'Nome do anúncio no Meta Ads' },
  { name: 'Nome da campanha', example: 'Campanha Leads', required: true, description: 'Nome da campanha' },
  { name: 'Nome do conjunto de anúncios', example: 'Conjunto Público Frio', required: false, description: 'Nome do ad set' },
  { name: 'Status de veiculação', example: 'Ativa', required: false, description: 'Status do anúncio' },
  { name: 'Nível de veiculação', example: 'Anúncio', required: false, description: 'Nível do relatório' },
  { name: 'Tipo de resultado', example: 'Leads', required: false, description: 'Tipo de resultado configurado' },
  { name: 'Resultados', example: '12', required: true, description: 'Número inteiro de resultados' },
  { name: 'Alcance', example: '7000', required: true, description: 'Número inteiro de pessoas alcançadas' },
  { name: 'Frequência', example: '2.1', required: false, description: 'Número decimal (use ponto)' },
  { name: 'Custo por resultado', example: '20.83', required: false, description: 'Valor em reais (use ponto)' },
  { name: 'Valor usado (BRL)', example: '250.00', required: true, description: 'Investimento em reais (use ponto)' },
  { name: 'Impressões', example: '14700', required: true, description: 'Número inteiro de impressões' },
  { name: 'CPM (custo por 1.000 impressões)', example: '17.01', required: false, description: 'Valor em reais (use ponto)' },
  { name: 'Cliques no link', example: '170', required: true, description: 'Número inteiro de cliques no link' },
  { name: 'CPC (custo por clique no link)', example: '1.47', required: false, description: 'Valor em reais (use ponto)' },
  { name: 'CTR (taxa de cliques no link)', example: '1.16', required: false, description: 'Percentual (use ponto)' },
  { name: 'Cliques (todos)', example: '200', required: false, description: 'Número inteiro de todos os cliques' },
  { name: 'CTR (todos)', example: '1.36', required: false, description: 'Percentual (use ponto)' },
  { name: 'CPC (todos)', example: '1.25', required: false, description: 'Valor em reais (use ponto)' },
  { name: 'Visualizações da página de destino', example: '140', required: true, description: 'Número inteiro de LPVs' },
  { name: 'Custo por visualização da página de destino', example: '1.79', required: false, description: 'Valor em reais (use ponto)' },
  { name: 'Início dos relatórios', example: '06/01/2026', required: true, description: 'Data DD/MM/AAAA' },
  { name: 'Término dos relatórios', example: '12/01/2026', required: true, description: 'Data DD/MM/AAAA' },
];

function generateCSVTemplate(): string {
  const headers = TEMPLATE_COLUMNS.map(c => c.name).join(',');
  const row1 = TEMPLATE_COLUMNS.map(c => {
    const val = c.example;
    return /[,"]/.test(val) ? `"${val}"` : val;
  }).join(',');

  // Second example row
  const row2Values = [
    'Ad Vídeo B', 'Campanha Tráfego', 'Conjunto Remarketing', 'Ativa', 'Anúncio', 'Cliques no link',
    '0', '3000', '1.5', '0', '150.00', '4500', '33.33', '70', '2.14', '1.56',
    '90', '2.00', '1.67', '50', '3.00', '06/01/2026', '12/01/2026'
  ];
  const row2 = row2Values.map(v => /[,"]/.test(v) ? `"${v}"` : v).join(',');

  return `${headers}\n${row1}\n${row2}`;
}

function downloadCSV() {
  const csv = generateCSVTemplate();
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-meta-ads.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Template baixado!');
}

export default function ImportTemplateModal() {
  const [copied, setCopied] = useState(false);

  const copyHeaders = () => {
    const headers = TEMPLATE_COLUMNS.map(c => c.name).join('\t');
    navigator.clipboard.writeText(headers);
    setCopied(true);
    toast.success('Cabeçalhos copiados!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Ver template de importação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Template de Importação — Meta Ads
          </DialogTitle>
          <DialogDescription>
            Use exatamente este formato de colunas para importar dados. Baixe o CSV modelo ou copie os cabeçalhos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button onClick={downloadCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar CSV modelo
          </Button>
          <Button variant="outline" onClick={copyHeaders} className="gap-2">
            {copied ? <CheckCircle2 className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar cabeçalhos'}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 mb-4 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Formato de números:</strong> Use ponto como separador decimal (ex: 1.25, não 1,25). Números inteiros sem separador de milhar.</p>
            <p><strong className="text-foreground">Formato de datas:</strong> DD/MM/AAAA (ex: 06/01/2026).</p>
            <p><strong className="text-foreground">Período:</strong> "Início dos relatórios" e "Término dos relatórios" definem o intervalo. Mesma data = dia; datas diferentes = semana/período.</p>
            <p><strong className="text-foreground">Métricas calculadas</strong> (CPM, CPC, CTR, etc.) são opcionais — o sistema recalcula automaticamente a partir dos valores brutos.</p>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold text-foreground">Coluna</th>
                <th className="text-left px-3 py-2 font-semibold text-foreground">Exemplo</th>
                <th className="text-left px-3 py-2 font-semibold text-foreground hidden sm:table-cell">Obrigatório</th>
                <th className="text-left px-3 py-2 font-semibold text-foreground hidden md:table-cell">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_COLUMNS.map((col, i) => (
                <tr key={col.name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-1.5 font-mono text-foreground whitespace-nowrap">{col.name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground font-mono">{col.example}</td>
                  <td className="px-3 py-1.5 hidden sm:table-cell">
                    {col.required ? (
                      <span className="text-positive font-medium">Sim</span>
                    ) : (
                      <span className="text-muted-foreground">Não</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground hidden md:table-cell">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
