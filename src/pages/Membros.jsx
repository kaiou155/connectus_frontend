import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Pencil, UserPlus } from 'lucide-react';
import { celulaService, membroService } from '../services/api';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { Avatar, EmptyState, ErrorState, Loading, PageHeader, SelectField, StatusMembroBadge, TextField } from '../components/ui';
import { LinkMembro, SaidaMembroModal } from '../components/domain';
import { PERFIS, STATUS_MEMBRO } from '../utils/constants';
import { formatarData } from '../utils/format';

// Consultar e gerenciar membros · filtros cruzados
export default function Membros() {
  const { usuario, temPerfil } = useAuth();
  const admin = temPerfil(PERFIS.ADMINISTRADOR);
  const lider = temPerfil(PERFIS.LIDER);
  const [f, setF] = useState({ q: '', status: '', idCelula: '', bairro: '', de: '', ate: '' });
  const q = useDebounce(f.q);
  const bairro = useDebounce(f.bairro);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const membros = useAsync(() => membroService.listar({ ...f, q, bairro }), [q, bairro, f.status, f.idCelula, f.de, f.ate]);
  const celulas = useAsync(() => (lider ? Promise.resolve([]) : celulaService.listar()), []);
  const [saida, setSaida] = useState(null);

  const lista = membros.dados ?? [];

  return (
    <>
      <PageHeader
        eyebrow={lider ? 'Minha célula' : 'Pessoas'}
        title={lider ? `Membros · ${usuario.nomeCelula ?? 'sem célula'}` : 'Membros'}
        subtitle={lider ? 'Perfil e contatos dos integrantes da sua célula.' : 'Busque e consulte membros com filtros combinados.'}
        actions={
          temPerfil(PERFIS.ADMINISTRADOR, PERFIS.VOLUNTARIO) && (
            <Link to="/membros/novo" className="btn btn--primary"><UserPlus size={15} /> Novo membro</Link>
          )
        }
      />

      <div className="filters">
        <TextField className="field--search" label="Nome" type="search" value={f.q} onChange={set('q')} placeholder="Buscar por nome" />
        {!lider && (
          <>
            <SelectField label="Status" value={f.status} onChange={set('status')} placeholder="Todos" options={Object.entries(STATUS_MEMBRO).map(([value, s]) => ({ value, label: s.label }))} />
            <SelectField label="Célula" value={f.idCelula} onChange={set('idCelula')} placeholder="Todas" options={(celulas.dados ?? []).map((c) => ({ value: c.idCelula, label: c.nomeCelula }))} />
            <TextField label="Bairro" value={f.bairro} onChange={set('bairro')} placeholder="Todos" />
          </>
        )}
        <TextField label={lider ? 'Entrada a partir de' : 'Cadastro de'} type="date" value={f.de} onChange={set('de')} />
        <TextField label="Até" type="date" value={f.ate} onChange={set('ate')} />
      </div>

      {membros.carregando && !membros.dados && <Loading />}
      {membros.erro && <ErrorState erro={membros.erro} onRetry={membros.recarregar} />}
      {membros.dados && lista.length === 0 && (
        // nenhum membro encontrado
        <EmptyState title="Nenhum membro encontrado">Ajuste os filtros aplicados.</EmptyState>
      )}

      {lista.length > 0 && (
        <>
          <p className="small muted">{lista.length} membro(s)</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Idade</th>
                  <th>Telefone</th>
                  <th>Bairro</th>
                  {!lider && <th>Célula</th>}
                  <th>Cadastro</th>
                  <th>Status</th>
                  <th className="sr-only">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.idMembro}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar nome={m.nomeCompleto} size="sm" />
                        <LinkMembro membro={m} />
                      </div>
                    </td>
                    <td>{m.idade}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{m.telefone}</td>
                    <td>{m.bairro}</td>
                    {!lider && <td>{m.celula?.nomeCelula ?? '—'}</td>}
                    <td>{formatarData(m.dataCadastro)}</td>
                    <td><StatusMembroBadge status={m.statusMembro} /></td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        {admin && (
                          <Link to={`/membros/${m.idMembro}/editar`} className="btn btn--sm btn--ghost" aria-label={`Editar ${m.nomeCompleto}`}>
                            <Pencil size={14} />
                          </Link>
                        )}
                        {(admin || lider) && m.celula && (
                          <button className="btn btn--sm btn--ghost" onClick={() => setSaida(m)} aria-label={`Registrar saída de ${m.nomeCompleto}`} title="Registrar saída">
                            <LogOut size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SaidaMembroModal membro={saida} admin={admin} onClose={() => setSaida(null)} onConcluido={() => membros.recarregar({ silencioso: true })} />
    </>
  );
}
