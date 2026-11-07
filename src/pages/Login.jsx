import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { config } from '../services/config';
import { TextField } from '../components/ui';
import { isEmail } from '../utils/validators';

const CONTAS_DEMO = [
  { email: 'voluntario@conectus.app', papel: 'Voluntária', nome: 'Carolina Magalhães' },
  { email: 'pedro@conectus.app', papel: 'Líder', nome: 'Pedro Almeida · Vila Mariana' },
  { email: 'admin@conectus.app', papel: 'Administradora', nome: 'Julia Antonieli' },
  { email: 'isaac@conectus.app', papel: 'Admin (outra igreja)', nome: 'Isaac Montanari · Ribeirão Preto' },
];

// Login
export default function Login() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const entrar = async (e, credenciais) => {
    e?.preventDefault();
    const em = credenciais?.email ?? email;
    const se = credenciais?.senha ?? senha;
    if (!isEmail(em) || !se) {
      setErro('Informe um e-mail válido e a senha.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await login(em, se);
      navigate(location.state?.de?.pathname ?? '/', { replace: true });
    } catch (err) {
      // credenciais inválidas: mostra a mensagem e volta ao formulário
      setErro(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Acesso</div>
        <h1 className="page-title">Entrar</h1>
        <p className="page-subtitle">Use suas credenciais do Conectus.</p>

        <form onSubmit={entrar} className="stack" style={{ marginTop: 22 }} noValidate>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@conectus.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setErro('Solicite a redefinição de senha ao administrador da sua igreja.')}
            >
              Esqueci minha senha
            </button>
          </div>
          {erro && (
            <div className="alert alert--danger" role="alert">
              {erro}
            </div>
          )}
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={enviando}>
            <LogIn size={17} /> {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
          Sua igreja ainda não usa o Conectus? <Link to="/cadastro-igreja" className="strong">Cadastrar igreja</Link>
        </p>

        {config.useMock && (
          <div className="demo-accounts">
            <div className="eyebrow">Contas de demonstração · senha conectus123</div>
            <div className="stack" style={{ gap: 6 }}>
              {CONTAS_DEMO.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  className="btn btn--sm"
                  style={{ justifyContent: 'space-between' }}
                  disabled={enviando}
                  onClick={(e) => entrar(e, { email: c.email, senha: 'conectus123' })}
                >
                  <span>{c.nome}</span>
                  <span className="badge badge--neutral">{c.papel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
