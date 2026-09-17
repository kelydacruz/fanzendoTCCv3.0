import { mongoose } from './conexao.js';

// Sem URI, usamos os dados de exemplo. Com URI, uma queda do banco deve interromper a operação.
export function usandoMongo() {
    if (mongoose.connection.readyState === 1) return true;
    if (process.env.MONGODB_URI || process.env.NODE_ENV === 'production') {
        const erro = new Error('Banco de dados indisponível. Tente novamente em instantes.');
        erro.status = 503;
        throw erro;
    }
    return false;
}

export const idValido = (id) => mongoose.Types.ObjectId.isValid(id);
