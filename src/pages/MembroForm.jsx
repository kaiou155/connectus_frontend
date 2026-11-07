import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { membroService } from '../services/api';
import { buscarCep } from '../services/cepService';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorState, Field, Loading, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui';
import { DIAS_SEMANA, ESTADOS_CIVIS, GENEROS, PERFIS_GRUPO } from '../utils/constants';
import { formatarCep, formatarTelefone } from '../utils/format';
import { temErros, validarMembro } from '../utils/validators';

const vazio = {
  nomeCompleto: '', dataNascimento: '', genero: '', estadoCivil: '', telefone: '', email: '',
  cep: '', bairro: '', cidade: '', perfilInteresse: '', indicadoPor: '', observacoes: '',
  disponibilidades: [{ diaSemana: '', horarioInicio: '', horarioFim: '' }],
};

/**
 * Cadastro de membro e edição pelo administrador.
 * Após o cadastro o voluntário é levado direto para a triagem do membro.
 */
export default function MembroForm() {
  const { id } = useParams();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [cepStatus, setCepStatus] = useState('');

  const existente = useAsync(() => (edicao ? membroService.obter(id) : Promise.resolve(null)), [id]);
  const indicadores = useAsync(() => membroService.listar({ status: 'ALOCADO' }), []);

  useEffect(() => {
    const m = existente.dados;
    if (!m) return;
    setF({
      ...vazio,
      ...Object.fromEntries(Object.keys(vazio).map((k) => [k, m[k] ?? vazio[k]])),
      indicadoPor: m.indicadoPor ?? '',
      disponibilidades: m.disponibilidades?.length ? m.disponibilidades : vazio.disponibilidades,
    });
  }, [existente.dados]);

  const opcoesIndicador = useMemo(
    () => (indicadores.dados ?? []).filter((m) => String(m.idMembro) !== String(id)),
    [indicadores.dados, id],
  );

  const set = (campo, mascara) => (e) => {
    const valor = mascara ? mascara(e.target.value) : e.target.value;
    setF((v) => ({ ...v, [campo]: valor }));
    if (erros[campo]) setErros((er) => ({ ...er, [campo]: undefined }));
  };

  const setDisp = (i, campo) => (e) =>
    setF((v) => ({
      ...v,
      disponibilidades: v.disponibilidades.map((d, j) => (j === i ? { ...d, [campo]: e.target.value } : d)),
    }));

  const consultarCep = async () => {
    if (f.cep.replace(/\D/g, '').length !== 8) return;
    setCepStatus('Buscando endereço…');
    const r = await buscarCep(f.cep);
    if (!r) setCepStatus('Não foi possível consultar o CEP agora. Preencha bairro e cidade.');
    else if (r.naoEncontrado) setCepStatus('CEP não encontrado.');
    else {
      setF((v) => ({ ...v, bairro: r.bairro || v.bairro, cidade: r.cidade || v.cidade }));
      setCepStatus(r.logradouro ? `${r.logradouro} — ${r.cidade}/${r.estado}` : '');
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    const dados = { ...f, disponibilidades: f.disponibilidades.filter((d) => d.diaSemana) };
    const er = validarMembro(f.disponibilidades.length === 1 && !f.disponibilidades[0].diaSemana ? dados : f);
    setErros(er);
    if (temErros(er)) {
      toast.erro('Revise os campos destacados.');
      return;
    }
    setEnviando(true);
    try {
      if (edicao) {
        await membroService.atualizar(id, dados);
        toast.sucesso('Dados do membro atualizados.');
        navigate(`/membros/${id}`);
      } else {
        const novo = await membroService.criar(dados);
        toast.sucesso(`${novo.nomeCompleto} cadastrado(a). Vamos à triagem!`);
        navigate(`/triagem/${novo.idMembro}`, { replace: true });
      }
    } catch (err) {
      setErros(err.campos ?? {});
      toast.erro(err);
      setEnviando(false);
    }
  };

  if (edicao && existente.carregando) return <Loading />;
  if (edicao && existente.erro) return <ErrorState erro={existente.erro} onRetry={existente.recarregar} />;

  return (
    <>
      <PageHeader
        eyebrow={edicao ? 'Gerenciar membro' : 'Novo membro'}
        title={edicao ? 'Editar membro' : 'Cadastrar membro'}
        subtitle={edicao ? 'Alterações de endereço recalculam a geolocalização.' : 'Após o cadastro, o algoritmo de triagem indicará a célula ideal.'}
        back={edicao ? `/membros/${id}` : '/'}
      />

      <form className="card" style={{ maxWidth: 760, margin: '0 auto' }} onSubmit={enviar} noValidate>
        <div className="form-grid">
          <TextField className="span-2" label="Nome completo" value={f.nomeCompleto} onChange={set('nomeCompleto')} error={erros.nomeCompleto} placeholder="Maria da Silva" autoFocus={!edicao} />
          <TextField label="Data de nascimento" type="date" value={f.dataNascimento} onChange={set('dataNascimento')} error={erros.dataNascimento} max={new Date().toISOString().slice(0, 10)} />
          <SelectField label="Gênero" value={f.genero} onChange={set('genero')} options={GENEROS} placeholder="Selecione" error={erros.genero} />
          <SelectField label="Estado civil" value={f.estadoCivil} onChange={set('estadoCivil')} options={ESTADOS_CIVIS} placeholder="Selecione" error={erros.estadoCivil} />
          <TextField label="Telefone" type="tel" inputMode="tel" value={f.telefone} onChange={set('telefone', formatarTelefone)} error={erros.telefone} placeholder="(11) 99999-9999" />
          <TextField className="span-2" label="E-mail" type="email" value={f.email} onChange={set('email')} error={erros.email} hint="Opcional" placeholder="maria@email.com" />

          <TextField label="CEP" inputMode="numeric" value={f.cep} onChange={set('cep', formatarCep)} onBlur={consultarCep} error={erros.cep} hint={cepStatus || 'Preenche bairro e cidade automaticamente'} placeholder="00000-000" />
          <TextField label="Bairro" value={f.bairro} onChange={set('bairro')} error={erros.bairro} placeholder="Vila Mariana" />
          <TextField label="Cidade" value={f.cidade} onChange={set('cidade')} error={erros.cidade} placeholder="São Paulo" />
          <SelectField label="Perfil / interesse" value={f.perfilInteresse} onChange={set('perfilInteresse')} options={PERFIS_GRUPO} placeholder="Sem preferência" hint="Considerado no matching" />
        </div>

        <div className="eyebrow" style={{ marginTop: 22 }}>Disponibilidade para encontros</div>
        <div className="stack">
          {f.disponibilidades.map((d, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
              <SelectField label={i === 0 ? 'Dia' : undefined} value={d.diaSemana} onChange={setDisp(i, 'diaSemana')} options={DIAS_SEMANA} placeholder="Selecione" className="spacer" error={erros[`disp_${i}`]} />
              <TextField label={i === 0 ? 'Das' : undefined} type="time" value={d.horarioInicio} onChange={setDisp(i, 'horarioInicio')} />
              <TextField label={i === 0 ? 'Até' : undefined} type="time" value={d.horarioFim} onChange={setDisp(i, 'horarioFim')} />
              <button
                type="button"
                className="btn btn--ghost"
                aria-label="Remover disponibilidade"
                disabled={f.disponibilidades.length === 1}
                onClick={() => setF((v) => ({ ...v, disponibilidades: v.disponibilidades.filter((_, j) => j !== i) }))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setF((v) => ({ ...v, disponibilidades: [...v.disponibilidades, { diaSemana: '', horarioInicio: '', horarioFim: '' }] }))}
            >
              <Plus size={15} /> Adicionar dia
            </button>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 22 }}>
          <Field label="Indicado por" hint="Opcional — membro que convidou" className="span-2">
            {({ id: inputId }) => (
              <select id={inputId} className="select" value={f.indicadoPor} onChange={set('indicadoPor')}>
                <option value="">Ninguém / não informado</option>
                {opcoesIndicador.map((m) => (
                  <option key={m.idMembro} value={m.idMembro}>
                    {m.nomeCompleto} {m.celula ? `— ${m.celula.nomeCelula}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <TextAreaField className="span-2" label="Observações" value={f.observacoes} onChange={set('observacoes')} placeholder="Informações úteis para o líder (opcional)" />
        </div>

        <div className="modal__footer">
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Cadastrar e triar'}
          </button>
        </div>
      </form>
    </>
  );
}
