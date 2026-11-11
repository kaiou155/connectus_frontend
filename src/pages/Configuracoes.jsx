import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronRight, CreditCard, DatabaseZap, TimerOff } from 'lucide-react';
import { igrejaService } from '../services/api';
import { config } from '../services/config';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ConfirmDialog, ErrorState, Loading, PageHeader, SelectField, TextField } from '../components/ui';
import { PLANOS, STATUS_ASSINATURA, UFS } from '../utils/constants';
import { temErros, validarIgreja } from '../utils/validators';

// Dados da igreja · atalho para a assinatura
export default function Configuracoes() {
  const toast = useToast();
  const location = useLocation();
  const { atualizarSessao } = useAuth();
  const { dados, erro, carregando, recarregar, setDados } = useAsync(() => igrejaService.atual(), []);
  const [f, setF] = useState(null);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resetar, setResetar] = useState(false);

  useEffect(() => {
    if (dados) setF({ nomeIgreja: dados.nomeIgreja, denominacao: dados.denominacao ?? '', cidade: dados.cidade, estado: dados.estado });
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

  // Só no modo demonstração: encerra a assinatura para mostrar o modo somente leitura na apresentação
  const simularExpiracao = async () => {
    const { getDb, salvarDb } = await import('../services/mock/db');
    const { assinaturaDe } = await import('../services/mock/assinatura');
    const a = assinaturaDe(getDb(), dados.idIgreja);
    Object.assign(a, {
      status: 'TESTE',
      assinanteMp: false,
      fimTeste: new Date(Date.now() - 86400000).toISOString(),
      vencimento: null,
      checkoutPendente: null,
    });
    salvarDb();
    await atualizarSessao();
    recarregar({ silencioso: true });
    toast.sucesso('Teste encerrado: o sistema agora está em modo somente leitura.');
  };

  if (carregando || !f) return erro ? <ErrorState erro={erro} onRetry={recarregar} /> : <Loading />;

  const situacao = STATUS_ASSINATURA[dados.assinatura?.status];

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" subtitle="Dados da igreja e assinatura." />
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
        </div>
        <div className="modal__footer">
          <button className="btn btn--primary" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <Link to="/assinatura" className="card card--link" style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="icon-tile"><CreditCard size={18} /></span>
          <div className="spacer">
            <div className="card__title">Assinatura e plano</div>
            <p className="card__text">
              Plano {PLANOS[dados.plano]?.label ?? dados.plano} · {dados.uso.membros} membros, {dados.uso.celulas} células e {dados.uso.usuarios} usuários em uso.
            </p>
          </div>
          {situacao && <Badge tone={situacao.tom}>{situacao.label}</Badge>}
          <ChevronRight size={18} />
        </div>
      </Link>

      {config.useMock && (
        <section className="card card--flat">
          <h2 className="card__title">Modo demonstração</h2>
          <p className="small muted">Os dados ficam salvos neste navegador. Restaure para voltar ao cenário inicial da apresentação.</p>
          <div className="row">
            <button className="btn btn--danger" onClick={() => setResetar(true)}><DatabaseZap size={15} /> Restaurar dados de demonstração</button>
            <button className="btn" onClick={simularExpiracao}><TimerOff size={15} /> Simular fim do teste grátis</button>
          </div>
        </section>
      )}

      <ConfirmDialog open={resetar} title="Restaurar dados?" message="Todas as alterações feitas na demonstração serão perdidas." confirmLabel="Restaurar" danger onCancel={() => setResetar(false)} onConfirm={restaurarDemo} />
    </>
  );
}
