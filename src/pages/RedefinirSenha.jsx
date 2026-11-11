import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { TextField } from '../components/ui';
import { validarNovaSenha } from '../utils/validators';

// Destino do link enviado por e-mail: /redefinir-senha?token=...
export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ novaSenha: '', confirmacao: '' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const er = validarNovaSenha(f);
    setErros(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    setErroGeral('');
    try {
      const r = await authService.redefinirSenha(token, f.novaSenha);
      toast.sucesso(r?.mensagem ?? 'Senha redefinida.');
      navigate('/login', { replace: true });
    } catch (err) {
      setErros(err.campos ?? {});
      setErroGeral(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Acesso</div>
        <h1 className="page-title">Criar nova senha</h1>

        {!token ? (
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="alert alert--danger">Link incompleto. Abra novamente o link recebido por e-mail ou peça um novo.</div>
            <Link to="/esqueci-senha" className="btn btn--block">Pedir novo link</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="stack" style={{ marginTop: 22 }} noValidate>
            <TextField label="Nova senha" type="password" autoComplete="new-password" value={f.novaSenha} onChange={set('novaSenha')} error={erros.novaSenha} hint="Mínimo de 8 caracteres" autoFocus />
            <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={f.confirmacao} onChange={set('confirmacao')} error={erros.confirmacao} />
            {erroGeral && (
              <div className="alert alert--danger" role="alert">
                <span>
                  {erroGeral} <Link to="/esqueci-senha" className="strong">Pedir novo link</Link>
                </span>
              </div>
            )}
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
