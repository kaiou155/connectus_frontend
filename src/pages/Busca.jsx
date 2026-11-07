import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { buscaService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { Avatar, Badge, EmptyState, ErrorState, Loading, PageHeader, StatusMembroBadge } from '../components/ui';
import { CelulaDetalhesModal, encontroTexto } from '../components/domain';
import { perfilGrupoLabel } from '../utils/constants';

// Busca global (cabeçalho)
export default function Busca() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { dados, erro, carregando, recarregar } = useAsync(() => buscaService.buscar(q), [q]);
  const [celula, setCelula] = useState(null);

  const total = dados ? dados.membros.length + dados.celulas.length + dados.lideres.length : 0;

  return (
    <>
      <PageHeader eyebrow="Busca" title={`Resultados para “${q}”`} />
      {carregando && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados && total === 0 && <EmptyState icon={Search} title="Nada encontrado">Tente outro nome, bairro ou célula.</EmptyState>}

      {dados?.membros.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div className="eyebrow">Membros</div>
          <div className="stack">
            {dados.membros.map((m) => (
              <Link to={`/membros/${m.idMembro}`} className="list-row card--link" key={m.idMembro}>
                <Avatar nome={m.nomeCompleto} size="sm" />
                <div className="list-row__main">
                  <div className="list-row__name">{m.nomeCompleto}</div>
                  <div className="small muted">{m.idade} anos · {m.bairro} · {m.celula?.nomeCelula ?? 'sem célula'}</div>
                </div>
                <StatusMembroBadge status={m.statusMembro} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {dados?.celulas.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div className="eyebrow">Células</div>
          <div className="stack">
            {dados.celulas.map((c) => (
              <button className="list-row card--link" key={c.idCelula} onClick={() => setCelula(c.idCelula)} style={{ textAlign: 'left', cursor: 'pointer' }}>
                <div className="list-row__main">
                  <div className="list-row__name">{c.nomeCelula}</div>
                  <div className="small muted">{encontroTexto(c)} · {c.capacidadeAtual}/{c.capacidadeMaxima} membros</div>
                </div>
                <Badge>{perfilGrupoLabel(c.perfilGrupo)}</Badge>
              </button>
            ))}
          </div>
        </section>
      )}

      {dados?.lideres.length > 0 && (
        <section>
          <div className="eyebrow">Líderes</div>
          <div className="stack">
            {dados.lideres.map((l) => (
              <Link to="/lideres" className="list-row card--link" key={l.idUsuario}>
                <Avatar nome={l.nome} size="sm" />
                <div className="list-row__main">
                  <div className="list-row__name">{l.nome}</div>
                  <div className="small muted">{l.celula?.nomeCelula ?? 'Sem célula'} · {l.telefone}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CelulaDetalhesModal idCelula={celula} onClose={() => setCelula(null)} />
    </>
  );
}
