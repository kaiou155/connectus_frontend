import { useEffect, useState } from 'react';
import { Plus, Power } from 'lucide-react';
import { celulaService, usuarioService } from '../services/api';
import { buscarCep } from '../services/cepService';
import { config } from '../services/config';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui';
import { CelulaCard, CelulaDetalhesModal } from '../components/domain';
import { DIAS_SEMANA, PERFIS, PERFIS_GRUPO } from '../utils/constants';
import { formatarCep } from '../utils/format';
import { temErros, validarCelula } from '../utils/validators';

const vazio = {
  nomeCelula: '', idLider: '', diaSemana: '', horario: '20:00', perfilGrupo: '', faixaEtariaMin: '18', faixaEtariaMax: '30',
  capacidadeMaxima: '15', cep: '', bairro: '', cidade: '', endereco: '', descricao: '',
};

/** Criar / editar célula. */
function CelulaFormModal({ celula, aberto, onClose, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const lideres = useAsync(() => (aberto ? usuarioService.listar({ perfil: 'LIDER', ativo: 'true' }) : Promise.resolve([])), [aberto]);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    if (celula) {
      const [min, max] = celula.faixaEtaria.split('-');
      setF({
        ...vazio,
        ...Object.fromEntries(Object.keys(vazio).map((k) => [k, celula[k] ?? vazio[k]])),
        idLider: String(celula.idLider ?? ''),
        capacidadeMaxima: String(celula.capacidadeMaxima),
        faixaEtariaMin: min,
        faixaEtariaMax: max,
      });
    } else setF(vazio);
  }, [aberto, celula]);

  const set = (k, mascara) => (e) => setF((v) => ({ ...v, [k]: mascara ? mascara(e.target.value) : e.target.value }));

  const preencherCep = async () => {
    const r = await buscarCep(f.cep);
    if (r && !r.naoEncontrado)
      setF((v) => ({ ...v, bairro: r.bairro || v.bairro, cidade: r.cidade || v.cidade, endereco: v.endereco || r.logradouro }));
  };

  const salvar = async () => {
    const er = validarCelula(f);
    setErros(er);
    if (temErros(er)) return;
    const dados = {
      ...f,
      idLider: Number(f.idLider),
      capacidadeMaxima: Number(f.capacidadeMaxima),
      faixaEtaria: `${f.faixaEtariaMin}-${f.faixaEtariaMax}`,
    };
    delete dados.faixaEtariaMin;
    delete dados.faixaEtariaMax;
    setEnviando(true);
    try {
      if (celula) await celulaService.atualizar(celula.idCelula, dados);
      else await celulaService.criar(dados);
      toast.sucesso(celula ? 'Célula atualizada.' : 'Célula criada e disponível para o matching.');
      onSalvo();
      onClose();
    } catch (e) {
      setErros(e.campos ?? {});
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  const opcoesLider = (lideres.dados ?? []).map((l) => ({
    value: String(l.idUsuario),
    label: l.idCelula && l.idCelula !== celula?.idCelula ? `${l.nome} — já lidera ${l.nomeCelula}` : l.nome,
    disabled: Boolean(l.idCelula && l.idCelula !== celula?.idCelula),
  }));

  return (
    <Modal
      open={aberto}
      onClose={onClose}
      title={celula ? 'Editar célula' : 'Nova célula'}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <div className="form-grid" style={{ marginTop: 16 }}>
        <TextField className="span-2" label="Nome da célula" value={f.nomeCelula} onChange={set('nomeCelula')} error={erros.nomeCelula} placeholder="Vila Mariana - Jovens" />
        <SelectField className="span-2" label="Líder responsável" value={f.idLider} onChange={set('idLider')} options={opcoesLider} placeholder={lideres.carregando ? 'Carregando…' : 'Selecione'} error={erros.idLider} hint="Cadastre líderes em Usuários" />
        <SelectField label="Dia da reunião" value={f.diaSemana} onChange={set('diaSemana')} options={DIAS_SEMANA} placeholder="Selecione" error={erros.diaSemana} />
        <TextField label="Horário" type="time" value={f.horario} onChange={set('horario')} error={erros.horario} />
        <SelectField label="Perfil do grupo" value={f.perfilGrupo} onChange={set('perfilGrupo')} options={PERFIS_GRUPO} placeholder="Selecione" error={erros.perfilGrupo} />
        <TextField label="Capacidade máxima" type="number" min={2} max={200} value={f.capacidadeMaxima} onChange={set('capacidadeMaxima')} error={erros.capacidadeMaxima} />
        <TextField label="Idade mínima" type="number" min={0} max={120} value={f.faixaEtariaMin} onChange={set('faixaEtariaMin')} error={erros.faixaEtaria} />
        <TextField label="Idade máxima" type="number" min={0} max={120} value={f.faixaEtariaMax} onChange={set('faixaEtariaMax')} />
        <TextField label="CEP" value={f.cep} onChange={set('cep', formatarCep)} onBlur={preencherCep} error={erros.cep} placeholder="00000-000" />
        <TextField label="Bairro" value={f.bairro} onChange={set('bairro')} error={erros.bairro} />
        <TextField label="Cidade" value={f.cidade} onChange={set('cidade')} placeholder="São Paulo" />
        <TextField label="Endereço" value={f.endereco} onChange={set('endereco')} placeholder="Rua, número" />
        <TextAreaField className="span-2" label="Descrição" value={f.descricao} onChange={set('descricao')} placeholder="Como são os encontros?" />
      </div>
    </Modal>
  );
}

// Consultar e gerenciar células
export default function Celulas() {
  const { temPerfil } = useAuth();
  const toast = useToast();
  const admin = temPerfil(PERFIS.ADMINISTRADOR);
  const [filtros, setFiltros] = useState({ q: '', perfil: '', dia: '', comVagas: '', incluirInativas: '' });
  const q = useDebounce(filtros.q);
  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }));

  const { dados, erro, carregando, recarregar } = useAsync(
    () => celulaService.listar({ ...filtros, q }),
    [q, filtros.perfil, filtros.dia, filtros.comVagas, filtros.incluirInativas],
    { pollingMs: config.pollingMs },
  );

  const [detalhes, setDetalhes] = useState(null);
  const [form, setForm] = useState({ aberto: false, celula: null });
  const [status, setStatus] = useState(null); // { celula, mensagem }

  const alterarStatus = async (celula, confirmar = false) => {
    try {
      const r = await celulaService.alterarStatus(celula.idCelula, !celula.ativa, confirmar);
      toast.sucesso(
        r.ativa ? 'Célula reativada.' : `Célula desativada.${r.membrosRedistribuir ? ` ${r.membrosRedistribuir} membro(s) voltaram para a triagem.` : ''}`,
      );
      setStatus(null);
      recarregar({ silencioso: true });
    } catch (e) {
      if (e.codigo === 'CONFIRMACAO_NECESSARIA') setStatus({ celula, mensagem: e.message });
      else toast.erro(e);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Rede"
        title="Células"
        subtitle="Visualize todas as células, horários, localização e ocupação em tempo real."
        actions={admin && (
          <button className="btn btn--primary" onClick={() => setForm({ aberto: true, celula: null })}>
            <Plus size={15} /> Nova célula
          </button>
        )}
      />

      <div className="filters">
        <TextField className="field--search" label="Buscar" type="search" value={filtros.q} onChange={set('q')} placeholder="Nome ou bairro" />
        <SelectField label="Perfil" value={filtros.perfil} onChange={set('perfil')} options={PERFIS_GRUPO} placeholder="Todos" />
        <SelectField label="Dia" value={filtros.dia} onChange={set('dia')} options={DIAS_SEMANA} placeholder="Qualquer dia" />
        <SelectField label="Vagas" value={filtros.comVagas} onChange={set('comVagas')} options={[{ value: 'true', label: 'Com vagas' }]} placeholder="Todas" />
        {admin && (
          <SelectField label="Status" value={filtros.incluirInativas} onChange={set('incluirInativas')} options={[{ value: 'true', label: 'Incluir inativas' }]} placeholder="Somente ativas" />
        )}
      </div>

      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados && dados.length === 0 && <EmptyState title="Nenhuma célula encontrada">Ajuste os filtros para ver mais resultados.</EmptyState>}

      <div className="grid grid--2">
        {dados?.map((c) => (
          <CelulaCard
            key={c.idCelula}
            celula={c}
            onDetalhes={(x) => setDetalhes(x.idCelula)}
            acao={
              admin && (
                <button className={`btn btn--sm ${c.ativa ? 'btn--danger' : ''}`} onClick={() => alterarStatus(c)}>
                  <Power size={14} /> {c.ativa ? 'Desativar' : 'Reativar'}
                </button>
              )
            }
          />
        ))}
      </div>

      <CelulaDetalhesModal
        idCelula={detalhes}
        onClose={() => setDetalhes(null)}
        onEditar={
          admin
            ? (c) => {
                setDetalhes(null);
                setForm({ aberto: true, celula: c });
              }
            : undefined
        }
      />
      <CelulaFormModal aberto={form.aberto} celula={form.celula} onClose={() => setForm({ aberto: false, celula: null })} onSalvo={() => recarregar({ silencioso: true })} />
      <ConfirmDialog
        open={Boolean(status)}
        title="Desativar célula?"
        message={status?.mensagem}
        confirmLabel="Desativar mesmo assim"
        danger
        onCancel={() => setStatus(null)}
        onConfirm={() => alterarStatus(status.celula, true)}
      />
    </>
  );
}
