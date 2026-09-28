document.addEventListener("DOMContentLoaded", () => {

    console.log("ORÇAOBRA iniciado.");

    // ---------- Referências gerais ----------
    const homeView = document.getElementById("homeView");
    const orcamentoView = document.getElementById("orcamentoView");
    const radarPrejuizo = document.getElementById("radarPrejuizo");
    const indicadorResultado = document.getElementById("indicadorResultado");

    const TOTAL_PASSOS = 8;
    let passoAtual = 1;

    // ---------- Navegação tela inicial <-> orçamento ----------
    function abrirNovoOrcamento() {
        limparFormulario();
        passoAtual = 1;
        atualizarPasso();
        homeView.classList.add("hidden");
        orcamentoView.classList.remove("hidden");
        window.scrollTo(0, 0);
    }

    function voltarParaHome() {
        orcamentoView.classList.add("hidden");
        homeView.classList.remove("hidden");
        window.scrollTo(0, 0);
    }

    document.getElementById("btnNovoOrcamento").addEventListener("click", abrirNovoOrcamento);
    document.getElementById("btnVoltarHome").addEventListener("click", voltarParaHome);

    ["btnClientes", "btnMateriais", "btnServicos"].forEach((id) => {
        document.getElementById(id).addEventListener("click", () => {
            alert("Essa área ainda está em construção. Em breve!");
        });
    });

    // ---------- Navegação entre passos do wizard ----------
    function atualizarPasso() {
        document.querySelectorAll(".wizard-step").forEach((el) => {
            el.classList.toggle("active", Number(el.dataset.step) === passoAtual);
        });

        document.getElementById("wizardStepLabel").textContent = `Passo ${passoAtual} de ${TOTAL_PASSOS}`;
        document.getElementById("wizardProgressFill").style.width = (passoAtual / TOTAL_PASSOS * 100) + "%";

        document.getElementById("btnVoltarPasso").classList.toggle("hidden", passoAtual === 1);
        document.getElementById("btnAvancarPasso").classList.toggle("hidden", passoAtual === TOTAL_PASSOS);
        document.getElementById("btnSalvarOrcamento").classList.toggle("hidden", passoAtual !== TOTAL_PASSOS);

        if (passoAtual === TOTAL_PASSOS) {
            calcularResultado();
        }

        window.scrollTo(0, 0);
    }

    document.getElementById("btnAvancarPasso").addEventListener("click", () => {
        if (passoAtual === 1 && !validarPasso1()) return;
        if (passoAtual < TOTAL_PASSOS) {
            passoAtual++;
            atualizarPasso();
        }
    });

    document.getElementById("btnVoltarPasso").addEventListener("click", () => {
        if (passoAtual > 1) {
            passoAtual--;
            atualizarPasso();
        }
    });

    function validarPasso1() {
        const cliente = document.getElementById("campoCliente").value.trim();
        const nomeObra = document.getElementById("campoNomeObra").value.trim();
        if (!cliente || !nomeObra) {
            alert("Preencha ao menos o Cliente e o Nome da obra para continuar.");
            return false;
        }
        return true;
    }

    // ---------- Passo 2: Serviços ----------
    const corpoServicos = document.getElementById("corpoServicos");

    function criarLinhaServico() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" placeholder="Ex: Reboco" class="servico-nome"></td>
            <td><input type="text" placeholder="m²" class="servico-unidade" style="width:60px"></td>
            <td><input type="number" min="0" value="0" class="servico-qtd" style="width:80px"></td>
            <td><button type="button" class="remove-row">✕</button></td>
        `;
        corpoServicos.appendChild(tr);
        tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
    }

    document.getElementById("btnAddServico").addEventListener("click", criarLinhaServico);

    // ---------- Passo 3: Materiais ----------
    const blocoMateriaisValor = document.getElementById("blocoMateriaisValor");

    function atualizarBlocoMateriais() {
        const modo = document.querySelector('input[name="materialFornecimento"]:checked').value;
        blocoMateriaisValor.classList.toggle("hidden", modo === "cliente");
    }

    document.querySelectorAll('input[name="materialFornecimento"]').forEach((r) => {
        r.addEventListener("change", atualizarBlocoMateriais);
    });

    // ---------- Passo 4: Remuneração do Fernando ----------
    const labelValorRemuneracao = document.getElementById("labelValorRemuneracao");
    const labelQtdRemuneracao = document.getElementById("labelQtdRemuneracao");
    const campoQtdRemuneracao = document.getElementById("campoQtdRemuneracao");

    function atualizarBlocoRemuneracao() {
        const modo = document.querySelector('input[name="modoRemuneracao"]:checked').value;
        const textos = {
            diaria: ["Valor da diária (R$)", "Quantos dias você vai trabalhar?"],
            hora: ["Valor da hora (R$)", "Quantas horas você vai trabalhar?"],
            empreitada: ["Valor total da empreitada (R$)", null],
            fixo: ["Valor fixo pelo trabalho (R$)", null]
        };
        const [labelValor, labelQtd] = textos[modo];
        labelValorRemuneracao.childNodes[0].nodeValue = labelValor;

        const usaQtd = labelQtd !== null;
        labelQtdRemuneracao.classList.toggle("hidden", !usaQtd);
        if (usaQtd) {
            labelQtdRemuneracao.childNodes[0].nodeValue = labelQtd;
        } else {
            campoQtdRemuneracao.value = 1;
        }
    }

    document.querySelectorAll('input[name="modoRemuneracao"]').forEach((r) => {
        r.addEventListener("change", atualizarBlocoRemuneracao);
    });

    // ---------- Passo 5: Equipe ----------
    const corpoAjudantes = document.getElementById("corpoAjudantes");
    const corpoProfissionais = document.getElementById("corpoProfissionais");

    function criarLinhaAjudante() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" placeholder="Nome" class="aj-nome" style="width:110px"></td>
            <td><input type="number" min="0" value="0" class="aj-diaria" style="width:90px"></td>
            <td><input type="number" min="0" value="1" class="aj-dias" style="width:70px"></td>
            <td class="aj-custo">R$ 0,00</td>
            <td><button type="button" class="remove-row">✕</button></td>
        `;
        corpoAjudantes.appendChild(tr);
        tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
        tr.querySelectorAll("input").forEach((input) => {
            input.addEventListener("input", () => atualizarLinhaAjudante(tr));
        });
    }

    function atualizarLinhaAjudante(tr) {
        const diaria = parseFloat(tr.querySelector(".aj-diaria").value) || 0;
        const dias = parseFloat(tr.querySelector(".aj-dias").value) || 0;
        tr.querySelector(".aj-custo").textContent = formatarMoeda(diaria * dias);
    }

    function criarLinhaProfissional() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <select class="prof-funcao">
                    <option>Pedreiro</option>
                    <option>Servente</option>
                    <option>Eletricista</option>
                    <option>Encanador</option>
                    <option>Pintor</option>
                    <option>Azulejista</option>
                    <option>Gesseiro</option>
                    <option>Carpinteiro</option>
                    <option>Armador</option>
                    <option>Outro</option>
                </select>
            </td>
            <td><input type="number" min="0" value="0" class="prof-valor" style="width:100px"></td>
            <td><button type="button" class="remove-row">✕</button></td>
        `;
        corpoProfissionais.appendChild(tr);
        tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
    }

    document.getElementById("btnAddAjudante").addEventListener("click", criarLinhaAjudante);
    document.getElementById("btnAddProfissional").addEventListener("click", criarLinhaProfissional);

    // ---------- Passo 6: Equipamentos ----------
    const corpoEquipamentos = document.getElementById("corpoEquipamentos");

    function criarLinhaEquipamento() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" placeholder="Ex: Betoneira" class="eq-nome" style="width:130px"></td>
            <td>
                <select class="eq-tipo">
                    <option value="proprio">Próprio</option>
                    <option value="cliente">Do cliente</option>
                    <option value="alugado">Alugado</option>
                    <option value="terceiro">De terceiro</option>
                </select>
            </td>
            <td><input type="number" min="0" value="0" class="eq-custo" style="width:90px"></td>
            <td><button type="button" class="remove-row">✕</button></td>
        `;
        corpoEquipamentos.appendChild(tr);
        tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
    }

    document.getElementById("btnAddEquipamento").addEventListener("click", criarLinhaEquipamento);

    // ---------- Passo 7: Transporte e outros gastos ----------
    const corpoOutrosGastos = document.getElementById("corpoOutrosGastos");

    function criarLinhaOutroGasto() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" placeholder="Ex: Entulho" class="og-descricao" style="width:150px"></td>
            <td><input type="number" min="0" value="0" class="og-valor" style="width:100px"></td>
            <td><button type="button" class="remove-row">✕</button></td>
        `;
        corpoOutrosGastos.appendChild(tr);
        tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
    }

    document.getElementById("btnAddOutroGasto").addEventListener("click", criarLinhaOutroGasto);

    // ---------- Passo 8: Cálculo do resultado ----------
    function somarTabela(corpo, seletor) {
        return Array.from(corpo.querySelectorAll(seletor)).reduce((soma, input) => soma + (parseFloat(input.value) || 0), 0);
    }

    function calcularRemuneracaoFernando() {
        const modo = document.querySelector('input[name="modoRemuneracao"]:checked').value;
        const valor = parseFloat(document.getElementById("campoValorRemuneracao").value) || 0;
        const qtd = parseFloat(document.getElementById("campoQtdRemuneracao").value) || 0;
        return (modo === "diaria" || modo === "hora") ? valor * qtd : valor;
    }

    function calcularResultado() {
        // Materiais
        const modoMaterial = document.querySelector('input[name="materialFornecimento"]:checked').value;
        let materiais = 0;
        if (modoMaterial !== "cliente") {
            const valorBase = parseFloat(document.getElementById("campoMateriaisValor").value) || 0;
            const perda = parseFloat(document.getElementById("campoMateriaisPerda").value) || 0;
            materiais = valorBase * (1 + perda / 100);
        }

        // Remuneração do Fernando
        const remuneracaoFernando = calcularRemuneracaoFernando();

        // Equipe (ajudantes + outros profissionais)
        const custoAjudantes = Array.from(corpoAjudantes.querySelectorAll("tr")).reduce((soma, tr) => {
            const diaria = parseFloat(tr.querySelector(".aj-diaria").value) || 0;
            const dias = parseFloat(tr.querySelector(".aj-dias").value) || 0;
            return soma + diaria * dias;
        }, 0);
        const custoProfissionais = somarTabela(corpoProfissionais, ".prof-valor");
        const equipe = custoAjudantes + custoProfissionais;

        // Equipamentos
        const equipamentos = somarTabela(corpoEquipamentos, ".eq-custo");

        // Transporte e outros gastos
        const transportePaga = document.querySelector('input[name="transportePaga"]:checked').value;
        const transporte = transportePaga === "fernando" ? (parseFloat(document.getElementById("campoTransporteValor").value) || 0) : 0;

        const alimentacaoPaga = document.querySelector('input[name="alimentacaoPaga"]:checked').value;
        const alimentacao = alimentacaoPaga === "fernando" ? (parseFloat(document.getElementById("campoAlimentacaoValor").value) || 0) : 0;

        const hospedagemPaga = document.querySelector('input[name="hospedagemPaga"]:checked').value;
        const hospedagem = hospedagemPaga === "fernando" ? (parseFloat(document.getElementById("campoHospedagemValor").value) || 0) : 0;

        const outrosGastosTabela = somarTabela(corpoOutrosGastos, ".og-valor");

        const outros = transporte + alimentacao + hospedagem + outrosGastosTabela;

        // Totais
        const custoOperacional = materiais + equipe + equipamentos + outros;
        const custoTotal = custoOperacional + remuneracaoFernando;
        const valorMinimo = custoTotal;

        const precoCobrado = parseFloat(document.getElementById("campoPrecoCobrado").value) || 0;
        const lucro = precoCobrado - custoTotal;
        const margem = precoCobrado > 0 ? (lucro / precoCobrado) * 100 : 0;

        const prazoDias = parseFloat(document.getElementById("campoPrazoDias").value) || 1;
        const lucroPorDia = lucro / prazoDias;

        // Exibição
        document.getElementById("resMateriais").textContent = formatarMoeda(materiais);
        document.getElementById("resEquipe").textContent = formatarMoeda(equipe);
        document.getElementById("resEquipamentos").textContent = formatarMoeda(equipamentos);
        document.getElementById("resOutros").textContent = formatarMoeda(outros);
        document.getElementById("resCustoOperacional").textContent = formatarMoeda(custoOperacional);
        document.getElementById("resRemuneracao").textContent = formatarMoeda(remuneracaoFernando);
        document.getElementById("resCustoTotal").textContent = formatarMoeda(custoTotal);
        document.getElementById("resValorMinimo").textContent = formatarMoeda(valorMinimo);
        document.getElementById("resLucro").textContent = formatarMoeda(lucro);
        document.getElementById("resMargem").textContent = margem.toFixed(1) + "%";
        document.getElementById("resLucroDia").textContent = formatarMoeda(lucroPorDia);

        atualizarRadar({ precoCobrado, custoTotal, equipamentos, transportePaga, alimentacaoPaga });
        atualizarIndicador(precoCobrado, custoTotal, margem);

        return { materiais, equipe, equipamentos, outros, custoOperacional, remuneracaoFernando, custoTotal, valorMinimo, precoCobrado, lucro, margem, lucroPorDia };
    }

    document.getElementById("campoPrecoCobrado").addEventListener("input", calcularResultado);

    function atualizarRadar({ precoCobrado, custoTotal, equipamentos, transportePaga, alimentacaoPaga }) {
        const avisos = [];

        if (precoCobrado > 0 && precoCobrado < custoTotal) {
            avisos.push("O valor a cobrar é menor que o custo total: essa obra dá prejuízo do jeito que está.");
        }
        if (equipamentos === 0) {
            avisos.push("Nenhum custo de equipamento/ferramenta foi informado. Confirme se realmente não há gasto nenhum aqui.");
        }
        if (transportePaga === "fernando" && (parseFloat(document.getElementById("campoTransporteValor").value) || 0) === 0) {
            avisos.push("Você disse que paga o transporte, mas o custo está em R$ 0. Confira se esqueceu de preencher.");
        }

        if (avisos.length === 0) {
            radarPrejuizo.classList.add("hidden");
            radarPrejuizo.innerHTML = "";
            return;
        }

        radarPrejuizo.classList.remove("hidden");
        radarPrejuizo.classList.toggle("perigo", precoCobrado > 0 && precoCobrado < custoTotal);
        radarPrejuizo.innerHTML = `<strong>⚠️ Radar de Prejuízo</strong><ul>${avisos.map(a => `<li>${a}</li>`).join("")}</ul>`;
    }

    function atualizarIndicador(precoCobrado, custoTotal, margem) {
        indicadorResultado.classList.remove("verde", "amarelo", "vermelho");
        if (precoCobrado === 0) {
            indicadorResultado.textContent = "";
            return;
        }
        if (precoCobrado < custoTotal) {
            indicadorResultado.textContent = "🔴 Atenção: o valor informado não cobre todos os custos.";
            indicadorResultado.classList.add("vermelho");
        } else if (margem < 15) {
            indicadorResultado.textContent = "🟡 Margem baixa. Vale reavaliar o valor cobrado.";
            indicadorResultado.classList.add("amarelo");
        } else {
            indicadorResultado.textContent = "🟢 Obra apresenta resultado positivo.";
            indicadorResultado.classList.add("verde");
        }
    }

    // ---------- Salvar orçamento ----------
    function salvarOrcamento() {
        const cliente = document.getElementById("campoCliente").value.trim();
        const nomeObra = document.getElementById("campoNomeObra").value.trim();
        if (!cliente || !nomeObra) {
            alert("Preencha o Cliente e o Nome da obra no passo 1 antes de salvar.");
            return;
        }

        const resultado = calcularResultado();

        const orcamento = {
            id: Date.now(),
            cliente,
            nomeObra,
            endereco: document.getElementById("campoEndereco").value.trim(),
            data: document.getElementById("campoData").value,
            precoCobrado: resultado.precoCobrado,
            custoTotal: resultado.custoTotal,
            remuneracaoFernando: resultado.remuneracaoFernando,
            lucro: resultado.lucro,
            margem: resultado.margem
        };

        const orcamentos = carregarOrcamentos();
        orcamentos.push(orcamento);
        localStorage.setItem("orcaobra_orcamentos", JSON.stringify(orcamentos));

        renderizarDashboard();
        voltarParaHome();
    }

    document.getElementById("btnSalvarOrcamento").addEventListener("click", salvarOrcamento);

    // ---------- Limpar formulário ao abrir novo orçamento ----------
    function limparFormulario() {
        document.getElementById("campoCliente").value = "";
        document.getElementById("campoNomeObra").value = "";
        document.getElementById("campoEndereco").value = "";
        document.getElementById("campoDescricao").value = "";
        document.getElementById("campoPrazoDias").value = 1;
        document.getElementById("campoData").value = "";
        document.getElementById("campoValidade").value = "";

        corpoServicos.innerHTML = "";
        criarLinhaServico();

        document.querySelector('input[name="materialFornecimento"][value="fernando"]').checked = true;
        document.getElementById("campoMateriaisValor").value = 0;
        document.getElementById("campoMateriaisPerda").value = 0;
        atualizarBlocoMateriais();

        document.querySelector('input[name="modoRemuneracao"][value="diaria"]').checked = true;
        document.getElementById("campoValorRemuneracao").value = 0;
        document.getElementById("campoQtdRemuneracao").value = 1;
        atualizarBlocoRemuneracao();

        corpoAjudantes.innerHTML = "";
        corpoProfissionais.innerHTML = "";
        corpoEquipamentos.innerHTML = "";
        corpoOutrosGastos.innerHTML = "";

        document.querySelector('input[name="transportePaga"][value="fernando"]').checked = true;
        document.getElementById("campoTransporteValor").value = 0;
        document.querySelector('input[name="alimentacaoPaga"][value="nao"]').checked = true;
        document.getElementById("campoAlimentacaoValor").value = 0;
        document.querySelector('input[name="hospedagemPaga"][value="nao"]').checked = true;
        document.getElementById("campoHospedagemValor").value = 0;

        document.getElementById("campoPrecoCobrado").value = 0;

        radarPrejuizo.classList.add("hidden");
        indicadorResultado.textContent = "";
        indicadorResultado.classList.remove("verde", "amarelo", "vermelho");
    }

    // ---------- Dashboard ----------
    function carregarOrcamentos() {
        try {
            return JSON.parse(localStorage.getItem("orcaobra_orcamentos")) || [];
        } catch (e) {
            return [];
        }
    }

    function renderizarDashboard() {
        const orcamentos = carregarOrcamentos();

        document.getElementById("statOrcamentos").textContent = orcamentos.length;

        const valorOrcado = orcamentos.reduce((soma, o) => soma + (o.precoCobrado || 0), 0);
        const lucroPrevisto = orcamentos.reduce((soma, o) => soma + (o.lucro || 0), 0);

        document.getElementById("statValorOrcado").textContent = formatarMoeda(valorOrcado);
        document.getElementById("statLucroPrevisto").textContent = formatarMoeda(lucroPrevisto);

        const lista = document.getElementById("listaOrcamentos");

        if (orcamentos.length === 0) {
            lista.innerHTML = `
                <div class="empty" id="orcamentosEmpty">
                    <div class="empty-icon">📋</div>
                    <h3>Nenhum orçamento ainda</h3>
                    <p>Crie seu primeiro orçamento para começar.</p>
                </div>`;
            return;
        }

        const ultimos = orcamentos.slice(-5).reverse();
        lista.innerHTML = ultimos.map((o) => `
            <div class="orcamento-item">
                <div>
                    <div class="nome">${escapeHtml(o.nomeObra)}</div>
                    <div class="sub">${escapeHtml(o.cliente)}</div>
                </div>
                <div class="valor">${formatarMoeda(o.precoCobrado)}</div>
            </div>
        `).join("");
    }

    // ---------- Utilidades ----------
    function formatarMoeda(valor) {
        return "R$ " + (valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto || "";
        return div.innerHTML;
    }

    // ---------- Inicialização ----------
    criarLinhaServico();
    atualizarBlocoMateriais();
    atualizarBlocoRemuneracao();
    renderizarDashboard();

});
