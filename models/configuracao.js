import { mongoose } from '../config/conexao.js';

const ConfiguracaoSchema = new mongoose.Schema({
    chave: { type: String, required: true, unique: true },
    termosProibidos: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.Configuracao
    || mongoose.model('Configuracao', ConfiguracaoSchema);
