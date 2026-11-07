import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, DatabaseZap } from 'lucide-react';
import { igrejaService } from '../services/api';
import { config } from '../services/config';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog, ErrorState, Loading, OccupancyBar, PageHeader, SelectField, TextField } from '../components/ui';
import { PLANOS, UFS } from '../utils/constants';
import { formatarNumero } from '../utils/format';
import { temErros, validarIgreja } from '../utils/validators';

// Dados da igreja · planos de assinatura
export default function Configuracoes() {
  const toast = useToast();
  const location = useLocation();
  const { dados, erro, carregando, recarregar, setDados } = useAsync(() => igrejaService.atual(), []);
  const [f, setF] = useState(null);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resetar, setResetar] = useState(false);

  useEffect(() => {
    if (dados) setF({ nomeIgreja: dados.nomeIgreja, denominacao: dados.denominacao ?? '', cidade: dados.cidade, estado: dados.estado, plano: dados.plano });
  }, [dados]);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const salvar = async (e) => {
    e.preventDefault();
    const er = validarIgreja(f);
    setErros(er);
    if (temErros(er)) return;
    setEnviando(true);
    try {
      const r = await igrejaService.atualizar(f);
      setDados(r);
      toast.sucesso('Dados da igreja salvos.');
    } catch (err) {
      setErros(err.campos ?? {});
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  };

  const restaurarDemo = async () => {
    const { resetarDb } = await import('../services/mock/db');
    resetarDb();
    window.location.reload();
  };

  if (carregando || !f) return erro ? <ErrorState erro={erro} onRetry={recarregar} /> : <Loading />;

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" subtitle="Dados da igreja e plano de assinatura." />
      {location.state?.boasVindas && (
        <div className="alert alert--success" style={{ marginBottom: 16 }}>
          <Check size={18} /> Igreja cadastrada! Próximos passos: cadastre líderes em Usuários e depois crie as células.
        </div>
      )}

      <form className="card" onSubmit={salvar} noValidate style={{ marginBottom: 16 }}>
        <h2 className="card__title">Dados da igreja</h2>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <TextField className="span-2" label="Nome da igreja" value={f.nomeIgreja} onChange={set('nomeIgreja')} error={erros.nomeIgreja} />
          <TextField label="Denominação" value={f.denominacao} onChange={set('denominacao')} />
          <TextField label="Cidade" value={f.cidade} onChange={set('cidade')} error={erros.cidade} />
          <SelectField label="Estado" value={f.estado} onChange={set('estado')} options={UFS.map((u) => ({ value: u, label: u }))} error={erros.estado} />
          <SelectField label="Plano contratado" value={f.plano} onChange={set('plano')} options={Object.entries(PLANOS).map(([value, p]) => ({ value, label: `${p.label} — R$ ${p.preco}/mês` }))} error={erros.plano} />
        </div>
        <div className="modal__footer">
          <button className="btn btn--primary" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card__title">Uso do plano {PLANOS[dados.plano].label}</h2>
        <div className="grid grid--3" style={{ marginTop: 14 }}>
          {[
            ['Membros cadastrados', 'membros'],
            ['Células ativas', 'celulas'],
            ['Usuários do sistema', 'usuarios'],
          ].map(([rotulo, chave]) => {
            const limite = dados.limites[chave];
            const ilimitado = limite === null || !Number.isFinite(limite);
            return (
              <div key={chave} className="info-tile">
                <div className="info-tile__label">{rotulo}</div>
                <div className="info-tile__value" style={{ fontSize: 20 }}>
                  {dados.uso[chave]} <span className="small muted">/ {ilimitado ? 'ilimitado' : formatarNumero(limite)}</span>
                </div>
                {!ilimitado && <OccupancyBar atual={dados.uso[chave]} maxima={limite} compacto />}
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Histórico de triagens: {Number.isFinite(PLANOS[dados.plano].historicoMeses) ? `${PLANOS[dados.plano].historicoMeses} meses` : 'completo'}.
        </p>
      </section>

      {config.useMock && (
        <section className="card card--flat">
          <h2 className="card__title">Modo demonstração</h2>
          <p className="small muted">Os dados ficam salvos neste navegador. Restaure para voltar ao cenário inicial da apresentação.</p>
          <button className="btn btn--danger" onClick={() => setResetar(true)}><DatabaseZap size={15} /> Restaurar dados de demonstração</button>
        </section>
      )}

      <ConfirmDialog open={resetar} title="Restaurar dados?" message="Todas as alterações feitas na demonstração serão perdidas." confirmLabel="Restaurar" danger onCancel={() => setResetar(false)} onConfirm={restaurarDemo} />
    </>
  );
}
