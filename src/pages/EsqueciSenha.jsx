import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { authService } from '../services/api';
import { TextField } from '../components/ui';
import { isEmail } from '../utils/validators';

// Pedido de redefinição de senha: o back-end envia um link válido por 1 hora
export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      setResposta(await authService.esqueciSenha(email.trim()));
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Acesso</div>
        <h1 className="page-title">Esqueci minha senha</h1>

        {resposta ? (
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="alert alert--success" role="status">
              <MailCheck size={18} /> <span>{resposta.mensagem}</span>
            </div>
            {resposta.linkDemonstracao && (
              <div className="alert alert--info">
                <span>
                  No modo demonstração nenhum e-mail é enviado.{' '}
                  <Link className="strong" to={resposta.linkDemonstracao}>Abrir o link de redefinição</Link>
                </span>
              </div>
            )}
            <Link to="/login" className="btn btn--block">Voltar ao login</Link>
          </div>
        ) : (
          <>
            <p className="page-subtitle">Informe o e-mail de acesso. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha.</p>
            <form onSubmit={enviar} className="stack" style={{ marginTop: 22 }} noValidate>
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={erro}
                autoFocus
              />
              <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar link'}
              </button>
              <Link to="/login" className="btn btn--ghost btn--block">Voltar ao login</Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
