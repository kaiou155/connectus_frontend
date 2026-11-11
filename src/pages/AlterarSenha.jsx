import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TextField } from '../components/ui';
import { validarNovaSenha } from '../utils/validators';

/**
 * Troca de senha do usuário logado.
 * Quem entrou com uma senha temporária (criada pelo administrador) é trazido para cá
 * e só acessa o sistema depois de definir a própria senha.
 */
export default function AlterarSenha() {
  const { usuario, atualizarSessao, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const obrigatoria = Boolean(usuario?.senhaTemporaria);
  const [f, setF] = useState({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const er = validarNovaSenha(f);
    if (!f.senhaAtual) er.senhaAtual = obrigatoria ? 'Informe a senha temporária.' : 'Informe a senha atual.';
    else if (f.senhaAtual === f.novaSenha) er.novaSenha = 'A nova senha deve ser diferente da atual.';
    setErros(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    try {
      const r = await authService.alterarSenha(f.senhaAtual, f.novaSenha);
      await atualizarSessao();
      toast.sucesso(r?.mensagem ?? 'Senha alterada.');
      navigate('/', { replace: true });
    } catch (err) {
      setErros(err.campos ?? {});
      if (!err.campos) toast.erro(err);
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Minha conta</div>
        <h1 className="page-title">{obrigatoria ? 'Defina sua senha' : 'Alterar senha'}</h1>
        {obrigatoria && (
          <div className="alert alert--info" style={{ marginTop: 14 }}>
            <KeyRound size={18} />
            <span>Você entrou com uma senha temporária. Crie uma senha pessoal para continuar.</span>
          </div>
        )}

        <form onSubmit={enviar} className="stack" style={{ marginTop: 18 }} noValidate>
          <TextField
            label={obrigatoria ? 'Senha temporária' : 'Senha atual'}
            type="password"
            autoComplete="current-password"
            value={f.senhaAtual}
            onChange={set('senhaAtual')}
            error={erros.senhaAtual}
            autoFocus
          />
          <TextField label="Nova senha" type="password" autoComplete="new-password" value={f.novaSenha} onChange={set('novaSenha')} error={erros.novaSenha} hint="Mínimo de 8 caracteres" />
          <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={f.confirmacao} onChange={set('confirmacao')} error={erros.confirmacao} />
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar senha'}
          </button>
          {obrigatoria ? (
            <button type="button" className="btn btn--ghost btn--block" onClick={logout}>Sair</button>
          ) : (
            <Link to="/" className="btn btn--ghost btn--block">Cancelar</Link>
          )}
        </form>
      </div>
    </div>
  );
}
