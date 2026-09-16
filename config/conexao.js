import mongoose from 'mongoose';

let tentativaConexao = null;
let avisoMostrado = false;

export default async function conectarBanco() {
    if (mongoose.connection.readyState === 1) return true;

    if (!process.env.MONGODB_URI) {
        if (process.env.NODE_ENV === 'production') {
            const erro = new Error('Configure MONGODB_URI para executar em produção.');
            erro.status = 503;
            throw erro;
        }
        if (!avisoMostrado) {
            console.log('MongoDB não configurado. O projeto está usando o modo demonstração.');
            avisoMostrado = true;
        }
        return false;
    }

    try {
        if (!tentativaConexao) {
            tentativaConexao = mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
            });
        }

        await tentativaConexao;
        return true;
    } catch (erro) {
        tentativaConexao = null;
        // Nunca trocamos dados reais por exemplos quando a conexão falha.
        const indisponivel = new Error('Banco de dados indisponível. Tente novamente em instantes.');
        indisponivel.status = 503;
        throw indisponivel;
    }
}

export { mongoose };
