import { useEffect, useState } from 'react';
import { Pencil, Plus, Power } from 'lucide-react';
import { usuarioService } from '../services/api';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Badge, ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageHeader, SelectField, TextField } from '../components/ui';
import { PERFIL_LABEL } from '../utils/constants';
import { formatarData, formatarTelefone } from '../utils/format';
import { temErros, validarUsuario } from '../utils/validators';

const opcoesPerfil = Object.entries(PERFIL_LABEL).map(([value, label]) => ({ value, label }));

const gerarSenha = () => {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};

function UsuarioFormModal({ aberto, usuario, onClose, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(
      usuario
        ? { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, telefone: usuario.telefone ?? '' }
        : { nome: '', email: '', perfil: 'VOLUNTARIO', telefone: '', senhaTemporaria: gerarSenha() },
    );
  }, [aberto, usuario]);

  const set = (k, m) => (e) => setF((v) => ({ ...v, [k]: m ? m(e.target.value) : e.target.value }));

  const salvar = async () => {
    const er = validarUsuario(f, { edicao: Boolean(usuario) });
    setErros(er);
    if (temErros(er)) return;
    setEnviando(true);
    try {
      if (usuario) {
        await usuarioService.atualizar(usuario.idUsuario, f);
        toast.sucesso('Usuário atualizado.');
      } else {
        const r = await usuarioService.criar(f);
        toast.sucesso(r.mensagem ?? 'Usuário criado.');
      }
      onSalvo();
      onClose();
    } catch (e) {
      setErros(e.campos ?? {});
      toast.erro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={aberto}
      onClose={onClose}
      title={usuario ? 'Editar usuário' : 'Novo usuário'}
      size="sm"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <div className="stack" style={{ marginTop: 14 }}>
        <TextField label="Nome" value={f.nome ?? ''} onChange={set('nome')} error={erros.nome} />
        <TextField label="E-mail" type="email" value={f.email ?? ''} onChange={set('email')} error={erros.email} />
        <TextField label="Telefone" value={f.telefone ?? ''} onChange={set('telefone', formatarTelefone)} hint="Exibido para voluntários quando for líder" />
        <SelectField label="Perfil de acesso" value={f.perfil ?? ''} onChange={set('perfil')} options={opcoesPerfil} error={erros.perfil} />
        {!usuario && (
          <TextField label="Senha temporária" value={f.senhaTemporaria ?? ''} onChange={set('senhaTemporaria')} error={erros.senhaTemporaria} hint="Enviada por e-mail; o usuário deve trocá-la no primeiro acesso" />
        )}
      </div>
    </Modal>
  );
}

// Gerenciar usuários
export default function Usuarios() {
  const { usuario: eu } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ q: '', perfil: '', ativo: '' });
  const q = useDebounce(f.q);
  const { dados, erro, carregando, recarregar } = useAsync(() => usuarioService.listar({ ...f, q }), [q, f.perfil, f.ativo]);
  const [form, setForm] = useState({ aberto: false, usuario: null });
  const [confirmacao, setConfirmacao] = useState(null);

  const alternar = async (u, confirmar = false) => {
    try {
      await usuarioService.alterarStatus(u.idUsuario, !u.ativo, confirmar);
      toast.sucesso(u.ativo ? `Acesso de ${u.nome} desativado.` : `Acesso de ${u.nome} reativado.`);
      setConfirmacao(null);
      recarregar({ silencioso: true });
    } catch (e) {
      // líder de célula ativa exige confirmação
      if (e.codigo === 'CONFIRMACAO_NECESSARIA') setConfirmacao({ usuario: u, mensagem: e.message });
      else toast.erro(e);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        subtitle="Voluntários, líderes e administradores com acesso ao sistema."
        actions={<button className="btn btn--primary" onClick={() => setForm({ aberto: true, usuario: null })}><Plus size={15} /> Novo usuário</button>}
      />
      <div className="filters">
        <TextField className="field--search" label="Buscar" type="search" value={f.q} onChange={(e) => setF((v) => ({ ...v, q: e.target.value }))} placeholder="Nome ou e-mail" />
        <SelectField label="Perfil" value={f.perfil} onChange={(e) => setF((v) => ({ ...v, perfil: e.target.value }))} options={opcoesPerfil} placeholder="Todos" />
        <SelectField label="Status" value={f.ativo} onChange={(e) => setF((v) => ({ ...v, ativo: e.target.value }))} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} placeholder="Todos" />
      </div>

      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados && dados.length === 0 && <EmptyState title="Nenhum usuário encontrado" />}
      {dados?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Célula</th><th>Desde</th><th>Status</th><th className="sr-only">Ações</th></tr></thead>
            <tbody>
              {dados.map((u) => (
                <tr key={u.idUsuario} style={{ opacity: u.ativo ? 1 : 0.55 }}>
                  <td><div className="row" style={{ flexWrap: 'nowrap' }}><Avatar nome={u.nome} size="sm" /> <span className="strong">{u.nome}</span></div></td>
                  <td>{u.email}</td>
                  <td><Badge tone="neutral">{PERFIL_LABEL[u.perfil]}</Badge></td>
                  <td>{u.nomeCelula ?? '—'}</td>
                  <td>{formatarData(u.dataCriacao)}</td>
                  <td>{u.ativo ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}</td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn--sm btn--ghost" onClick={() => setForm({ aberto: true, usuario: u })} aria-label={`Editar ${u.nome}`}><Pencil size={14} /></button>
                      {u.idUsuario !== eu.idUsuario && (
                        <button className="btn btn--sm btn--ghost" onClick={() => alternar(u)} aria-label={u.ativo ? `Desativar ${u.nome}` : `Reativar ${u.nome}`} title={u.ativo ? 'Desativar' : 'Reativar'}>
                          <Power size={14} color={u.ativo ? 'var(--danger)' : 'var(--success)'} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UsuarioFormModal aberto={form.aberto} usuario={form.usuario} onClose={() => setForm({ aberto: false, usuario: null })} onSalvo={() => recarregar({ silencioso: true })} />
      <ConfirmDialog
        open={Boolean(confirmacao)}
        title="Desativar líder?"
        message={confirmacao?.mensagem}
        confirmLabel="Desativar"
        danger
        onCancel={() => setConfirmacao(null)}
        onConfirm={() => alternar(confirmacao.usuario, true)}
      />
    </>
  );
}
