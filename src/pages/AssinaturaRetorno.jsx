import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { assinaturaService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ErrorState, Loading, PageHeader } from '../components/ui';
import { formatarData } from '../utils/format';

/**
 * Página para onde o Mercado Pago devolve o cliente depois do pagamento.
 * Relê a assinatura no back-end (que consulta o Mercado Pago), sem depender só do webhook.
 */
export default function AssinaturaRetorno() {
  const { atualizarSessao } = useAuth();
  const [estado, setEstado] = useState({ carregando: true, assinatura: null, erro: null });

  const verificar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    try {
      const assinatura = await assinaturaService.sincronizar();
      await atualizarSessao();
      setEstado({ carregando: false, assinatura, erro: null });
    } catch (erro) {
      setEstado({ carregando: false, assinatura: null, erro });
    }
  }, [atualizarSessao]);

  useEffect(() => {
    verificar();
  }, [verificar]);

  const { carregando, assinatura: a, erro } = estado;
  const confirmado = a && a.formaCobranca === 'MERCADO_PAGO' && ['ATIVA', 'ATRASADA'].includes(a.status);

  return (
    <>
      <PageHeader eyebrow="Assinatura" title="Pagamento" back="/assinatura" />
      {carregando && <Loading texto="Confirmando o pagamento…" />}
      {!carregando && erro && <ErrorState erro={erro} onRetry={verificar} />}
      {!carregando && a && (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          {confirmado ? (
            <>
              <CheckCircle2 size={40} color="var(--success)" />
              <h2 className="card__title" style={{ marginTop: 10 }}>Assinatura confirmada!</h2>
              <p className="muted">
                Plano {a.plano.nome} ativo. Próxima cobrança em {formatarData(a.vencimento)}.
              </p>
            </>
          ) : (
            <>
              <Clock size={40} color="var(--warning)" />
              <h2 className="card__title" style={{ marginTop: 10 }}>Pagamento em processamento</h2>
              <p className="muted">
                Ainda não recebemos a confirmação do Mercado Pago. Isso pode levar alguns minutos; a assinatura é ativada
                automaticamente assim que o pagamento for aprovado.
              </p>
              <button className="btn" onClick={verificar}>Verificar novamente</button>
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <Link to="/assinatura" className="btn btn--primary">Ver minha assinatura</Link>
          </div>
        </div>
      )}
    </>
  );
}
