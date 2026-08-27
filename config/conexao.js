import mongoose from 'mongoose';

let tentativaConexao = null;
let avisoMostrado = false;

export default async function conectarBanco() {
    if (mongoose.connection.readyState === 1) return true;

    if (!process.env.MONGODB_URI) {
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
        console.error('Não foi possível conectar ao MongoDB:', erro.message);
        return false;
    }
}

export { mongoose };
