import { textoComTamanho } from '../services/validacao.js';

// As mesmas regras valem para criar e editar, inclusive no modo demonstração.
export function erroCadastro(mensagem, status = 400) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

export function validarNome(nome, maximo = 100) {
    if (typeof nome !== 'string' || !textoComTamanho(nome.trim(), 2, maximo)) {
        throw erroCadastro(`Informe um nome entre 2 e ${maximo} caracteres.`);
    }
    return nome.trim();
}

export function validarSituacao(ativo) {
    if (typeof ativo !== 'boolean') throw erroCadastro('Situação inválida.');
    return ativo;
}

export function conferirNomeRepetido(itens, nome, id = '') {
    const repetido = itens.some((item) => String(item.id || item._id) !== String(id)
        && item.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'));
    if (repetido) throw erroCadastro('Já existe um cadastro com esse nome.', 409);
}
