/**
 * @vitest-environment jsdom
 *
 * Testes de integração do front-end em modo demonstração: renderizam a aplicação
 * completa e percorrem os principais casos de uso como um usuário faria.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { resetarDb } from '../services/mock/db';

const ir = (rota) => window.history.pushState({}, '', rota);

async function entrarComo(nomeBotao) {
  ir('/login');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(nomeBotao) }));
  await screen.findByText(/Bem-vindo ao Conectus/);
}

const navegar = (rotulo) => fireEvent.click(screen.getAllByRole('link', { name: rotulo })[0]);

beforeEach(() => {
  window.localStorage.clear();
  resetarDb();
  window.scrollTo = () => {};
});
afterEach(cleanup);

describe('login', () => {
  it('rejeita credenciais inválidas', async () => {
    ir('/login');
    render(<App />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'x@conectus.app' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos');
  });

  it('redireciona para o login quando não autenticado', async () => {
    ir('/triagem');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  });
});

async function entrarComCredenciais(email, senha) {
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } });
  fireEvent.click(screen.getByRole('button', { name: /^Entrar$/ }));
}

describe('senha', () => {
  it('recupera a senha pelo link e entra com a nova senha', async () => {
    ir('/login');
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Esqueci minha senha' }));
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'voluntario@conectus.app' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir o link de redefinição' }));

    fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: 'novaSenha2026' } });
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'outraCoisa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText('As senhas não conferem.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'novaSenha2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await screen.findByRole('heading', { name: 'Entrar' });
    await entrarComCredenciais('voluntario@conectus.app', 'novaSenha2026');
    expect(await screen.findByText(/Bem-vindo ao Conectus/)).toBeTruthy();
  });

  it('usuário com senha temporária precisa trocá-la no primeiro acesso', async () => {
    await entrarComo('Julia Antonieli');
    navegar('Usuários');
    fireEvent.click(await screen.findByRole('button', { name: /Redefinir senha de Carolina Magalhães/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Senha temporária'), { target: { value: 'Temp12345' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Definir senha' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    cleanup();

    window.localStorage.removeItem('conectus.token');
    ir('/login');
    render(<App />);
    await entrarComCredenciais('voluntario@conectus.app', 'Temp12345');
    expect(await screen.findByRole('heading', { name: 'Defina sua senha' })).toBeTruthy();

    // enquanto não trocar, qualquer página leva de volta à troca de senha
    fireEvent.change(screen.getByLabelText('Senha temporária'), { target: { value: 'Temp12345' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'minhaSenha99' } });
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'minhaSenha99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(await screen.findByText(/Bem-vindo ao Conectus/)).toBeTruthy();
  });
});

describe('Voluntário — cadastro e triagem', () => {
  it('cadastra membro e aloca pela sugestão automática', async () => {
    await entrarComo('Carolina Magalhães');
    fireEvent.click(screen.getByRole('link', { name: /Cadastrar novo membro/ }));
    await screen.findByRole('heading', { name: 'Cadastrar membro' });

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Paulo Henrique Nunes' } });
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2001-03-15' } });
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'M' } });
    fireEvent.change(screen.getByLabelText('Estado civil'), { target: { value: 'SOLTEIRO' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '11987654321' } });
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '04010100' } });
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Vila Mariana' } });
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } });
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: 'QUA' } });

    // sem a autorização do visitante o cadastro não é enviado
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e triar' }));
    expect(await screen.findByText('Confirme a autorização do visitante para continuar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /autorizou a igreja/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e triar' }));

    await screen.findByRole('heading', { name: 'Encontrar a célula ideal' });
    expect(await screen.findByText('Melhor opção')).toBeTruthy();
    expect(screen.getAllByText('Vila Mariana - Jovens').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Escolher/ })[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar alocação' }));
    expect(await screen.findByText('Conexão realizada!')).toBeTruthy();
  });

  it('triagem manual bloqueia célula lotada', async () => {
    await entrarComo('Carolina Magalhães');
    navegar('Triagem');
    await screen.findByText('Mariana Costa');
    fireEvent.click(screen.getByRole('button', { name: /Triagem manual/ }));
    const select = screen.getByLabelText('Célula para Mariana Costa');
    const lotada = within(select).getByRole('option', { name: /Lapa - Famílias — lotada/ });
    expect(lotada.disabled).toBe(true);
    fireEvent.change(select, { target: { value: '1' } });
    const linha = select.closest('.list-row');
    fireEvent.click(within(linha).getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(screen.queryByLabelText('Célula para Mariana Costa')).toBeNull());
  });

  it('lista de espera mostra os membros aguardando', async () => {
    await entrarComo('Carolina Magalhães');
    navegar('Lista de espera');
    expect(await screen.findByText('Marcos Silveira')).toBeTruthy();
    expect(screen.getByText(/4 pessoa\(s\) aguardando/)).toBeTruthy();
  });
});

describe('Líder', () => {
  it('registra feedback rápido de um membro da célula', async () => {
    await entrarComo('Pedro Almeida');
    navegar('Feedback');
    await screen.findByText('Diego Alves');
    const card = screen.getByText('Diego Alves').closest('.card');
    fireEvent.click(within(card).getByRole('button', { name: /Participando/ }));
    await waitFor(() => expect(within(card).getByText('Participando', { selector: '.badge' })).toBeTruthy());
  });

  it('líder não acessa relatórios', async () => {
    await entrarComo('Pedro Almeida');
    expect(screen.queryByRole('link', { name: 'Dashboards' })).toBeNull();
  });
});

describe('Administrador', () => {
  it('dashboards e relatórios carregam', async () => {
    await entrarComo('Julia Antonieli');
    navegar('Dashboards');
    expect(await screen.findByText('Novos membros por mês')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocupação' }));
    expect(await screen.findByText('Taxa de ocupação por célula')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Distribuição geográfica' }));
    expect(await screen.findByText('Membros por bairro')).toBeTruthy();
  });

  it('usuários, células e configurações', async () => {
    await entrarComo('Julia Antonieli');
    navegar('Usuários');
    expect(await screen.findByText('voluntario@conectus.app')).toBeTruthy();
    navegar('Células');
    expect(await screen.findByText('Pinheiros - Mulheres')).toBeTruthy();
    navegar('Configurações');
    expect(await screen.findByDisplayValue('Igreja Batista Nova Vida')).toBeTruthy();
  });

  it('exclui definitivamente os dados de um membro', async () => {
    await entrarComo('Julia Antonieli');
    navegar('Membros');
    fireEvent.click(await screen.findByRole('link', { name: 'Diego Alves' }));
    expect(await screen.findByText('Consentimento LGPD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Excluir dados/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir definitivamente' }));
    await screen.findByRole('heading', { name: 'Membros' });
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Diego Alves' })).toBeNull());
  });

  it('dados de outra igreja ficam isolados', async () => {
    await entrarComo('Isaac Montanari');
    navegar('Células');
    expect(await screen.findByText('Jardim Botânico - Jovens')).toBeTruthy();
    expect(screen.queryByText('Vila Mariana - Jovens')).toBeNull();
  });
});
