import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { relatorioService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { config } from '../services/config';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, Loading, OccupancyBar, PageHeader, Segmented, StatusMembroBadge, TextField } from '../components/ui';
import { STATUS_MEMBRO, perfilGrupoLabel } from '../utils/constants';
import { formatarData, formatarNumero, mesCurto, tempoRelativo } from '../utils/format';
import { baixarArquivo, gerarCsv } from '../utils/csv';

function BarChart({ dados, rotulo = (d) => d.mes, valor = (d) => d.total }) {
  const max = Math.max(1, ...dados.map(valor));
  return (
    <div className="bar-chart" role="img" aria-label={dados.map((d) => `${rotulo(d)}: ${valor(d)}`).join(', ')}>
      {dados.map((d) => (
        <div className="bar-chart__col" key={rotulo(d)}>
          <span className="bar-chart__value">{valor(d)}</span>
          <div className="bar-chart__bar" style={{ height: `${(valor(d) / max) * 75}%` }} />
          <span className="bar-chart__label">{rotulo(d)}</span>
        </div>
      ))}
    </div>
  );
}

function HBars({ linhas, rotulo, valor, sufixo = '' }) {
  const max = Math.max(1, ...linhas.map(valor));
  return (
    <div>
      {linhas.map((l) => (
        <div className="hbar" key={rotulo(l)}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotulo(l)}</span>
          <div className="hbar__track"><div className="hbar__fill" style={{ width: `${(valor(l) / max) * 100}%` }} /></div>
          <span className="hbar__value">{valor(l)}{sufixo}</span>
        </div>
      ))}
    </div>
  );
}

const Kpi = ({ label, valor, detalhe }) => (
  <div className="card kpi">
    <div className="kpi__label">{label}</div>
    <div className="kpi__value">{valor}</div>
    {detalhe && <div className="kpi__delta">{detalhe}</div>}
  </div>
);

function VisaoGeral() {
  const { dados, erro, carregando, recarregar } = useAsync(() => relatorioService.resumo(), []);
  if (carregando) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;
  const k = dados.kpis;
  return (
    <>
      <div className="grid grid--4">
        <Kpi label="Membros ativos" valor={formatarNumero(k.membrosAtivos)} detalhe={`+${k.novosSemana} esta semana`} />
        <Kpi label="Células" valor={k.celulasAtivas} detalhe={`${k.taxaOcupacao}% de ocupação`} />
        <Kpi label="Líderes" valor={k.lideres} detalhe={`${k.pendentes} aguardando triagem`} />
        <Kpi label="Conexão" valor={`${k.taxaConexao}%`} detalhe="cadastrados no mês já alocados" />
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card__title">Novos membros por mês</h2>
        <BarChart dados={dados.novosPorMes} rotulo={(d) => mesCurto(d.mes)} />
      </section>
      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2 className="card__title">Top células</h2>
          <div className="stack" style={{ marginTop: 12 }}>
            {dados.topCelulas.map((c) => (
              <div key={c.idCelula}>
                <div className="row row--between small"><span className="strong">{c.nomeCelula}</span><span className="muted">{c.capacidadeAtual} membros</span></div>
                <OccupancyBar atual={c.capacidadeAtual} maxima={c.capacidadeMaxima} compacto />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2 className="card__title">Atividade recente</h2>
          <ul className="small" style={{ paddingLeft: 18, margin: '12px 0 0' }}>
            {dados.atividadeRecente.map((a, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {a.texto} <span className="muted">· {tempoRelativo(a.data)}</span>
              </li>
            ))}
          </ul>
          {k.mediaIntegracao && <p className="small muted">Nota média de integração: <strong>{k.mediaIntegracao}/5</strong></p>}
        </section>
      </div>
    </>
  );
}

function NovosMembros({ periodo, onExportar }) {
  const { dados, erro, carregando, recarregar } = useAsync(() => relatorioService.novosMembros(periodo), [periodo.de, periodo.ate]);
  if (carregando) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;
  // nenhum registro no período
  if (!dados.linhas.length) return <EmptyState title="Nenhum registro no período selecionado" />;
  onExportar.current = () =>
    gerarCsv(dados.linhas, [
      { label: 'ID', value: (m) => m.idMembro },
      { label: 'Nome', value: (m) => m.nomeCompleto },
      { label: 'Data de cadastro', value: (m) => formatarData(m.dataCadastro) },
      { label: 'Idade', value: (m) => m.idade },
      { label: 'Bairro', value: (m) => m.bairro },
      { label: 'Cidade', value: (m) => m.cidade },
      { label: 'Célula', value: (m) => m.celula?.nomeCelula ?? '' },
      { label: 'Status', value: (m) => STATUS_MEMBRO[m.statusMembro]?.label },
    ]);
  return (
    <>
      <div className="grid grid--3">
        <Kpi label="Novos membros" valor={dados.total} />
        <Kpi label="Já alocados" valor={dados.alocados} detalhe={`${Math.round((dados.alocados / dados.total) * 100)}% do período`} />
        <Kpi label="Meses no período" valor={dados.porMes.length} />
      </div>
      <section className="card" style={{ margin: '16px 0' }}>
        <h2 className="card__title">Cadastros por mês</h2>
        <BarChart dados={dados.porMes} rotulo={(d) => mesCurto(d.mes)} />
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>Cadastro</th><th>Bairro</th><th>Célula</th><th>Status</th></tr></thead>
          <tbody>
            {dados.linhas.map((m) => (
              <tr key={m.idMembro}>
                <td>{m.nomeCompleto}</td>
                <td>{formatarData(m.dataCadastro)}</td>
                <td>{m.bairro}</td>
                <td>{m.celula?.nomeCelula ?? '—'}</td>
                <td><StatusMembroBadge status={m.statusMembro} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Ocupacao({ onExportar }) {
  const { dados, erro, carregando, recarregar } = useAsync(() => relatorioService.ocupacao(), []);
  if (carregando) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;
  if (!dados.linhas.length) return <EmptyState title="Nenhuma célula ativa" />;
  onExportar.current = () =>
    gerarCsv(dados.linhas, [
      { label: 'Célula', value: (c) => c.nomeCelula },
      { label: 'Líder', value: (c) => c.lider?.nome },
      { label: 'Perfil', value: (c) => perfilGrupoLabel(c.perfilGrupo) },
      { label: 'Bairro', value: (c) => c.bairro },
      { label: 'Membros', value: (c) => c.capacidadeAtual },
      { label: 'Capacidade', value: (c) => c.capacidadeMaxima },
      { label: 'Vagas', value: (c) => c.vagas },
      { label: 'Ocupação (%)', value: (c) => c.ocupacaoPct },
    ]);
  const t = dados.totais;
  return (
    <>
      <div className="grid grid--4">
        <Kpi label="Ocupação geral" valor={`${t.pct}%`} />
        <Kpi label="Membros alocados" valor={t.ocupacao} />
        <Kpi label="Capacidade total" valor={t.capacidade} />
        <Kpi label="Vagas livres" valor={t.vagas} />
      </div>
      <section className="card" style={{ margin: '16px 0' }}>
        <h2 className="card__title">Taxa de ocupação por célula</h2>
        <div style={{ marginTop: 10 }}>
          <HBars linhas={dados.linhas} rotulo={(c) => c.nomeCelula} valor={(c) => c.ocupacaoPct} sufixo="%" />
        </div>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Célula</th><th>Líder</th><th className="num">Membros</th><th className="num">Capacidade</th><th className="num">Vagas</th><th className="num">Ocupação</th></tr></thead>
          <tbody>
            {dados.linhas.map((c) => (
              <tr key={c.idCelula}>
                <td>{c.nomeCelula}</td>
                <td>{c.lider?.nome}</td>
                <td className="num">{c.capacidadeAtual}</td>
                <td className="num">{c.capacidadeMaxima}</td>
                <td className="num">{c.vagas}</td>
                <td className="num">{c.ocupacaoPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Distribuicao({ periodo, onExportar }) {
  const { dados, erro, carregando, recarregar } = useAsync(() => relatorioService.distribuicaoGeografica(periodo), [periodo.de, periodo.ate]);
  if (carregando) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;
  if (!dados.linhas.length) return <EmptyState title="Nenhum registro no período selecionado" />;
  onExportar.current = () =>
    gerarCsv(dados.linhas, [
      { label: 'Bairro', value: (l) => l.bairro },
      { label: 'Cidade', value: (l) => l.cidade },
      { label: 'Membros', value: (l) => l.total },
      { label: 'Alocados', value: (l) => l.alocados },
      { label: 'Célula mais próxima (km)', value: (l) => String(l.celulaMaisProximaKm ?? '').replace('.', ',') },
    ]);
  const descobertos = dados.linhas.filter((l) => l.celulaMaisProximaKm > 5);
  return (
    <>
      {descobertos.length > 0 && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <span>
            <strong>{descobertos.length} bairro(s)</strong> têm membros a mais de 5 km da célula mais próxima ({descobertos.map((d) => d.bairro).join(', ')}) —
            candidatos à abertura de novas células.
          </span>
        </div>
      )}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card__title">Membros por bairro</h2>
        <div style={{ marginTop: 10 }}>
          <HBars linhas={dados.linhas.slice(0, 15)} rotulo={(l) => l.bairro} valor={(l) => l.total} />
        </div>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Bairro</th><th>Cidade</th><th className="num">Membros</th><th className="num">Alocados</th><th className="num">Célula mais próxima</th></tr></thead>
          <tbody>
            {dados.linhas.map((l) => (
              <tr key={`${l.bairro}-${l.cidade}`}>
                <td>{l.bairro}</td>
                <td>{l.cidade}</td>
                <td className="num">{l.total}</td>
                <td className="num">{l.alocados}</td>
                <td className="num">{l.celulaMaisProximaKm?.toLocaleString('pt-BR') ?? '—'} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const ABAS = [
  { value: 'GERAL', label: 'Visão geral' },
  { value: 'NOVOS', label: 'Novos membros' },
  { value: 'OCUPACAO', label: 'Ocupação' },
  { value: 'GEO', label: 'Distribuição geográfica' },
];

const seisMesesAtras = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
};

// Gerar relatório
export default function Relatorios() {
  const toast = useToast();
  const [aba, setAba] = useState('GERAL');
  const [periodo, setPeriodo] = useState({ de: seisMesesAtras(), ate: new Date().toISOString().slice(0, 10) });
  const [exportar] = useState(() => ({ current: null }));

  const exportarCsv = () => {
    if (config.preview) {
      toast.erro('Na prévia online o download está bloqueado. Rode o projeto localmente para exportar.');
      return;
    }
    const csv = exportar.current?.();
    if (!csv) {
      toast.erro('Não há dados para exportar nesta aba.');
      return;
    }
    baixarArquivo(csv, `conectus-${aba.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const trocarAba = (v) => {
    exportar.current = null;
    setAba(v);
  };

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboards"
        subtitle="Acompanhe o crescimento e a saúde da rede de células."
        actions={
          <>
            {aba !== 'GERAL' && (
              <button className="btn btn--primary" onClick={exportarCsv}><Download size={15} /> Exportar CSV</button>
            )}
            {!config.preview && <button className="btn" onClick={() => window.print()}><FileText size={15} /> PDF</button>}
          </>
        }
      />
      <div className="row no-print" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <Segmented label="Tipo de relatório" value={aba} onChange={trocarAba} options={ABAS} />
        {['NOVOS', 'GEO'].includes(aba) && (
          <div className="row">
            <TextField label="De" type="date" value={periodo.de} onChange={(e) => setPeriodo((p) => ({ ...p, de: e.target.value }))} />
            <TextField label="Até" type="date" value={periodo.ate} onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))} />
          </div>
        )}
      </div>
      {aba === 'GERAL' && <VisaoGeral />}
      {aba === 'NOVOS' && <NovosMembros periodo={periodo} onExportar={exportar} />}
      {aba === 'OCUPACAO' && <Ocupacao onExportar={exportar} />}
      {aba === 'GEO' && <Distribuicao periodo={periodo} onExportar={exportar} />}
    </>
  );
}
