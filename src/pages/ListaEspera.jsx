import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BellRing, Clock, RotateCcw, Sparkles } from 'lucide-react';
import { listaEsperaService } from '../services/api';
import { config } from '../services/config';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { Avatar, EmptyState, ErrorState, Loading, PageHeader, ScoreBadge } from '../components/ui';
import { tempoRelativo } from '../utils/format';

// Gerenciar lista de espera
export default function ListaEspera() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const destaque = Number(params.get('membro'));
  const { dados, erro, carregando, recarregar } = useAsync(() => listaEsperaService.listar(), [], { pollingMs: config.pollingMs });

  const manter = async (item) => {
    try {
      await listaEsperaService.registrarTentativa(item.idEspera);
      toast.sucesso(`${item.membro.nomeCompleto} permanece na lista. Tentativa registrada.`);
      recarregar({ silencioso: true });
    } catch (e) {
      toast.erro(e);
    }
  };

  const lista = dados ?? [];
  const comVaga = lista.filter((i) => i.vagaDisponivel).length;

  return (
    <>
      <PageHeader eyebrow="Atenção especial" title="Lista de espera" subtitle="Membros sem célula compatível aguardando uma conexão personalizada." />

      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}

      {dados && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <Clock size={18} />
          <span>
            {lista.length} pessoa(s) aguardando triagem.
            {comVaga > 0 && <> <strong>{comVaga}</strong> {comVaga === 1 ? 'já tem' : 'já têm'} uma vaga compatível disponível.</>}
          </span>
        </div>
      )}

      {dados && lista.length === 0 && <EmptyState title="Lista de espera vazia">Todos os membros estão conectados a uma célula.</EmptyState>}

      <div className="stack">
        {lista.map((item) => (
          <div
            className="list-row"
            key={item.idEspera}
            style={item.membro.idMembro === destaque ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } : undefined}
          >
            <Avatar nome={item.membro.nomeCompleto} soft />
            <div className="list-row__main">
              <div className="list-row__name">{item.membro.nomeCompleto}</div>
              <div className="small muted">
                {item.membro.idade} anos · {item.membro.bairro} · {tempoRelativo(item.dataEntrada)} · {item.tentativas} tentativa(s)
              </div>
            </div>
            <div className="small" style={{ flex: 1, minWidth: 220 }}>
              <div className="row" style={{ gap: 6 }}>
                {item.vagaDisponivel ? <BellRing size={14} color="var(--success)" /> : <Sparkles size={14} />}
                <span className="muted">Melhor sugestão:</span>
                <span className="strong">{item.melhorSugestao?.compativel ? item.melhorSugestao.nomeCelula : 'Sem célula compatível'}</span>
              </div>
              <div className="tiny muted">{item.motivo}</div>
            </div>
            <ScoreBadge score={item.melhorSugestao?.score} />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--sm" onClick={() => manter(item)} title="Manter na lista e registrar a tentativa">
                <RotateCcw size={14} /> Manter
              </button>
              <button
                className={`btn btn--sm ${item.vagaDisponivel ? 'btn--primary' : ''}`}
                onClick={() => navigate(`/triagem/${item.membro.idMembro}${item.vagaDisponivel ? '' : '?modo=MANUAL'}`)}
              >
                {item.vagaDisponivel ? 'Alocar agora' : 'Triar manualmente'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
