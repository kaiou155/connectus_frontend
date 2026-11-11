import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PERFIS } from '../utils/constants';
import { formatarData } from '../utils/format';

const MOTIVOS = {
  TESTE_ENCERRADO: 'O período de teste gratuito terminou.',
  PAGAMENTO_ATRASADO: 'O pagamento da assinatura está em atraso.',
  ASSINATURA_CANCELADA: 'A assinatura foi cancelada.',
  ASSINATURA_EXPIRADA: 'A assinatura expirou.',
};

const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/**
 * Faixa no topo das telas com a situação da assinatura da igreja.
 * Não aparece quando a assinatura está ativa e em dia.
 */
export default function AssinaturaAviso() {
  const { usuario } = useAuth();
  const a = usuario?.assinatura;
  if (!a || a.status === 'ATIVA') return null;

  const admin = usuario.perfil === PERFIS.ADMINISTRADOR;
  const acao = (rotulo) =>
    admin && (
      <Link to="/assinatura" className="btn btn--sm" style={{ marginLeft: 'auto' }}>
        {rotulo}
      </Link>
    );

  if (!a.liberado) {
    return (
      <div className="alert alert--danger no-print" role="alert" style={{ marginBottom: 18 }}>
        <Lock size={18} />
        <span>
          <strong>{MOTIVOS[a.motivoBloqueio] ?? MOTIVOS.ASSINATURA_EXPIRADA}</strong> O sistema está em modo somente leitura: é possível consultar,
          mas não cadastrar nem alterar dados.{' '}
          {!admin && 'Peça ao administrador da igreja para regularizar a assinatura.'}
        </span>
        {acao('Regularizar')}
      </div>
    );
  }

  if (a.status === 'TESTE') {
    return (
      <div className="alert alert--info no-print" style={{ marginBottom: 18 }}>
        <Clock size={18} />
        <span>
          <strong>Teste grátis:</strong> {a.diasRestantes === 0 ? 'termina hoje' : `faltam ${dias(a.diasRestantes)}`}.
          {admin && ' Assine um plano para continuar usando depois do teste.'}
        </span>
        {acao('Ver planos')}
      </div>
    );
  }

  if (a.status === 'ATRASADA') {
    return (
      <div className="alert no-print" style={{ marginBottom: 18 }}>
        <AlertTriangle size={18} />
        <span>
          <strong>Pagamento em atraso.</strong> O acesso continua até {formatarData(a.acessoAte)}; depois o sistema fica somente leitura.
        </span>
        {acao('Regularizar')}
      </div>
    );
  }

  // CANCELADA: acesso até o fim do período já pago
  return (
    <div className="alert alert--info no-print" style={{ marginBottom: 18 }}>
      <Clock size={18} />
      <span>
        <strong>Assinatura cancelada.</strong> O acesso continua até {formatarData(a.acessoAte)}.
      </span>
      {acao('Reativar')}
    </div>
  );
}
