import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { igrejaService, planoService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { SelectField, TextField } from '../components/ui';
import { PLANOS, UFS } from '../utils/constants';
import { formatarNumero } from '../utils/format';
import { isEmail, temErros, validarIgreja } from '../utils/validators';

// Se GET /planos falhar, a tela continua usando os valores padrão
const PLANOS_PADRAO = Object.entries(PLANOS).map(([idPlano, p]) => ({
  idPlano,
  nome: p.label,
  valor: p.preco,
  limites: p.limites,
}));
const limiteTexto = (n) => (n == null || !Number.isFinite(n) ? 'ilimitados' : formatarNumero(n));

const vazio = {
  nomeIgreja: '', denominacao: '', cidade: '', estado: 'SP', plano: 'ESSENCIAL',
  nome: '', email: '', senha: '',
};

// Onboarding SaaS: cria a igreja e o primeiro administrador
export default function CadastroIgreja() {
  const navigate = useNavigate();
  const { iniciarSessao } = useAuth();
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e.target.value }));
  const catalogo = useAsync(() => planoService.listar(), []);
  const planos = catalogo.dados?.planos ?? PLANOS_PADRAO;
  const trialDias = catalogo.dados?.trialDias;

  const enviar = async (e) => {
    e.preventDefault();
    const er = validarIgreja(f, { exigirPlano: true });
    if (!f.nome.trim()) er.nome = 'Informe seu nome.';
    if (!isEmail(f.email)) er.email = 'E-mail inválido.';
    if (f.senha.length < 8) er.senha = 'Mínimo de 8 caracteres.';
    setErros(er);
    if (temErros(er)) return;
    setEnviando(true);
    setErroGeral('');
    try {
      const r = await igrejaService.criar({
        igreja: { nomeIgreja: f.nomeIgreja, denominacao: f.denominacao, cidade: f.cidade, estado: f.estado, plano: f.plano },
        administrador: { nome: f.nome, email: f.email, senha: f.senha },
      });
      // a assinatura em teste grátis já começa no cadastro; o pagamento pode ser feito depois
      iniciarSessao(r.token, { ...r.usuario, assinatura: r.usuario.assinatura ?? r.igreja?.assinatura ?? null });
      navigate('/assinatura', { replace: true, state: { boasVindas: true } });
    } catch (err) {
      setErros(err.campos ?? {});
      setErroGeral(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ width: 'min(720px, 100%)' }}>
        <div className="eyebrow">Nova igreja</div>
        <h1 className="page-title">Cadastrar igreja</h1>
        <p className="page-subtitle">Os dados de cada igreja ficam isolados das demais.</p>

        <form onSubmit={enviar} noValidate style={{ marginTop: 20 }}>
          <div className="form-grid">
            <TextField className="span-2" label="Nome da igreja" value={f.nomeIgreja} onChange={set('nomeIgreja')} error={erros.nomeIgreja} />
            <TextField label="Denominação" value={f.denominacao} onChange={set('denominacao')} hint="Opcional" />
            <TextField label="Cidade" value={f.cidade} onChange={set('cidade')} error={erros.cidade} />
            <SelectField label="Estado" value={f.estado} onChange={set('estado')} options={UFS.map((u) => ({ value: u, label: u }))} error={erros.estado} />
          </div>

          <div className="eyebrow" style={{ marginTop: 22 }}>Plano</div>
          {trialDias > 0 && (
            <p className="small muted" style={{ marginTop: 0 }}>
              Os primeiros {trialDias} dias são grátis. O pagamento pelo Mercado Pago pode ser feito depois, dentro do sistema.
            </p>
          )}
          <div className="grid grid--3">
            {planos.map((p) => (
              <button
                type="button"
                key={p.idPlano}
                className={`card card--flat ${f.plano === p.idPlano ? 'btn--selected' : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer', padding: 14 }}
                onClick={() => setF((v) => ({ ...v, plano: p.idPlano }))}
                aria-pressed={f.plano === p.idPlano}
              >
                <div className="row row--between">
                  <span className="strong">{p.nome}</span>
                  {f.plano === p.idPlano && <Check size={16} />}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>R$ {p.valor}<span className="small muted">/mês</span></div>
                <div className="tiny muted">
                  {limiteTexto(p.limites.membros)} membros · {limiteTexto(p.limites.celulas)} células · {limiteTexto(p.limites.usuarios)} usuários
                </div>
              </button>
            ))}
          </div>
          {erros.plano && <span className="field__error">{erros.plano}</span>}

          <div className="eyebrow" style={{ marginTop: 22 }}>Administrador</div>
          <div className="form-grid">
            <TextField className="span-2" label="Seu nome" value={f.nome} onChange={set('nome')} error={erros.nome} />
            <TextField label="E-mail" type="email" value={f.email} onChange={set('email')} error={erros.email} autoComplete="email" />
            <TextField label="Senha" type="password" value={f.senha} onChange={set('senha')} error={erros.senha} autoComplete="new-password" />
          </div>

          {erroGeral && <div className="alert alert--danger" style={{ marginTop: 16 }}>{erroGeral}</div>}

          <div className="modal__footer">
            <Link to="/login" className="btn">Já tenho conta</Link>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Cadastrando…' : 'Cadastrar igreja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
