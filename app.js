const telas = document.querySelectorAll('.tela');
const abas = document.querySelectorAll('.aba');

abas.forEach(botao => {
  botao.addEventListener('click', () => {
    abas.forEach(a => a.classList.remove('ativa'));
    telas.forEach(t => t.classList.remove('ativa'));
    botao.classList.add('ativa');
    document.getElementById(botao.dataset.tela).classList.add('ativa');
  });
});

function mostrarMensagem(texto) {
  const caixa = document.getElementById('mensagem');
  caixa.textContent = texto;
  caixa.style.display = 'block';
  setTimeout(() => caixa.style.display = 'none', 2500);
}

async function api(url, opcoes = {}) {
  const resposta = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes
  });

  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Erro na operação.');
  return dados;
}

async function carregarEquipamentos() {
  const dados = await api('/api/equipamentos');
  const tabela = document.getElementById('listaEquipamentos');
  const selectMan = document.getElementById('manEquipamento');
  const filtro = document.getElementById('filtroEquipamento');

  tabela.innerHTML = '';
  selectMan.innerHTML = '<option value="">Selecione...</option>';
  filtro.innerHTML = '<option value="">Todos os equipamentos</option>';

  dados.forEach(e => {
    tabela.innerHTML += `
      <tr>
        <td>${e.nome}</td><td>${e.setor}</td><td>${e.fabricante || '-'}</td><td>${e.modelo || '-'}</td>
        <td><button class="botao-excluir" onclick="excluirEquipamento(${e.id})">Excluir</button></td>
      </tr>`;
    selectMan.innerHTML += `<option value="${e.id}">${e.nome} - ${e.setor}</option>`;
    filtro.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
  });
}

async function carregarManutencoes(equipamentoId = '') {
  const sufixo = equipamentoId ? `?equipamento_id=${equipamentoId}` : '';
  const dados = await api('/api/manutencoes' + sufixo);
  const tabela = document.getElementById('listaHistorico');
  const selectPeca = document.getElementById('pecaManutencao');

  tabela.innerHTML = '';
  selectPeca.innerHTML = '<option value="">Selecione...</option>';

  dados.forEach(m => {
    tabela.innerHTML += `
      <tr>
        <td>${m.data_manutencao}</td><td>${m.equipamento_nome}</td><td>${m.setor}</td>
        <td>${m.descricao}</td><td>${m.responsavel}</td><td>${m.proxima_manutencao || '-'}</td>
      </tr>`;
    selectPeca.innerHTML += `<option value="${m.id}">${m.data_manutencao} - ${m.equipamento_nome}</option>`;
  });
}

async function carregarPecas() {
  const dados = await api('/api/pecas');
  const tabela = document.getElementById('listaPecas');
  tabela.innerHTML = '';

  dados.forEach(p => {
    tabela.innerHTML += `
      <tr><td>${p.data_manutencao}</td><td>${p.equipamento_nome}</td><td>${p.nome_peca}</td>
      <td>${p.codigo_peca || '-'}</td><td>${p.quantidade}</td></tr>`;
  });
}

async function excluirEquipamento(id) {
  if (!confirm('Deseja excluir este equipamento e seus registros relacionados?')) return;
  await api(`/api/equipamentos/${id}`, { method: 'DELETE' });
  mostrarMensagem('Equipamento excluído.');
  await atualizarTudo();
}

window.excluirEquipamento = excluirEquipamento;

document.getElementById('formEquipamento').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  await api('/api/equipamentos', {
    method: 'POST',
    body: JSON.stringify({
      nome: document.getElementById('equipNome').value,
      setor: document.getElementById('equipSetor').value,
      fabricante: document.getElementById('equipFabricante').value,
      modelo: document.getElementById('equipModelo').value
    })
  });
  evento.target.reset();
  mostrarMensagem('Equipamento salvo.');
  await atualizarTudo();
});

document.getElementById('formManutencao').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  await api('/api/manutencoes', {
    method: 'POST',
    body: JSON.stringify({
      equipamento_id: document.getElementById('manEquipamento').value,
      data_manutencao: document.getElementById('manData').value,
      descricao: document.getElementById('manDescricao').value,
      responsavel: document.getElementById('manResponsavel').value,
      proxima_manutencao: document.getElementById('manProxima').value
    })
  });
  evento.target.reset();
  mostrarMensagem('Manutenção registrada.');
  await atualizarTudo();
});

document.getElementById('formPeca').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  await api('/api/pecas', {
    method: 'POST',
    body: JSON.stringify({
      manutencao_id: document.getElementById('pecaManutencao').value,
      nome_peca: document.getElementById('pecaNome').value,
      codigo_peca: document.getElementById('pecaCodigo').value,
      quantidade: Number(document.getElementById('pecaQuantidade').value)
    })
  });
  evento.target.reset();
  document.getElementById('pecaQuantidade').value = 1;
  mostrarMensagem('Peça registrada.');
  await carregarPecas();
});

document.getElementById('filtroEquipamento').addEventListener('change', (evento) => {
  carregarManutencoes(evento.target.value).catch(erro => mostrarMensagem(erro.message));
});

async function atualizarTudo() {
  await carregarEquipamentos();
  await carregarManutencoes();
  await carregarPecas();
}

// Dados de demonstração usados apenas quando o arquivo HTML é aberto sem o servidor.
// Isso permite visualizar a interface durante a apresentação do protótipo.
function modoDemonstracao() {
  if (location.protocol !== 'file:') return false;

  document.getElementById('listaEquipamentos').innerHTML = `
    <tr><td>Enchedora Linha 1</td><td>Envase</td><td>KHS</td><td>Innofill</td><td><button class="botao-excluir">Excluir</button></td></tr>
    <tr><td>Paletizadora</td><td>Final de linha</td><td>KUKA</td><td>M-410</td><td><button class="botao-excluir">Excluir</button></td></tr>`;

  const opcoes = `
    <option value="1">Enchedora Linha 1 - Envase</option>
    <option value="2">Paletizadora - Final de linha</option>`;
  document.getElementById('manEquipamento').innerHTML = '<option>Selecione...</option>' + opcoes;
  document.getElementById('filtroEquipamento').innerHTML = '<option>Todos os equipamentos</option>' + opcoes;

  document.getElementById('listaHistorico').innerHTML = `
    <tr><td>2026-09-20</td><td>Enchedora Linha 1</td><td>Envase</td><td>Inspeção e lubrificação dos conjuntos mecânicos.</td><td>Marcos</td><td>2026-10-20</td></tr>
    <tr><td>2026-09-12</td><td>Paletizadora</td><td>Final de linha</td><td>Verificação de sensores e reaperto elétrico.</td><td>Marcos</td><td>2026-11-12</td></tr>`;

  document.getElementById('pecaManutencao').innerHTML = `
    <option>Selecione...</option>
    <option>2026-09-20 - Enchedora Linha 1</option>
    <option>2026-09-12 - Paletizadora</option>`;
  document.getElementById('listaPecas').innerHTML = `
    <tr><td>2026-09-20</td><td>Enchedora Linha 1</td><td>Rolamento 6204</td><td>6204-2RS</td><td>2</td></tr>
    <tr><td>2026-09-12</td><td>Paletizadora</td><td>Sensor indutivo</td><td>IND-M18</td><td>1</td></tr>`;
  return true;
}

if (!modoDemonstracao()) {
  atualizarTudo().catch(erro => mostrarMensagem(erro.message));
}
